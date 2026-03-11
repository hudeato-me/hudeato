import { createDb } from "../../db";
import {
	countData,
	findWordById,
	findWordSets,
	findWordsBySet,
	getActivityTimestamps,
	searchWords,
	insertWordSet,
	updateWordSetName,
	updateWordSetSettings,
	deleteWordSetById,
	insertWord,
	updateWordData,
	deleteWordById,
} from "./repository";

import { Db } from "../../types/words-route-type";

// サービス関数を定義

// 単語一覧を取得
export const getWords = async (
	db: Db,
	userId: string,
	options: { wordSetId: string; limit?: number; offset?: number },
) => {
	const words = await findWordsBySet(db, userId, options.wordSetId, options);
	return words;
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

// ユーザーのwordSet一覧を取得
export const getWordSets = async (
	db: Db,
	userId: string,
) => {
	const wordSets = await findWordSets(db, userId);
	return wordSets;
};

// 単語を検索する
export const searchWordList = async (
	db: Db,
	userId: string,
	wordSetId: string,
	query: string,
	limit?: number,
) => {
	if (!query.trim()) return [];

	const results = await searchWords(db, userId, wordSetId, query, limit);
	return results;
};

// 単語の作成
export const createWord = async (
	db: Db,
	userId: string,
	wordSetId: string,
	data: { text: string; locationLabel?: string | null; imageKey?: string | null },
	meanings: Array<{
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
	const wordId = crypto.randomUUID();
	const meaningsWithId = meanings.map((m) => ({ ...m, id: crypto.randomUUID() }));
	await insertWord(db, userId, wordSetId, wordId, data, meaningsWithId);
	return { id: wordId };
};

// 単語の更新
export const updateWord = async (
	db: Db,
	userId: string,
	wordSetId: string,
	wordId: string,
	data: { text: string; locationLabel?: string | null; imageKey?: string | null },
	meanings: Array<{
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
	const meaningsWithId = meanings.map((m) => ({ ...m, id: crypto.randomUUID() }));
	await updateWordData(db, userId, wordSetId, wordId, data, meaningsWithId);
};

// 単語の削除
export const removeWord = async (db: Db, userId: string, wordSetId: string, wordId: string) => {
	await deleteWordById(db, userId, wordSetId, wordId);
};

// WordSetの作成
export const createWordSet = async (db: Db, userId: string, name: string) => {
	const id = crypto.randomUUID();
	await insertWordSet(db, userId, id, name);
	return { id, name };
};

// WordSetの更新
export const updateWordSet = async (db: Db, userId: string, wordSetId: string, name: string) => {
	await updateWordSetName(db, userId, wordSetId, name);
};

// WordSetの設定更新
export const updateWordSetSettingsService = async (db: Db, userId: string, wordSetId: string, settings: string) => {
	await updateWordSetSettings(db, userId, wordSetId, settings);
};

// WordSetの削除
export const removeWordSet = async (db: Db, userId: string, wordSetId: string) => {
	await deleteWordSetById(db, userId, wordSetId);
};
