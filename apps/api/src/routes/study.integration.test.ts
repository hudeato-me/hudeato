import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviewLog, reviewState, user, word, wordSet } from "../db";
import {
	createStudyTestApp,
	createTestDb,
	requestJson,
	signUpAndGetSession,
} from "../test/helpers";
import { createTestContext, type TestContext } from "../test/setup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

// ===========================================================================
// 学習API 結合テスト
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let app: ReturnType<typeof createStudyTestApp>;
let db: ReturnType<typeof createTestDb>;
let cookie: string;

// userA(ログインユーザー) の単語
const setId = "set-a";
const wordId = "word-a1";
const masteredWordId = "word-a2";
// 別ユーザー所有の単語（認可確認用）
const otherUserId = "user-b";
const otherSetId = "set-b";
const otherWordId = "word-b1";

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	app = createStudyTestApp(ctx);
	db = createTestDb(ctx);

	// ログインユーザーを作成しセッションCookieを得る
	const session = await signUpAndGetSession(app);
	cookie = session.cookie;
	const me = await db.query.user.findFirst({
		where: eq(user.email, "test@example.com"),
	});
	const myUserId = me!.id;

	// ログインユーザーの単語
	await db.insert(wordSet).values({ id: setId, userId: myUserId, name: "Set A" });
	await db.insert(word).values([
		{ id: wordId, userId: myUserId, wordSetId: setId, text: "alpha" },
		{
			id: masteredWordId,
			userId: myUserId,
			wordSetId: setId,
			text: "bravo",
			isMastered: true,
		},
	]);

	// 別ユーザーの単語
	await db
		.insert(user)
		.values({ id: otherUserId, name: "User B", email: "b@example.com" });
	await db
		.insert(wordSet)
		.values({ id: otherSetId, userId: otherUserId, name: "Set B" });
	await db.insert(word).values({
		id: otherWordId,
		userId: otherUserId,
		wordSetId: otherSetId,
		text: "delta",
	});
});

afterAll(() => {
	ctx.cleanup();
});

describe("POST /api/v1/study/:setId/review", () => {
	it("未認証は401", async () => {
		const res = await requestJson(app, "POST", `/api/v1/study/${setId}/review`, "", {
			wordId,
			mode: "quiz",
			result: "correct",
		});
		expect(res.status).toBe(401);
	});

	it("不正なbody(未知のresult)は400", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/study/${setId}/review`,
			cookie,
			{ wordId, mode: "quiz", result: "maybe" },
		);
		expect(res.status).toBe(400);
	});

	it("存在しない単語は404", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/study/${setId}/review`,
			cookie,
			{ wordId: "no-such-word", mode: "quiz", result: "correct" },
		);
		expect(res.status).toBe(404);
	});

	it("他ユーザーの単語は404（認可スコープ）", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/study/${setId}/review`,
			cookie,
			{ wordId: otherWordId, mode: "quiz", result: "correct" },
		);
		expect(res.status).toBe(404);
		// review_log にも記録されない
		const logs = await db
			.select()
			.from(reviewLog)
			.where(eq(reviewLog.wordId, otherWordId));
		expect(logs).toHaveLength(0);
	});

	it("正答(correct)を記録し review_log 追記・review_state 更新が行われる", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/study/${setId}/review`,
			cookie,
			{ wordId, mode: "quiz", result: "correct" },
		);
		expect(res.status).toBe(201);
		const body: Json = await res.json();
		expect(body.success).toBe(true);
		expect(body.reviewState.wordId).toBe(wordId);
		expect(body.reviewState.reps).toBe(1);
		expect(body.reviewState.lapses).toBe(0);

		const logs = await db
			.select()
			.from(reviewLog)
			.where(eq(reviewLog.wordId, wordId));
		expect(logs).toHaveLength(1);
		expect(logs[0].result).toBe("correct");

		const state = await db.query.reviewState.findFirst({
			where: eq(reviewState.wordId, wordId),
		});
		expect(state?.reps).toBe(1);
	});

	it("誤答(wrong)で reps リセット・lapses 加算され、履歴が積み上がる", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/study/${setId}/review`,
			cookie,
			{ wordId, mode: "quiz", result: "wrong" },
		);
		expect(res.status).toBe(201);
		const body: Json = await res.json();
		expect(body.reviewState.reps).toBe(0);
		expect(body.reviewState.lapses).toBe(1);

		const logs = await db
			.select()
			.from(reviewLog)
			.where(eq(reviewLog.wordId, wordId));
		expect(logs).toHaveLength(2);
	});
});

describe("GET /api/v1/study/:setId/targets", () => {
	it("未認証は401", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/study/${setId}/targets`,
			"",
		);
		expect(res.status).toBe(401);
	});

	it("scope省略時は all 扱いでセット内全件を返す", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/study/${setId}/targets`,
			cookie,
		);
		expect(res.status).toBe(200);
		const body: Json = await res.json();
		expect(body.scope).toBe("all");
		expect(body.count).toBe(2);
		expect([...body.wordIds].sort()).toEqual([wordId, masteredWordId].sort());
	});

	it("scope=unmastered は未習得の言葉のみ返す", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/study/${setId}/targets?scope=unmastered`,
			cookie,
		);
		expect(res.status).toBe(200);
		const body: Json = await res.json();
		expect(body.scope).toBe("unmastered");
		expect(body.wordIds).toEqual([wordId]);
	});

	it("不正な scope は400", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/study/${setId}/targets?scope=bogus`,
			cookie,
		);
		expect(res.status).toBe(400);
	});

	it("他ユーザーのセットは空（認可スコープ）", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/study/${otherSetId}/targets`,
			cookie,
		);
		expect(res.status).toBe(200);
		const body: Json = await res.json();
		expect(body.count).toBe(0);
	});
});
