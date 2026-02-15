import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
