import { and, asc, eq } from "drizzle-orm";
import { word, wordMeaning } from "../../db";
import type { Db } from "../../types/words-route-type";
import type { MergeResult } from "./completion";

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

// 補完結果（空欄への更新＋新規語義）を反映し、word.completionStatus を 'done' にする。
// 更新・挿入・ステータス更新を1トランザクションで行う。
export const applyWordCompletion = async (
	db: Db,
	wordId: string,
	merge: MergeResult,
): Promise<void> => {
	await db.transaction(async (tx) => {
		for (const update of merge.updates) {
			await tx
				.update(wordMeaning)
				.set(update.patch)
				.where(eq(wordMeaning.id, update.id));
		}
		if (merge.inserts.length > 0) {
			await tx.insert(wordMeaning).values(
				merge.inserts.map((m) => ({
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
export const markWordCompletionFailed = async (
	db: Db,
	wordId: string,
): Promise<void> => {
	await db
		.update(word)
		.set({ completionStatus: "failed" })
		.where(eq(word.id, wordId));
};
