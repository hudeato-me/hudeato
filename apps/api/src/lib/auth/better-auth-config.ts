import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { createDb } from "../../db";
import { upstashSecondaryStorage } from "../redis/auth-storage";

export interface BetterAuthConfigType {
	tursoDatabaseUrl: string;
	tursoAuthToken: string;

	betterAuthBaseUrl: string;

	upstashRedisRestUrl: string;
	upstashRedisRestToken: string;
}

export const betterAuthConfig = (
	{
		tursoDatabaseUrl,
		tursoAuthToken,
		betterAuthBaseUrl,
		upstashRedisRestUrl,
		upstashRedisRestToken,
	}: BetterAuthConfigType
) => {
	const db = createDb(tursoDatabaseUrl, tursoAuthToken);
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
		}),
		secondaryStorage: upstashSecondaryStorage({
			upstashRedisRestUrl,
			upstashRedisRestToken,
		}),
		emailAndPassword: {
			enabled: true,
		},
		plugins: [openAPI()],
		baseURL: betterAuthBaseUrl,
		trustedOrigins: (request) => {
			const origin = request?.headers.get("origin")
			if (!origin) return []
			// localhost / 127.0.0.1 / RFC1918 private IPs を任意ポートで許可（開発用）
			const devOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):\d+$/
			if (devOriginPattern.test(origin)) return [origin]
			return []
		},
	})
}
