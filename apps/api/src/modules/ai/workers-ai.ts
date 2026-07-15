import {
	WordCompletionResultSchema,
	type WordCompletionResult,
} from "@hudeato/schema";
import { EMBEDDING_DIM } from "../../db/word-schema";

// ===========================================================================
// Workers AI 連携モジュール
// 単語の意味を構造化出力(JSON)で生成し、埋め込みベクトルを生成する。
// 依存(AIバインディング)は引数で受け取り、シングルトンを作らない。
// テストでは AiClient を差し替える（バインディング注入なので vi.mock 不要）。
// ===========================================================================

// 意味生成のモデル。埋め込みは embeddinggemma-300m（出力768次元で
// word_schema の EMBEDDING_DIM(768) とそのまま一致する）。
export const WORKERS_AI_COMPLETION_MODEL = "@cf/openai/gpt-oss-120b";
export const WORKERS_AI_EMBEDDING_MODEL = "@cf/google/embeddinggemma-300m";

// env.AI が満たす最小インターフェース。workers-types の Ai はモデルIDごとの
// 型マップに縛られるため、ここでは緩い形で受けて出力を自前で検証する。
export interface AiClient {
	run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

// リトライ設定。一時的な失敗(5xx/レート制限)や不正な構造化出力に対し指数バックオフする。
export interface RetryOptions {
	attempts?: number;
	baseDelayMs?: number;
}
const DEFAULT_RETRY: Required<RetryOptions> = { attempts: 3, baseDelayMs: 300 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(
	fn: () => Promise<T>,
	options?: RetryOptions,
): Promise<T> {
	const { attempts, baseDelayMs } = { ...DEFAULT_RETRY, ...options };
	let lastError: unknown;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (i < attempts - 1 && baseDelayMs > 0) {
				await sleep(baseDelayMs * 2 ** i);
			}
		}
	}
	throw lastError;
}

// 構造化出力のレスポンススキーマ（word_meaning の各slotに対応）。
// gpt-oss は Responses API の strict json_schema を使うため、全プロパティを
// required に列挙し additionalProperties を禁止する（null 許容は型で表す）。
const MEANING_JSON_SCHEMA = {
	type: "object",
	properties: {
		meanings: {
			type: "array",
			items: {
				type: "object",
				properties: {
					meaning: { type: "string" },
					partOfSpeech: { type: ["string", "null"] },
					phonetic: { type: ["string", "null"] },
					example: { type: ["string", "null"] },
					collocation: { type: ["string", "null"] },
					synonym: { type: ["string", "null"] },
					etymology: { type: ["string", "null"] },
				},
				required: [
					"meaning",
					"partOfSpeech",
					"phonetic",
					"example",
					"collocation",
					"synonym",
					"etymology",
				],
				additionalProperties: false,
			},
		},
	},
	required: ["meanings"],
	additionalProperties: false,
} as const;

// 意味生成プロンプトを組み立てる。lang は出力言語（当面 'ja' 固定運用）。
// userPrompt は AIチャット欄の入力（補完のコンテキスト）。
const buildMeaningPrompt = (
	word: string,
	lang: string,
	userPrompt?: string | null,
): string => {
	const lines = [
		`次の言葉「${word}」の語義を、辞書のように${lang === "ja" ? "日本語" : lang}で説明してください。`,
		"複数の語義がある場合はよく使われる順に列挙してください。",
		"各語義について meaning(意味), partOfSpeech(品詞), phonetic(発音記号/IPA), example(例文), collocation(よく使う組み合わせ), synonym(類義語), etymology(語源) を可能な範囲で埋めてください。",
		"確証が持てない項目は推測せず null にしてください。",
		// 構造化出力が効かない場合の保険として、出力形をプロンプトでも固定する。
		'出力は次の形のJSONのみ: {"meanings":[{"meaning":"...","partOfSpeech":null,"phonetic":null,"example":null,"collocation":null,"synonym":null,"etymology":null}]}',
	];
	if (userPrompt && userPrompt.trim()) {
		lines.push(`補足の文脈: ${userPrompt.trim()}`);
	}
	return lines.join("\n");
};

// Workers AI のレスポンスから生成テキストを取り出す。
// モデル/入力形式によって { response: string } / { response: object } /
// Responses API 形（output[].content[].text）のいずれかで返るため吸収する。
const extractResponseText = (result: unknown): string => {
	if (typeof result === "string") return result;
	if (result != null && typeof result === "object") {
		const r = result as Record<string, unknown>;
		if (typeof r.response === "string") return r.response;
		// JSONモードでは response がパース済みオブジェクトで返ることがある。
		if (r.response != null && typeof r.response === "object") {
			return JSON.stringify(r.response);
		}
		if (Array.isArray(r.output)) {
			const texts: string[] = [];
			for (const item of r.output) {
				const message = item as {
					type?: string;
					content?: Array<{ type?: string; text?: string }>;
				};
				if (message?.type === "message" && Array.isArray(message.content)) {
					for (const part of message.content) {
						if (part?.type === "output_text" && typeof part.text === "string") {
							texts.push(part.text);
						}
					}
				}
			}
			if (texts.length > 0) return texts.join("");
		}
	}
	throw new Error("unexpected Workers AI response shape");
};

export interface GenerateWordCompletionParams {
	ai: AiClient;
	word: string;
	// 出力言語。省略時は 'ja'。
	lang?: string;
	// AIチャット欄などの補完コンテキスト。
	prompt?: string | null;
	retry?: RetryOptions;
}

// 単語の意味を構造化出力で生成する。パース + Zod 検証まで含めてリトライする
// （不正な出力は再試行の対象）。
export async function generateWordCompletion(
	params: GenerateWordCompletionParams,
): Promise<WordCompletionResult> {
	const { ai, word, lang = "ja", prompt, retry } = params;
	const promptText = buildMeaningPrompt(word, lang, prompt);

	return withRetry(async () => {
		// gpt-oss は Responses API 形式。構造化出力は text.format で指定する
		// （Chat Completions の response_format はこのモデルには渡らない）。
		const result = await ai.run(WORKERS_AI_COMPLETION_MODEL, {
			instructions:
				"あなたは辞書編集者です。指定されたJSONスキーマに従い、JSONのみを出力してください。",
			input: promptText,
			text: {
				format: {
					type: "json_schema",
					name: "word_completion",
					schema: MEANING_JSON_SCHEMA,
					strict: true,
				},
			},
		});
		const text = extractResponseText(result);
		const json = JSON.parse(text);
		return WordCompletionResultSchema.parse(json);
	}, retry);
}

export interface GenerateEmbeddingParams {
	ai: AiClient;
	text: string;
	retry?: RetryOptions;
}

// L2正規化（コサイン距離自体はスケール不変だが、モデル出力の一貫性のため揃える）。
const normalize = (vector: number[]): number[] => {
	let sumSquares = 0;
	for (const v of vector) sumSquares += v * v;
	const norm = Math.sqrt(sumSquares);
	if (norm === 0) return vector;
	return vector.map((v) => v / norm);
};

// 埋め込みレスポンスからベクトルを取り出す。
// ネイティブ形 { data: number[][] } と OpenAI互換形 { data: [{ embedding }] } を吸収する。
const extractEmbeddingVector = (result: unknown): number[] | null => {
	if (result == null || typeof result !== "object") return null;
	const data = (result as { data?: unknown }).data;
	if (!Array.isArray(data) || data.length === 0) return null;
	const first = data[0];
	if (Array.isArray(first)) return first as number[];
	if (
		first != null &&
		typeof first === "object" &&
		Array.isArray((first as { embedding?: unknown }).embedding)
	) {
		return (first as { embedding: number[] }).embedding;
	}
	return null;
};

// テキストの埋め込みベクトルを生成する。EMBEDDING_DIM 次元の number[] を返す。
export async function generateEmbedding(
	params: GenerateEmbeddingParams,
): Promise<number[]> {
	const { ai, text, retry } = params;

	return withRetry(async () => {
		const result = await ai.run(WORKERS_AI_EMBEDDING_MODEL, { text: [text] });
		const values = extractEmbeddingVector(result);
		if (!values || values.length === 0) {
			throw new Error("embedding response contained no values");
		}
		if (values.length !== EMBEDDING_DIM) {
			throw new Error(
				`embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${values.length}`,
			);
		}
		return normalize(values);
	}, retry);
}
