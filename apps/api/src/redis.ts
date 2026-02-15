import { Redis } from "@upstash/redis/cloudflare";

export const createRedis = (url: string, token: string) => {
	return new Redis({
		url,
		token,
	});
};
