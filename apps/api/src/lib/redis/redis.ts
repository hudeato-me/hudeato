import { Redis } from "@upstash/redis/cloudflare";

export type RedisParams = {
	upstashRedisRestUrl: string;
	upstashRedisRestToken: string;
}
export const getRedis = (
	{
		upstashRedisRestUrl,
		upstashRedisRestToken,
	}: RedisParams
) => {
	return new Redis({
		url: upstashRedisRestUrl,
		token: upstashRedisRestToken,
	});
}
