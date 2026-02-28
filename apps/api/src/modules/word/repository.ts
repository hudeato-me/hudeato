import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { createDb, wordMeaning } from "../../db";
import { word } from "../../db";

import { Db } from "../../types/words-route-type";

// SQLクエリの関数を定義

// 全てのセットから単語を取得（いつ使うか分からないけど）
// 単語・意味・createdAt・updatedAtを返す
// limitとoffsetでページネーション追加
export const findWords = async (db: Db, userId: string, options?: { limit?: number; offset?: number }) => {
	return db.query.word.findMany({
		where: eq(word.userId, userId),
		orderBy: [desc(word.createdAt)],
		...(options?.limit ? { limit: options.limit } : {}),
		...(options?.offset ? { offset: options.offset } : {}),
		columns: {
			id: true,
			text: true,
			createdAt: true,
			updatedAt: true,
		},
		with: {
			meanings: {
				orderBy: [asc(wordMeaning.slot)],
				columns: {
					meaning: true,
				},
			},
		},
	});
};

// セット内の単語を取得（Recent Wordsと一覧リスト用・ページネーション未実装）
export const findWordsBySet = async (
	db: Db,
	userId: string,
	wordSetId: string,
	options?: { limit?: number; offset?: number },
) => {
	return db.query.word.findMany({
		where: and(eq(word.userId, userId), eq(word.wordSetId, wordSetId)),
		orderBy: [desc(word.createdAt)],
		...(options?.limit ? { limit: options.limit } : {}),
		...(options?.offset ? { offset: options.offset } : {}),
		columns: {
			id: true,
			text: true,
			isMastered: true,
			createdAt: true,
			updatedAt: true,
		},
		with: {
			meanings: {
				orderBy: [asc(wordMeaning.slot)],
				columns: {
					meaning: true,
					partOfSpeech: true,
				},
			},
		},
	});
};

// ダッシュボード用に全セットのWordsとMasteredをSQLで集計
export const countData = async (db: Db, userId: string) => {
	const result = await db
		.select({
			total: count(),
			mastered: count(sql`CASE WHEN ${word.isMastered} = true THEN 1 END`),
		})
		.from(word)
		.where(eq(word.userId, userId));

	return {
		total: result[0].total,
		mastered: result[0].mastered,
	};
};

// 単語の取得（単語編集ページ用）
export const findWordById = async (db: Db, userId: string, wordId: string) => {
	return db.query.word.findFirst({
		where: and(eq(word.userId, userId), eq(word.id, wordId)),
		columns: {
			id: true,
			wordSetId: true,
			text: true,
			locationLabel: true,
			imageKey: true,
			isMastered: true,
			lastReviewedAt: true,
			createdAt: true,
			updatedAt: true,
		},
		with: {
			meanings: {
				orderBy: [asc(wordMeaning.slot)],
				columns: {
					meaning: true,
					partOfSpeech: true,
					phonetic: true,
					example: true,
					collocation: true,
					synonym: true,
					etymology: true,
					source: true,
					slot: true,
					isRemembered: true,
					createdAt: true,
					updatedAt: true,
				},
			},
		},
	});
};

// 過去70日分の単語の作成日時を取得（Activity用）
export const getActivityTimestamps = async (db: Db, userId: string) => {
	const result = await db.query.word.findMany({
		where: and(
			eq(word.userId, userId),
			sql`${word.createdAt} >= (cast(unixepoch('now', '-70 days') * 1000 as integer))`
		),
		columns: {
			createdAt: true,
		},
	});
	return result.map((r) => r.createdAt?.getTime() ?? 0);
};
