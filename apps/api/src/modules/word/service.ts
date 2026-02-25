import { createDb } from "../../db";
import {
	countData,
	findWordById,
	findWords,
	findWordsBySet,
	getActivityTimestamps,
} from "./repository";

type Db = ReturnType<typeof createDb>;

export const getWords = async (
	db: Db,
	userId: string,
	options?: { wordSetId?: string },
) => {
	const wordSetId = options?.wordSetId;

	if (wordSetId) {
		const words = await findWordsBySet(db, userId, wordSetId);
		return words;
	} else {
		const words = await findWords(db, userId);
		return words;
	}
};

export const getWordById = async (
	db: Db,
	userId: string,
	wordId: string,
) => {
	const word = await findWordById(db, userId, wordId);
	if (!word) return null;

	return word;
};

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
			meaning: item.meanings[0]?.meaning ?? null,
		})),
	};
	return summary;
};
