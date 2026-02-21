import { createDb } from "../../db";
import { getRedis, RedisParams } from "../../lib/redis/redis";
import { findWordSets } from "./repository";

type Db = ReturnType<typeof createDb>;

const CACHE_TTL = 3600;

export const getWordSets = async (
	db: Db,
	redisParams: RedisParams,
	userId: string,
) => {
	const redis = getRedis(redisParams);
	const cacheKey = `user:${userId}:wordsets:list`;

	const cached = await redis.get<Awaited<ReturnType<typeof findWordSets>>>(cacheKey);
	if (cached) return cached;

	const wordSets = await findWordSets(db, userId);
	await redis.setex(cacheKey, CACHE_TTL, wordSets);
	return wordSets;
};

export const invalidateWordSetsCache = async (
	redisParams: RedisParams,
	userId: string,
) => {
	const redis = getRedis(redisParams);
	await redis.del(`user:${userId}:wordsets:list`);
};
