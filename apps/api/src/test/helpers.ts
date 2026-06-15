import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "../db";
import type { TestContext } from "./setup";

/**
 * テストDBファイルに対してフルスキーマ(auth + word + 学習系)の Drizzle ハンドルを生成する。
 * repository の単体テストや、ルートのテスト用ミドルウェアで使う。
 */
export function createTestDb(ctx: TestContext) {
	return createDb(`file:${ctx.dbPath}`);
}

// ---------------------------------------------------------------------------
// テスト用 Hono app の生成
// ---------------------------------------------------------------------------

/**
 * テスト用のHonoアプリを生成する。
 * 本番の index.ts と同じルーティングだが、env からではなく
 * TestContext の auth インスタンスを直接使用する。
 */
export function createTestApp(ctx: TestContext) {
	const app = new Hono();

	app.use(
		"*",
		cors({
			origin: ["http://localhost"],
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	);

	app.onError((err, c) => {
		console.error("Test App Error:", err);
		return c.text("Internal Server Error", 500);
	});

	app.on(["POST", "GET"], "/api/auth/*", (c) => {
		return ctx.auth.handler(c.req.raw);
	});

	app.get("/", (c) => {
		return c.text("Hello Hono on Cloudflare Workers!");
	});

	app.get("/health", (c) => {
		return c.json({ status: "ok" });
	});

	app.get("/api/protected", async (c) => {
		const session = await ctx.auth.api.getSession({
			headers: c.req.raw.headers,
		});

		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		return c.json({
			message: "This is protected data",
			user: session.user,
		});
	});

	return app;
}

// ---------------------------------------------------------------------------
// リクエストヘルパー
// ---------------------------------------------------------------------------

interface SignUpData {
	email: string;
	password: string;
	name: string;
}

interface SignInData {
	email: string;
	password: string;
}

/**
 * ユーザー登録
 */
export async function signUp(app: Hono, data: SignUpData) {
	return app.request("/api/auth/sign-up/email", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

/**
 * メールでログイン
 */
export async function signIn(app: Hono, data: SignInData) {
	return app.request("/api/auth/sign-in/email", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
}

/**
 * Set-Cookie ヘッダからセッション関連のCookieを抽出
 */
export function extractCookies(res: Response): string {
	const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
	if (setCookieHeaders.length === 0) {
		// fallback: get-set-cookie が使えない環境
		const raw = res.headers.get("set-cookie");
		if (!raw) return "";
		return raw
			.split(",")
			.map((c) => c.split(";")[0].trim())
			.join("; ");
	}
	return setCookieHeaders.map((c) => c.split(";")[0].trim()).join("; ");
}

/**
 * セッションCookie付きでGETリクエスト
 */
export async function requestWithSession(
	app: Hono,
	path: string,
	cookie: string,
) {
	return app.request(path, {
		method: "GET",
		headers: { Cookie: cookie },
	});
}

/**
 * セッションCookie付きで任意メソッドのJSONリクエストを送る汎用ヘルパー。
 * body 未指定なら本文なし（GET/DELETE 等）で送る。
 */
export async function requestJson(
	app: Hono,
	method: string,
	path: string,
	cookie: string,
	body?: unknown,
) {
	const headers: Record<string, string> = { Cookie: cookie };
	if (body !== undefined) headers["Content-Type"] = "application/json";
	return app.request(path, {
		method,
		headers,
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	});
}

/**
 * サインアウト
 */
export async function signOut(app: Hono, cookie: string) {
	return app.request("/api/auth/sign-out", {
		method: "POST",
		headers: {
			Cookie: cookie,
			"Content-Type": "application/json",
		},
	});
}

/**
 * ユーザー登録 → ログイン → Cookie取得 の一気通貫ヘルパー
 */
export async function signUpAndGetSession(
	app: Hono,
	data: SignUpData = {
		email: "test@example.com",
		password: "password123456",
		name: "Test User",
	},
) {
	await signUp(app, data);
	const signInRes = await signIn(app, {
		email: data.email,
		password: data.password,
	});
	const cookie = extractCookies(signInRes);
	return { signInRes, cookie };
}
