import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Context } from "hono";
import { createDb } from "../db";

const getAuth = (c: Context) => {
	const db = createDb(process.env.TURSO_DATABASE_URL!, process.env.TURSO_AUTH_TOKEN!);
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
		}),
		emailAndPassword: {
			enabled: true,
		},
		baseURL: process.env.BETTER_AUTH_BASE_URL,
		// socialProviders: {
		//   github: {
		//     clientId: c.env.GITHUB_CLIENT_ID,
		//     clientSecret: c.env.GITHUB_CLIENT_SECRET,
		//   }
		// }
	});
};

export default getAuth;
