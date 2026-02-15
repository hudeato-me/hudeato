import { getRedis, RedisParams } from "./redis";

const PREFIX = "auth:";

export const upstashSecondaryStorage = (
	{
		upstashRedisRestUrl,
		upstashRedisRestToken,
	}: RedisParams
) => {
	const redis = getRedis({
		upstashRedisRestUrl,
		upstashRedisRestToken,
	});
	return {
		get: async (key: string) => {
			return await redis.get<string>(PREFIX + key);
		},

		set: async (key: string, value: string, ttl?: number) => {
			if (typeof ttl === "number" && ttl > 0) {
				await redis.set(PREFIX + key, value, { ex: ttl });
			} else {
				await redis.set(PREFIX + key, value);
			}
		},

		delete: async (key: string) => {
			await redis.del(PREFIX + key);
		},
	}
};

