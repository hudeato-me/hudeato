import { and, asc, count, desc, eq, like, sql } from "drizzle-orm";
import { createDb, wordMeaning, wordSet } from "../../db";
import { word } from "../../db";

import { Db } from "../../types/words-route-type";

// SQLクエリの関数を定義

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
export const findWordById = async (db: Db, userId: string, wordSetId: string, wordId: string) => {
	return db.query.word.findFirst({
		where: and(eq(word.userId, userId), eq(word.wordSetId, wordSetId), eq(word.id, wordId)),
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

// ユーザーのwordSet一覧を取得
export const findWordSets = async (db: Db, userId: string) => {
	return db.query.wordSet.findMany({
		where: eq(wordSet.userId, userId),
		orderBy: [desc(wordSet.createdAt)],
		columns: {
			id: true,
			name: true,
			createdAt: true,
			updatedAt: true,
		},
	});
};

// 単語の検索（リアルタイム検索用）
export const searchWords = async (
	db: Db,
	userId: string,
	wordSetId: string,
	query: string,
	limit: number = 10,
) => {
	const searchQuery = `%${query}%`;

	return db.query.word.findMany({
		where: and(
			eq(word.userId, userId),
			eq(word.wordSetId, wordSetId),
			like(word.text, searchQuery),
		),
		orderBy: [desc(word.createdAt)],
		limit: limit,
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

// WordSetの作成
export const insertWordSet = async (db: Db, userId: string, id: string, name: string) => {
	await db.insert(wordSet).values({
		id,
		userId,
		name,
	});
};

// WordSetの名前更新
export const updateWordSetName = async (db: Db, userId: string, wordSetId: string, name: string) => {
	await db
		.update(wordSet)
		.set({ name })
		.where(and(eq(wordSet.id, wordSetId), eq(wordSet.userId, userId)));
};

// WordSetの削除
export const deleteWordSetById = async (db: Db, userId: string, wordSetId: string) => {
	await db
		.delete(wordSet)
		.where(and(eq(wordSet.id, wordSetId), eq(wordSet.userId, userId)));
};

// 単語の作成 (意味も同時)
export const insertWord = async (
	db: Db,
	userId: string,
	wordSetId: string,
	wordId: string,
	data: {
		text: string;
		locationLabel?: string | null;
		imageKey?: string | null;
	},
	meanings: Array<{
		id: string;
		meaning: string;
		partOfSpeech?: string | null;
		phonetic?: string | null;
		example?: string | null;
		collocation?: string | null;
		synonym?: string | null;
		etymology?: string | null;
		source?: string | null;
		slot: number;
	}>
) => {
	await db.transaction(async (tx) => {
		await tx.insert(word).values({
			id: wordId,
			userId,
			wordSetId,
			text: data.text,
			locationLabel: data.locationLabel,
			imageKey: data.imageKey,
		});

		if (meanings.length > 0) {
			const meaningsWithWordId = meanings.map((m) => ({
				...m,
				wordId,
			}));
			await tx.insert(wordMeaning).values(meaningsWithWordId);
		}
	});
};

// 単語の更新 (意味の洗い替え)
export const updateWordData = async (
	db: Db,
	userId: string,
	wordSetId: string,
	wordId: string,
	data: {
		text: string;
		locationLabel?: string | null;
		imageKey?: string | null;
	},
	meanings: Array<{
		id: string;
		meaning: string;
		partOfSpeech?: string | null;
		phonetic?: string | null;
		example?: string | null;
		collocation?: string | null;
		synonym?: string | null;
		etymology?: string | null;
		source?: string | null;
		slot: number;
	}>
) => {
	await db.transaction(async (tx) => {
		// まずWordデータ更新
		await tx
			.update(word)
			.set({
				text: data.text,
				locationLabel: data.locationLabel ?? null,
				imageKey: data.imageKey ?? null,
			})
			.where(and(eq(word.id, wordId), eq(word.userId, userId), eq(word.wordSetId, wordSetId)));

		// 既存の意味を削除して洗い替え
		await tx
			.delete(wordMeaning)
			.where(eq(wordMeaning.wordId, wordId));

		if (meanings.length > 0) {
			const meaningsWithWordId = meanings.map((m) => ({
				...m,
				wordId,
			}));
			await tx.insert(wordMeaning).values(meaningsWithWordId);
		}
	});
};

// 単語の削除
export const deleteWordById = async (db: Db, userId: string, wordSetId: string, wordId: string) => {
	await db
		.delete(word)
		.where(and(eq(word.id, wordId), eq(word.userId, userId), eq(word.wordSetId, wordSetId)));
};
