import type { MessageBatch } from "@cloudflare/workers-types";
import type { GeneratedMeaning } from "@hudeato/schema";
import { createDb } from "../../db";
import type { Bindings } from "../../types";
import type { Db } from "../../types/words-route-type";
import { generateWordCompletion } from "./gemini";
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

// キューに載せる補完ジョブのメッセージ。
export interface WordCompletionMessage {
	wordId: string;
	userId: string;
	wordSetId: string;
	// 出力言語（当面 'ja'）。
	lang: string;
	// AIチャット欄などの補完コンテキスト。
	prompt: string | null;
}

// AI補完で埋めうるフィールド（source=出典 はユーザー由来のため対象外）。
export const COMPLETABLE_FIELDS = [
	"meaning",
	"partOfSpeech",
	"phonetic",
	"example",
	"collocation",
	"synonym",
	"etymology",
] as const;
export type CompletableField = (typeof COMPLETABLE_FIELDS)[number];

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

export interface CompleteWordDeps {
	db: Db;
	apiKey: string;
}

// 1件分の補完を実行する（基盤非依存のコア）。
// 対象取得 → Gemini生成 → 空欄のみマージ → 反映(status=done)。
// 例外は呼び出し側(consumer)でリトライ/failed判定する。
export const completeWord = async (
	deps: CompleteWordDeps,
	msg: WordCompletionMessage,
): Promise<void> => {
	const { db, apiKey } = deps;
	const target = await findWordForCompletion(
		db,
		msg.userId,
		msg.wordSetId,
		msg.wordId,
	);
	// 単語が削除済みなどで見つからなければ何もしない。
	if (!target) return;

	const result = await generateWordCompletion({
		apiKey,
		word: target.text,
		lang: msg.lang,
		prompt: msg.prompt,
	});

	const merged = mergeEmptyFields(target.meanings, result.meanings);
	await applyWordCompletion(db, msg.wordId, merged);
	// TODO(P1-4): 共有キャッシュ global:meaning:* への書き込み
	// TODO(P1-5): word_embedding の生成
};

// producer 側で enqueue に失敗した場合など、補完を失敗として記録する。
// pending のまま取り残さないためのフォールバック。
export const failWordCompletion = async (
	db: Db,
	wordId: string,
): Promise<void> => {
	await markWordCompletionFailed(db, wordId);
};

// リトライ上限（wrangler.toml の max_retries と揃える）。
const MAX_COMPLETION_ATTEMPTS = 3;

// Queues consumer 本体。バッチ内の各メッセージを補完し、
// 失敗は上限までリトライ、上限超過で failed 確定する。
export const handleWordCompletionQueue = async (
	batch: MessageBatch<WordCompletionMessage>,
	env: Bindings,
): Promise<void> => {
	const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
	for (const message of batch.messages) {
		try {
			await completeWord({ db, apiKey: env.GEMINI_API_KEY }, message.body);
			message.ack();
		} catch (error) {
			console.error("word completion failed", message.body.wordId, error);
			if (message.attempts >= MAX_COMPLETION_ATTEMPTS) {
				await markWordCompletionFailed(db, message.body.wordId).catch(() => {});
				message.ack();
			} else {
				message.retry();
			}
		}
	}
};
