import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { createDb } from "./db";
import getAuth from "./lib/auth/auth";
import { RedisParams } from "./lib/redis/redis";
import { handlePolarWebhook } from "./polar";
import { Bindings, WordsRouteVariables } from "./types";
import words from "./routes/words";
import dashboard from "./routes/dashboard";
import wordSets from "./routes/word-sets";
import { rateLimiter } from "./utils/rate-limiter";

const app = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>();

// ログインしているか検証し、その後の処理で使う DB やユーザー情報をまとめて次に渡す
const protectedMiddleware = createMiddleware<{
	Bindings: Bindings;
	Variables: WordsRouteVariables;
}>(async (c, next) => {
	const auth = getAuth(c);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const db = createDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
	const redisParams: RedisParams = {
		upstashRedisRestUrl: c.env.UPSTASH_REDIS_REST_URL,
		upstashRedisRestToken: c.env.UPSTASH_REDIS_REST_TOKEN,
	};

	c.set("userId", session.user.id);
	c.set("db", db);
	c.set("redisParams", redisParams);

	await next();
});

app.use(
	"*",
	cors({
		origin: ["http://localhost:3000", "http://localhost:5173"], // Add your client URLs
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
		credentials: true,
	}),
);

app.onError((err, c) => {
	console.error("Global Error Handler:", err);
	return c.text("Internal Server Error", 500);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
	console.log("Request to /api/auth/*");
	console.log("DB URL:", c.env.TURSO_DATABASE_URL);
	try {
		const auth = getAuth(c);
		return auth.handler(c.req.raw);
	} catch (e) {
		console.error("Error in auth handler:", e);
		throw e;
	}
});

app.post("/api/webhooks/polar", handlePolarWebhook);


const api = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()
	.use("*", protectedMiddleware)
	.use("*", rateLimiter)
	.route("/v1/sets", wordSets)
	.route("/v1/sets/:setId/words", words)
	.route("/dashboard", dashboard);

// .route() の戻り値をチェーンして型を伝搬させる（Hono RPC に必要）
const routes = app.route("/api", api);

app.get("/", (c) => {
	return c.text("Hello Hono on Cloudflare Workers!");
});

app.get("/health", (c) => {
	return c.json({ status: "ok" });
});

export default app;
export type AppType = typeof routes;
