import { and, asc, eq, ne } from "drizzle-orm";
import { COMPLETABLE_FIELDS, type CompletableField } from "@hudeato/schema";
import { word, wordMeaning } from "../../db";
import type { Db } from "../../types/words-route-type";
import type { MeaningPatch, MergeResult } from "./completion";

// AI補完に必要な単語+意味を取得し、補完結果を反映するDBクエリ層。
// study/repository.ts と同様に word / word_meaning を直接扱う。

// 補完対象の意味1件（補完で埋めうるフィールドのみ）。
export interface CompletionMeaningRow {
	id: string;
	slot: number;
	meaning: string;
	partOfSpeech: string | null;
	phonetic: string | null;
	example: string | null;
	collocation: string | null;
	synonym: string | null;
	etymology: string | null;
}

export interface WordForCompletion {
	id: string;
	text: string;
	meanings: CompletionMeaningRow[];
}

// 補完対象の単語を所有スコープ(userId/wordSetId)で取得する。存在しなければ null。
export const findWordForCompletion = async (
	db: Db,
	userId: string,
	wordSetId: string,
	wordId: string,
): Promise<WordForCompletion | null> => {
	const row = await db.query.word.findFirst({
		where: and(
			eq(word.userId, userId),
			eq(word.wordSetId, wordSetId),
			eq(word.id, wordId),
		),
		columns: { id: true, text: true },
		with: {
			meanings: {
				orderBy: [asc(wordMeaning.slot)],
				columns: {
					id: true,
					slot: true,
					meaning: true,
					partOfSpeech: true,
					phonetic: true,
					example: true,
					collocation: true,
					synonym: true,
					etymology: true,
				},
			},
		},
	});
	return row ?? null;
};

const isBlank = (v: string | null | undefined): boolean =>
	v == null || v.trim() === "";

// 補完結果（空欄への更新＋新規語義）を反映し、word.completionStatus を 'done' にする。
// 更新・挿入・ステータス更新を1トランザクションで行う。
// fillBlanksOnly のとき（空欄のみ補完）は、生成中に入ったユーザー編集を
// 上書きしないよう、トランザクション内で意味を読み直し
// 「今も空欄のフィールド」だけを更新し、埋まったスロットへの追加は捨てる。
export const applyWordCompletion = async (
	db: Db,
	wordId: string,
	merge: MergeResult,
	options?: { fillBlanksOnly?: boolean },
): Promise<void> => {
	const fillBlanksOnly = options?.fillBlanksOnly ?? false;
	await db.transaction(async (tx) => {
		let updates = merge.updates;
		let inserts = merge.inserts;
		if (fillBlanksOnly) {
			const fresh = await tx
				.select()
				.from(wordMeaning)
				.where(eq(wordMeaning.wordId, wordId));
			const byId = new Map(fresh.map((m) => [m.id, m]));
			updates = merge.updates.flatMap((update): MeaningPatch[] => {
				const current = byId.get(update.id);
				// 生成中に意味が削除された場合はスキップ
				if (!current) return [];
				const patch: Partial<Record<CompletableField, string>> = {};
				for (const field of COMPLETABLE_FIELDS) {
					const next = update.patch[field];
					if (next != null && isBlank(current[field])) {
						patch[field] = next;
					}
				}
				return Object.keys(patch).length > 0
					? [{ id: update.id, patch }]
					: [];
			});
			const usedSlots = new Set(fresh.map((m) => m.slot));
			inserts = merge.inserts.filter((m) => !usedSlots.has(m.slot));
		}
		for (const update of updates) {
			await tx
				.update(wordMeaning)
				.set(update.patch)
				.where(eq(wordMeaning.id, update.id));
		}
		if (inserts.length > 0) {
			await tx.insert(wordMeaning).values(
				inserts.map((m) => ({
					id: crypto.randomUUID(),
					wordId,
					...m,
				})),
			);
		}
		await tx
			.update(word)
			.set({ completionStatus: "done" })
			.where(eq(word.id, wordId));
	});
};

// 補完を失敗として記録する（リトライ上限超過時）。
// pending の場合のみ遷移させる（遅延した古いリトライが、後続の成功による
// done を failed に倒すのを防ぐ）。
export const markWordCompletionFailed = async (
	db: Db,
	wordId: string,
): Promise<void> => {
	await db
		.update(word)
		.set({ completionStatus: "failed" })
		.where(and(eq(word.id, wordId), eq(word.completionStatus, "pending")));
};

// 再補完の開始時に補完中(pending)へ戻す（P1-6）。所有スコープで絞る。
// すでに pending の場合は遷移せず false を返す（多重エンキューの防止）。
export const markWordCompletionPending = async (
	db: Db,
	userId: string,
	wordSetId: string,
	wordId: string,
): Promise<boolean> => {
	const result = await db
		.update(word)
		.set({ completionStatus: "pending" })
		.where(
			and(
				eq(word.id, wordId),
				eq(word.userId, userId),
				eq(word.wordSetId, wordSetId),
				ne(word.completionStatus, "pending"),
			),
		);
	return result.rowsAffected > 0;
};
