import { createDb } from "../../db";
import { getRedis, RedisParams } from "../../lib/redis/redis";
import {
	countData,
	findWordById,
	findWords,
	findWordsBySet,
} from "./repository";

type Db = ReturnType<typeof createDb>;

const CACHE_TTL = 3600;

export const getWords = async (
	db: Db,
	redisParams: RedisParams,
	userId: string,
	options?: { wordSetId?: string },
) => {
	const redis = getRedis(redisParams);
	const wordSetId = options?.wordSetId;

	if (wordSetId) {
		const cacheKey = `user:${userId}:wordset:${wordSetId}:words`;
		const cached = await redis.get<Awaited<ReturnType<typeof findWordsBySet>>>(cacheKey);
		if (cached) return cached;

		const words = await findWordsBySet(db, userId, wordSetId);
		await redis.setex(cacheKey, CACHE_TTL, words);
		return words;
	} else {
		const cacheKey = `user:${userId}:words:list`;
		const cached = await redis.get<Awaited<ReturnType<typeof findWords>>>(cacheKey);
		if (cached) return cached;

		const words = await findWords(db, userId);
		await redis.setex(cacheKey, CACHE_TTL, words);
		return words;
	}
};

export const getWordById = async (
	db: Db,
	redisParams: RedisParams,
	userId: string,
	wordId: string,
) => {
	const redis = getRedis(redisParams);
	const cacheKey = `user:${userId}:word:${wordId}`;

	const cached = await redis.get<Awaited<ReturnType<typeof findWordById>>>(cacheKey);
	if (cached !== null) return cached;

	const word = await findWordById(db, userId, wordId);
	if (!word) return null;

	await redis.setex(cacheKey, CACHE_TTL, word);
	return word;
};

export const getDashboard = async (
	db: Db,
	_redisParams: RedisParams,
	userId: string,
	wordSetId: string,
) => {
	const [counts, recentWords] = await Promise.all([
		countData(db, userId),
		findWordsBySet(db, userId, wordSetId, { limit: 10 }),
	]);

	const summary = {
		totalWords: counts.total,
		masteredWords: counts.mastered,
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

export const invalidateUserWordsCache = async (
	redisParams: RedisParams,
	userId: string,
	wordSetId?: string,
	wordId?: string,
) => {
	const redis = getRedis(redisParams);
	const keys = [
		`user:${userId}:words:list`,
	];
	if (wordSetId) {
		keys.push(`user:${userId}:wordset:${wordSetId}:words`);
	}
	if (wordId) {
		keys.push(`user:${userId}:word:${wordId}`);
	}
	await redis.del(...keys);
};
