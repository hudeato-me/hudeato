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
		trustedOrigins: ["http://localhost:3000", "http://localhost:5173", "http://192.168.10.103:3000"],
	})
}
