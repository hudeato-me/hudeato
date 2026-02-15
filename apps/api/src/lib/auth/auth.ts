import { Context } from "hono";
import { betterAuthConfig } from "./better-auth-config";

const getAuth = (c: Context) => {
	return betterAuthConfig(
		{
			tursoDatabaseUrl: c.env.TURSO_DATABASE_URL,
			tursoAuthToken: c.env.TURSO_AUTH_TOKEN,
			betterAuthBaseUrl: c.env.BETTER_AUTH_BASE_URL,
			upstashRedisRestUrl: c.env.UPSTASH_REDIS_REST_URL,
			upstashRedisRestToken: c.env.UPSTASH_REDIS_REST_TOKEN,
		}
	)
};

export default getAuth;
