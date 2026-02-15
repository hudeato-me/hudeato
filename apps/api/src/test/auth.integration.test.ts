import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { account as accountTable, user as userTable } from "../db/auth-schema";
import {
	createTestApp,
	extractCookies,
	requestWithSession,
	signIn,
	signOut,
	signUp
} from "./helpers";
import { createTestContext, type TestContext } from "./setup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

// ===========================================================================
// Auth 結合テスト
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	app = createTestApp(ctx);
});

afterAll(() => {
	ctx.cleanup();
});

// ---------------------------------------------------------------------------
// Story 1: 新規ユーザー登録 🆕
// ---------------------------------------------------------------------------
describe("Story 1: 新規ユーザー登録", () => {
	it("1-1: 正常な登録ができる", async () => {
		const res = await signUp(app, {
			email: "newuser@example.com",
			password: "securePassword123",
			name: "New User",
		});

		expect(res.status).toBe(200);

		const body: Json = await res.json();
		expect(body.user).toBeDefined();
		expect(body.user.email).toBe("newuser@example.com");
		expect(body.user.name).toBe("New User");
	});

	it("1-2: 重複メールで登録するとエラーになる", async () => {
		// まず1件登録
		await signUp(app, {
			email: "duplicate@example.com",
			password: "password123456",
			name: "First User",
		});

		// 同じメールで再度登録
		const res = await signUp(app, {
			email: "duplicate@example.com",
			password: "anotherPassword123",
			name: "Second User",
		});

		// better-auth は重複メールで 2xx 以外を返す
		expect(res.status).not.toBe(200);
	});

	it("1-3: パスワードが短すぎるとエラーになる", async () => {
		const res = await signUp(app, {
			email: "shortpw@example.com",
			password: "123",
			name: "Short PW User",
		});

		// better-auth のデフォルトパスワードポリシーを超えないためエラー
		expect(res.status).not.toBe(200);
	});

	it("1-4: メール形式が不正だとエラーになる", async () => {
		const res = await signUp(app, {
			email: "not-an-email",
			password: "password123456",
			name: "Bad Email User",
		});

		expect(res.status).not.toBe(200);
	});
});

// ---------------------------------------------------------------------------
// Story 2: ログイン・セッション管理 🔐
// ---------------------------------------------------------------------------
describe("Story 2: ログイン・セッション管理", () => {
	const testUser = {
		email: "login-test@example.com",
		password: "loginPassword123",
		name: "Login Test User",
	};

	beforeAll(async () => {
		// テスト用ユーザーを事前登録
		await signUp(app, testUser);
	});

	it("2-1: 正常にログインできる", async () => {
		const res = await signIn(app, {
			email: testUser.email,
			password: testUser.password,
		});

		expect(res.status).toBe(200);

		// Set-Cookie にセッショントークンが含まれる
		const cookies = extractCookies(res);
		expect(cookies).toBeTruthy();
		expect(cookies.length).toBeGreaterThan(0);
	});

	it("2-2: ログイン後にセッション情報を取得できる", async () => {
		const signInRes = await signIn(app, {
			email: testUser.email,
			password: testUser.password,
		});
		const cookie = extractCookies(signInRes);

		const sessionRes = await requestWithSession(
			app,
			"/api/auth/get-session",
			cookie,
		);

		expect(sessionRes.status).toBe(200);
		const body: Json = await sessionRes.json();
		expect(body.user).toBeDefined();
		expect(body.user.email).toBe(testUser.email);
		expect(body.user.name).toBe(testUser.name);
	});

	it("2-3: 不正なパスワードではログインできない", async () => {
		const res = await signIn(app, {
			email: testUser.email,
			password: "wrongPassword999",
		});

		expect(res.status).not.toBe(200);
	});

	it("2-4: 存在しないメールではログインできない", async () => {
		const res = await signIn(app, {
			email: "nonexistent@example.com",
			password: "anyPassword123",
		});

		expect(res.status).not.toBe(200);
	});
});

// ---------------------------------------------------------------------------
// Story 3: 保護エンドポイントのアクセス制御 🛡️
// ---------------------------------------------------------------------------
describe("Story 3: 保護エンドポイントのアクセス制御", () => {
	const protectedUser = {
		email: "protected-test@example.com",
		password: "protectedPass123",
		name: "Protected User",
	};

	beforeAll(async () => {
		await signUp(app, protectedUser);
	});

	it("3-1: 認証なしでは401が返る", async () => {
		const res = await app.request("/api/protected", { method: "GET" });

		expect(res.status).toBe(401);
		const body: Json = await res.json();
		expect(body.error).toBe("Unauthorized");
	});

	it("3-2: 認証済みなら保護データにアクセスできる", async () => {
		const signInRes = await signIn(app, {
			email: protectedUser.email,
			password: protectedUser.password,
		});
		const cookie = extractCookies(signInRes);

		const res = await requestWithSession(app, "/api/protected", cookie);

		expect(res.status).toBe(200);
		const body: Json = await res.json();
		expect(body.message).toBe("This is protected data");
		expect(body.user).toBeDefined();
		expect(body.user.email).toBe(protectedUser.email);
	});

	it("3-3: 無効なセッションCookieでは401が返る", async () => {
		const res = await requestWithSession(
			app,
			"/api/protected",
			"better-auth.session_token=invalid-token-12345",
		);

		expect(res.status).toBe(401);
		const body: Json = await res.json();
		expect(body.error).toBe("Unauthorized");
	});
});

// ---------------------------------------------------------------------------
// Story 4: 公開エンドポイント ✅
// ---------------------------------------------------------------------------
describe("Story 4: 公開エンドポイント", () => {
	it("4-1: ルートエンドポイントが正常に応答する", async () => {
		const res = await app.request("/", { method: "GET" });

		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe("Hello Hono on Cloudflare Workers!");
	});

	it("4-2: ヘルスチェックが正常に応答する", async () => {
		const res = await app.request("/health", { method: "GET" });

		expect(res.status).toBe(200);
		const body: Json = await res.json();
		expect(body.status).toBe("ok");
	});
});

// ---------------------------------------------------------------------------
// Story 5: E2Eフルフロー 🔄
// ---------------------------------------------------------------------------
describe("Story 5: E2Eフルフロー", () => {
	it("5-1: 登録→ログイン→セッション→保護リソース→サインアウト の一連のフロー", async () => {
		const userData = {
			email: "e2e-flow@example.com",
			password: "e2eFlowPass123",
			name: "E2E Flow User",
		};

		// Step 1: ユーザー登録
		const signUpRes = await signUp(app, userData);
		expect(signUpRes.status).toBe(200);
		const signUpBody: Json = await signUpRes.json();
		expect(signUpBody.user.email).toBe(userData.email);

		// Step 2: ログイン
		const signInRes = await signIn(app, {
			email: userData.email,
			password: userData.password,
		});
		expect(signInRes.status).toBe(200);
		const cookie = extractCookies(signInRes);
		expect(cookie).toBeTruthy();

		// Step 3: セッション確認
		const sessionRes = await requestWithSession(
			app,
			"/api/auth/get-session",
			cookie,
		);
		expect(sessionRes.status).toBe(200);
		const sessionBody: Json = await sessionRes.json();
		expect(sessionBody.user.email).toBe(userData.email);
		expect(sessionBody.session).toBeDefined();

		// Step 4: 保護リソースにアクセス
		const protectedRes = await requestWithSession(
			app,
			"/api/protected",
			cookie,
		);
		expect(protectedRes.status).toBe(200);
		const protectedBody: Json = await protectedRes.json();
		expect(protectedBody.message).toBe("This is protected data");
		expect(protectedBody.user.email).toBe(userData.email);

		// Step 5: サインアウト
		const signOutRes = await signOut(app, cookie);
		expect(signOutRes.status).toBe(200);

		// Step 6: サインアウト後は保護リソースにアクセスできない
		const afterSignOutRes = await requestWithSession(
			app,
			"/api/protected",
			cookie,
		);
		expect(afterSignOutRes.status).toBe(401);
	});
});

// ---------------------------------------------------------------------------
// Story 6: データ層直接検証 (SQLite + Redis) 🔍
// ---------------------------------------------------------------------------
describe("Story 6: データ層直接検証", () => {
	const dbUser = {
		email: "db-verify@example.com",
		password: "dbVerifyPass123",
		name: "DB Verify User",
	};

	it("6-1: ユーザー登録後、SQLiteのuserテーブルにレコードが存在する", async () => {
		const res = await signUp(app, dbUser);
		expect(res.status).toBe(200);
		const body: Json = await res.json();
		const userId = body.user.id;

		// SQLiteを直接クエリ
		const rows = await ctx.db
			.select()
			.from(userTable)
			.where(eq(userTable.email, dbUser.email));

		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe(userId);
		expect(rows[0].name).toBe(dbUser.name);
		expect(rows[0].email).toBe(dbUser.email);
		expect(rows[0].emailVerified).toBe(false);
	});

	it("6-2: ユーザー登録後、accountテーブルに credential レコードが存在する", async () => {
		// 6-1で登録済のユーザーを検索
		const users = await ctx.db
			.select()
			.from(userTable)
			.where(eq(userTable.email, dbUser.email));
		const userId = users[0].id;

		const accounts = await ctx.db
			.select()
			.from(accountTable)
			.where(eq(accountTable.userId, userId));

		expect(accounts).toHaveLength(1);
		expect(accounts[0].providerId).toBe("credential");
		expect(accounts[0].userId).toBe(userId);
		// パスワードがハッシュ化されて保存されていることを確認
		expect(accounts[0].password).toBeTruthy();
		expect(accounts[0].password).not.toBe(dbUser.password); // 平文ではない
	});

	it("6-3: ログイン後、Redisにセッショントークンが保存される", async () => {
		// ログイン前のRedisキー数を記録
		const keysBefore = ctx.storage._keys();

		const signInRes = await signIn(app, {
			email: dbUser.email,
			password: dbUser.password,
		});
		expect(signInRes.status).toBe(200);

		// Redisモックを直接確認: ログイン後にキーが増えている
		const keysAfter = ctx.storage._keys();
		expect(keysAfter.length).toBeGreaterThan(keysBefore.length);

		// better-auth は `active-sessions-{userId}` キーにセッション一覧を保存する
		const activeSessionsKey = keysAfter.find((k) =>
			k.startsWith("active-sessions-"),
		);
		expect(activeSessionsKey).toBeDefined();

		// active-sessions にトークン情報が入っている
		const sessionsRaw = await ctx.storage.get(activeSessionsKey!);
		expect(sessionsRaw).toBeTruthy();
		const sessions = JSON.parse(sessionsRaw!) as Array<{
			token: string;
			expiresAt: number;
		}>;
		expect(sessions.length).toBeGreaterThan(0);

		// 各セッショントークンもRedisに個別キーとして存在する
		for (const session of sessions) {
			const tokenExists = ctx.storage._has(session.token);
			expect(tokenExists).toBe(true);
		}
	});

	it("6-4: サインアウト後、Redisのセッション状態が変化し、セッションが無効化される", async () => {
		// ログインしてセッション取得
		const signInRes = await signIn(app, {
			email: dbUser.email,
			password: dbUser.password,
		});
		const cookie = extractCookies(signInRes);

		// ログイン直後のRedis全体のスナップショット
		const entriesBefore = ctx.storage._entries();
		const snapshotBefore = JSON.stringify(entriesBefore);

		// サインアウト
		const signOutRes = await signOut(app, cookie);
		expect(signOutRes.status).toBe(200);

		// サインアウト後、Redisの状態が変化している（何かしらの書き込み/削除が発生）
		const entriesAfter = ctx.storage._entries();
		const snapshotAfter = JSON.stringify(entriesAfter);
		expect(snapshotAfter).not.toBe(snapshotBefore);

		// 最重要: サインアウト後にそのCookieでセッションが取得できないことを
		// データ層レベルで確認（APIからも確認）
		const sessionRes = await requestWithSession(
			app,
			"/api/auth/get-session",
			cookie,
		);
		const sessionBody: Json = await sessionRes.json();
		// セッションが無効化されている（nullまたはエラー）
		expect(sessionBody?.session).toBeFalsy();
	});
});
