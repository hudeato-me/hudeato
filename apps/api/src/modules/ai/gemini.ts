import {
	GoogleGenerativeAI,
	SchemaType,
	type EmbedContentRequest,
	type Schema,
} from "@google/generative-ai";
import {
	WordCompletionResultSchema,
	type WordCompletionResult,
} from "@hudeato/schema";
import { EMBEDDING_DIM } from "../../db/word-schema";

// ===========================================================================
// Gemini 連携モジュール（P1-1）
// 単語の意味を構造化出力(JSON)で生成し、埋め込みベクトルを生成する。
// 依存(apiKey)は引数で受け取り、シングルトンを作らない（他モジュールと同じ方針）。
// テストでは "@google/generative-ai" をモックする。
// ===========================================================================

// 意味生成のモデル。埋め込みは gemini-embedding-001 を outputDimensionality で
// word_schema の EMBEDDING_DIM(768) に合わせる（text-embedding-004 はAPIから廃止済み）。
export const GEMINI_GENERATION_MODEL = "gemini-2.5-flash";
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";

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

// Gemini 構造化出力のレスポンススキーマ（word_meaning の各slotに対応）。
const MEANING_RESPONSE_SCHEMA: Schema = {
	type: SchemaType.OBJECT,
	properties: {
		meanings: {
			type: SchemaType.ARRAY,
			items: {
				type: SchemaType.OBJECT,
				properties: {
					meaning: { type: SchemaType.STRING },
					partOfSpeech: { type: SchemaType.STRING, nullable: true },
					phonetic: { type: SchemaType.STRING, nullable: true },
					example: { type: SchemaType.STRING, nullable: true },
					collocation: { type: SchemaType.STRING, nullable: true },
					synonym: { type: SchemaType.STRING, nullable: true },
					etymology: { type: SchemaType.STRING, nullable: true },
				},
				required: ["meaning"],
			},
		},
	},
	required: ["meanings"],
};

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
	];
	if (userPrompt && userPrompt.trim()) {
		lines.push(`補足の文脈: ${userPrompt.trim()}`);
	}
	return lines.join("\n");
};

export interface GenerateWordCompletionParams {
	apiKey: string;
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
	const { apiKey, word, lang = "ja", prompt, retry } = params;
	const genAI = new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({
		model: GEMINI_GENERATION_MODEL,
		generationConfig: {
			responseMimeType: "application/json",
			responseSchema: MEANING_RESPONSE_SCHEMA,
		},
	});
	const promptText = buildMeaningPrompt(word, lang, prompt);

	return withRetry(async () => {
		const result = await model.generateContent(promptText);
		const text = result.response.text();
		const json = JSON.parse(text);
		return WordCompletionResultSchema.parse(json);
	}, retry);
}

export interface GenerateEmbeddingParams {
	apiKey: string;
	text: string;
	retry?: RetryOptions;
}

// L2正規化（コサイン距離自体はスケール不変だが、次元削減時の一貫性のため揃える）。
const normalize = (vector: number[]): number[] => {
	let sumSquares = 0;
	for (const v of vector) sumSquares += v * v;
	const norm = Math.sqrt(sumSquares);
	if (norm === 0) return vector;
	return vector.map((v) => v / norm);
};

// テキストの埋め込みベクトルを生成する。EMBEDDING_DIM 次元の number[] を返す。
export async function generateEmbedding(
	params: GenerateEmbeddingParams,
): Promise<number[]> {
	const { apiKey, text, retry } = params;
	const genAI = new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });

	// SDK(0.24)の型定義に outputDimensionality が無いが、リクエストはそのまま
	// 送信されるため型を拡張して渡す（REST API 側は対応済みのフィールド）。
	const request: EmbedContentRequest & { outputDimensionality: number } = {
		content: { role: "user", parts: [{ text }] },
		// EMBEDDING_DIM(768) に次元を落とす。この場合正規化されないため下で自前で行う
		outputDimensionality: EMBEDDING_DIM,
	};

	return withRetry(async () => {
		const result = await model.embedContent(request);
		const values = result.embedding?.values;
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
