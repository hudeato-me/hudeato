import { Context } from "hono";
import { betterAuthConfig } from "../lib/auth/better-auth-config";

const getAuth = (c: Context) => {
	return betterAuthConfig({
		tursoDatabaseUrl: process.env.TURSO_DATABASE_URL!,
		tursoAuthToken: process.env.TURSO_AUTH_TOKEN!,
		betterAuthBaseUrl: process.env.BETTER_AUTH_BASE_URL!,
		upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL!,
		upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN!,
	});
};

export default getAuth;
