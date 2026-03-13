// processが見つかりませんのエラーの解決のため追加
/// <reference types="node" />

import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/index.ts",
	out: "./migrations",
	dialect: "turso",
	dbCredentials: {
		url: process.env.TURSO_DATABASE_URL!,
		authToken: process.env.TURSO_AUTH_TOKEN,
	},
});
