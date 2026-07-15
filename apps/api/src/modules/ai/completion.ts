import type { MessageBatch } from "@cloudflare/workers-types";
import {
	COMPLETABLE_FIELDS,
	type CompletableField,
	type GeneratedMeaning,
} from "@hudeato/schema";
import { createDb } from "../../db";
import type { Bindings } from "../../types";
import type { Db } from "../../types/words-route-type";
import { upsertWordEmbedding } from "../study/repository";
import {
	readMeaningCache,
	writeMeaningCache,
	type MeaningCacheStore,
} from "./cache";
import {
	WORKERS_AI_EMBEDDING_MODEL,
	generateEmbedding,
	generateWordCompletion,
	type AiClient,
} from "./workers-ai";
import {
	applyWordCompletion,
	findWordForCompletion,
	markWordCompletionFailed,
	type CompletionMeaningRow,
} from "./repository";

// ===========================================================================
// AI補完のオーケストレーション（P1-3）
// 空欄のみを補完し、非同期実行は Cloudflare Queues（producer=API / consumer=本Worker）。
// ===========================================================================

// 再補完で上書き対象を明示する指定（slot単位でフィールドを列挙）。
export interface CompletionTarget {
	slot: number;
	fields: CompletableField[];
}

// キューに載せる補完ジョブのメッセージ。
export interface WordCompletionMessage {
	wordId: string;
	userId: string;
	wordSetId: string;
	// 出力言語（当面 'ja'）。
	lang: string;
	// AIチャット欄などの補完コンテキスト。
	prompt: string | null;
	// 明示指定された欄だけ上書き再生成する（P1-6）。省略時は空欄のみ補完。
	targets?: CompletionTarget[] | null;
}

const isEmpty = (v: string | null | undefined): boolean =>
	v == null || v.trim() === "";

// 登録リクエストの意味配列に、補完すべき空欄があるか判定する。
// 意味が0件（全てAI任せ）、またはいずれかの補完対象フィールドが空なら true。
export const hasEmptyCompletionFields = (
	meanings: Array<Partial<Record<CompletableField, string | null | undefined>>>,
): boolean => {
	if (meanings.length === 0) return true;
	return meanings.some((m) => COMPLETABLE_FIELDS.some((f) => isEmpty(m[f])));
};

// 既存の意味に対する空欄パッチ。
export interface MeaningPatch {
	id: string;
	patch: Partial<Record<CompletableField, string>>;
}

// 新規に追加する意味。
export interface MeaningInsert {
	slot: number;
	meaning: string;
	partOfSpeech: string | null;
	phonetic: string | null;
	example: string | null;
	collocation: string | null;
	synonym: string | null;
	etymology: string | null;
}

export interface MergeResult {
	updates: MeaningPatch[];
	inserts: MeaningInsert[];
}

// 意味は最大5スロット（word_meaning の slot 制約に合わせる）。
const MAX_SLOT = 5;

// 既存の意味は「空欄のみ」AI出力で埋め（入力済みは触らない）、
// 既存を超える語義は空きスロットに新規追加する（最大5まで）。
export const mergeEmptyFields = (
	existing: CompletionMeaningRow[],
	generated: GeneratedMeaning[],
): MergeResult => {
	const updates: MeaningPatch[] = [];
	for (let i = 0; i < existing.length; i++) {
		const gen = generated[i];
		if (!gen) continue;
		const patch: Partial<Record<CompletableField, string>> = {};
		for (const field of COMPLETABLE_FIELDS) {
			const current = existing[i][field];
			const next = gen[field];
			if (isEmpty(current) && next != null && next.trim() !== "") {
				patch[field] = next;
			}
		}
		if (Object.keys(patch).length > 0) {
			updates.push({ id: existing[i].id, patch });
		}
	}

	const usedSlots = existing.map((m) => m.slot);
	let nextSlot = (usedSlots.length ? Math.max(...usedSlots) : 0) + 1;
	const inserts: MeaningInsert[] = [];
	for (let j = existing.length; j < generated.length && nextSlot <= MAX_SLOT; j++) {
		const gen = generated[j];
		if (isEmpty(gen.meaning)) continue;
		inserts.push({
			slot: nextSlot,
			meaning: gen.meaning,
			partOfSpeech: gen.partOfSpeech ?? null,
			phonetic: gen.phonetic ?? null,
			example: gen.example ?? null,
			collocation: gen.collocation ?? null,
			synonym: gen.synonym ?? null,
			etymology: gen.etymology ?? null,
		});
		nextSlot++;
	}

	return { updates, inserts };
};

// 明示指定された欄だけAI出力で上書きする（P1-6 編集画面のsend用）。
// 指定外のフィールドには一切触らない。ユーザーの明示指示なので入力済みでも上書きする。
// 既存の意味とAI出力は slot 順のインデックスで対応づける（mergeEmptyFields と同じ規約）。
export const mergeTargetedFields = (
	existing: CompletionMeaningRow[],
	generated: GeneratedMeaning[],
	targets: CompletionTarget[],
): MergeResult => {
	const updates: MeaningPatch[] = [];
	for (const target of targets) {
		const index = existing.findIndex((m) => m.slot === target.slot);
		if (index === -1) continue;
		const gen = generated[index] ?? generated[0];
		if (!gen) continue;
		const patch: Partial<Record<CompletableField, string>> = {};
		for (const field of target.fields) {
			const next = gen[field];
			if (next != null && next.trim() !== "") {
				patch[field] = next;
			}
		}
		if (Object.keys(patch).length > 0) {
			updates.push({ id: existing[index].id, patch });
		}
	}
	// 上書き再生成では新規語義の追加は行わない（対象欄の更新に限定する）。
	return { updates, inserts: [] };
};

export interface CompleteWordDeps {
	db: Db;
	ai: AiClient;
	cache: MeaningCacheStore;
}

// 1件分の補完を実行する（基盤非依存のコア）。
// 対象取得 → 共有キャッシュ確認(ヒットならAIスキップ) → Workers AI生成 → 空欄のみマージ → 反映(status=done)。
// 例外は呼び出し側(consumer)でリトライ/failed判定する。
export const completeWord = async (
	deps: CompleteWordDeps,
	msg: WordCompletionMessage,
): Promise<void> => {
	const { db, ai, cache } = deps;
	const target = await findWordForCompletion(
		db,
		msg.userId,
		msg.wordSetId,
		msg.wordId,
	);
	// 単語が削除済みなどで見つからなければ何もしない。
	if (!target) return;

	// カスタムprompt付き・上書き指定ありの生成は文脈依存のため、
	// 共有キャッシュを読まない・書かない（グローバルキャッシュの汚染防止）。
	const isContextual =
		(msg.prompt != null && msg.prompt.trim() !== "") ||
		(msg.targets != null && msg.targets.length > 0);

	// 上書き指定つき再生成では、対象スロットの既存の語義をプロンプトに渡し、
	// 生成される語義の並びが対象とずれる（別の語義で上書きする）のを防ぐ。
	let effectivePrompt = msg.prompt;
	if (msg.targets && msg.targets.length > 0) {
		const targetContext = msg.targets
			.map((t) => {
				const m = target.meanings.find((x) => x.slot === t.slot);
				return m && !isEmpty(m.meaning) ? `語義${t.slot}: ${m.meaning}` : null;
			})
			.filter((s): s is string => s != null)
			.join("\n");
		if (targetContext) {
			effectivePrompt = [
				msg.prompt?.trim() || null,
				`再生成の対象は次の語義です。この語義に対応する内容を同じ順序で生成してください:\n${targetContext}`,
			]
				.filter(Boolean)
				.join("\n");
		}
	}

	// 共有キャッシュにヒットすれば Workers AI を呼ばずに完了させる。
	const cached = isContextual
		? null
		: await readMeaningCache(cache, target.text, msg.lang);
	let generated: GeneratedMeaning[];
	if (cached) {
		generated = cached;
	} else {
		const result = await generateWordCompletion({
			ai,
			word: target.text,
			lang: msg.lang,
			prompt: effectivePrompt,
		});
		generated = result.meanings;
		if (!isContextual) {
			// 次のユーザーのために共有キャッシュへ保存する。
			await writeMeaningCache(cache, target.text, msg.lang, generated);
		}
	}

	// 明示指定があればその欄だけ上書き、なければ空欄のみ補完する。
	// 空欄のみ補完は反映トランザクション内で空欄を再チェックし、
	// 生成中に入ったユーザー編集を上書きしない。
	const isTargeted = msg.targets != null && msg.targets.length > 0;
	const merged = isTargeted
		? mergeTargetedFields(target.meanings, generated, msg.targets!)
		: mergeEmptyFields(target.meanings, generated);
	await applyWordCompletion(db, msg.wordId, merged, {
		fillBlanksOnly: !isTargeted,
	});
};

// 埋め込みの入力テキストを組み立てる（単語 + 意味）。P2の近傍検索の質を左右する。
export const buildEmbeddingInput = (
	wordText: string,
	meanings: { meaning: string }[],
): string => {
	const joined = meanings
		.map((m) => m.meaning)
		.filter((s) => s.trim() !== "")
		.join("; ");
	return joined ? `${wordText}: ${joined}` : wordText;
};

export interface EmbeddingTarget {
	wordId: string;
	userId: string;
	wordSetId: string;
}

// 補完後の埋め込み生成フック（P1-5, best-effort）。
// 補完済みの単語+意味から埋め込みを生成し upsert する。
// 失敗しても意味は保存済みのため補完全体は失敗させず、ログのみ残す。
export const generateWordEmbedding = async (
	deps: { db: Db; ai: AiClient },
	target: EmbeddingTarget,
): Promise<void> => {
	const { db, ai } = deps;
	try {
		const word = await findWordForCompletion(
			db,
			target.userId,
			target.wordSetId,
			target.wordId,
		);
		if (!word) return;
		const input = buildEmbeddingInput(word.text, word.meanings);
		const vector = await generateEmbedding({ ai, text: input });
		await upsertWordEmbedding(db, target.wordId, vector, WORKERS_AI_EMBEDDING_MODEL);
	} catch (error) {
		console.error("failed to generate word embedding", target.wordId, error);
	}
};

// producer 側で enqueue に失敗した場合など、補完を失敗として記録する。
// pending のまま取り残さないためのフォールバック。
export const failWordCompletion = async (
	db: Db,
	wordId: string,
): Promise<void> => {
	await markWordCompletionFailed(db, wordId);
};

// 最大配信回数 = 初回 + wrangler.toml の max_retries(3)。
// attempts は初回配信で 1 から始まるため、最終配信は attempts === 4。
const MAX_COMPLETION_DELIVERIES = 4;

// Queues consumer 本体。バッチ内の各メッセージを補完し、
// 失敗は上限までリトライ、最終配信での失敗で failed 確定する。
export const handleWordCompletionQueue = async (
	batch: MessageBatch<WordCompletionMessage>,
	env: Bindings,
): Promise<void> => {
	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	for (const message of batch.messages) {
		try {
			await completeWord(
				{ db, ai: env.AI, cache: env.MEANING_CACHE },
				message.body,
			);
			// 補完成功後に埋め込みを生成（best-effort、失敗してもackする）。
			await generateWordEmbedding({ db, ai: env.AI }, message.body);
			message.ack();
		} catch (error) {
			console.error("word completion failed", message.body.wordId, error);
			if (message.attempts >= MAX_COMPLETION_DELIVERIES) {
				// failed の記録に失敗した場合は ack せず再配信に賭ける
				// （記録できないまま ack すると単語が pending のまま取り残されるため）。
				try {
					await markWordCompletionFailed(db, message.body.wordId);
					message.ack();
				} catch (markError) {
					console.error(
						"failed to mark word completion as failed",
						message.body.wordId,
						markError,
					);
					message.retry();
				}
			} else {
				message.retry();
			}
		}
	}
};
