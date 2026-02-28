import { createDb } from "../../db";
import {
	countData,
	findWordById,
	findWords,
	findWordsBySet,
	getActivityTimestamps,
} from "./repository";

import { Db } from "../../types/words-route-type";

// サービス関数を定義

// 単語一覧を取得
export const getWords = async (
	db: Db,
	userId: string,
	options?: { wordSetId?: string; limit?: number; offset?: number },
) => {
	const wordSetId = options?.wordSetId;

	if (wordSetId) {
		const words = await findWordsBySet(db, userId, wordSetId, options);
		return words;
	} else {
		const words = await findWords(db, userId, options);
		return words;
	}
};

// 単語詳細情報を取得
export const getWordById = async (
	db: Db,
	userId: string,
	wordSetId: string,
	wordId: string,
) => {
	const word = await findWordById(db, userId, wordSetId, wordId);
	if (!word) return null;

	return word;
};

// ダッシュボードの情報を取得
export const getDashboard = async (
	db: Db,
	userId: string,
	wordSetId: string,
) => {
	const [counts, recentWords, activityTimestamps] = await Promise.all([
		countData(db, userId),
		findWordsBySet(db, userId, wordSetId, { limit: 10 }),
		getActivityTimestamps(db, userId),
	]);

	const summary = {
		totalWords: counts.total,
		masteredWords: counts.mastered,
		activityTimestamps,
		recentWords: recentWords.map((item) => ({
			id: item.id,
			text: item.text,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
			// 複数の意味を,で結合して返す
			meaning: item.meanings.length > 0 ? item.meanings.map(m => m.meaning).join(", ") : null,
		})),
	};
	return summary;
};
