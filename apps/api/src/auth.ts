import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Context } from "hono";
import { createDb } from "./db";
import { openAPI } from "better-auth/plugins"

const getAuth = (c: Context) => {
	const db = createDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
		}),
		emailAndPassword: {
			enabled: true,
		},
		plugins: [openAPI()],
		baseURL: c.env.BETTER_AUTH_BASE_URL,
		// socialProviders: {
		//   github: {
		//     clientId: c.env.GITHUB_CLIENT_ID,
		//     clientSecret: c.env.GITHUB_CLIENT_SECRET,
		//   }
		// }
	});
};

export default getAuth;
