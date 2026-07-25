import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { user, word, wordMeaning, wordSet } from "../db";
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
// カードAPI 結合テスト
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let app: ReturnType<typeof createStudyTestApp>;
let db: ReturnType<typeof createTestDb>;
let cookie: string;

const setId = "cards-route-set-a";
const wordId = "cards-route-word-a";
const meaningId = "cards-route-meaning-a";

// 別ユーザー所有のセット（認可確認用）
const otherUserId = "cards-route-user-b";
const otherSetId = "cards-route-set-b";

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	app = createStudyTestApp(ctx);
	db = createTestDb(ctx);

	const session = await signUpAndGetSession(app);
	cookie = session.cookie;
	const me = await db.query.user.findFirst({
		where: eq(user.email, "test@example.com"),
	});
	const myUserId = me!.id;

	await db
		.insert(wordSet)
		.values({ id: setId, userId: myUserId, name: "Cards Route Set A" });
	await db.insert(word).values({
		id: wordId,
		userId: myUserId,
		wordSetId: setId,
		text: "ephemeral",
	});
	await db.insert(wordMeaning).values({
		id: meaningId,
		wordId,
		meaning: "短命な",
		partOfSpeech: "adjective",
		slot: 1,
	});

	await db.insert(user).values({
		id: otherUserId,
		name: "Cards Route User B",
		email: "cards-route-b@example.com",
	});
	await db
		.insert(wordSet)
		.values({ id: otherSetId, userId: otherUserId, name: "Cards Route Set B" });
});

afterAll(() => {
	ctx.cleanup();
});

describe("GET /api/v1/cards/:setId", () => {
	it("未認証は401", async () => {
		const res = await requestJson(app, "GET", `/api/v1/cards/${setId}`, "");
		expect(res.status).toBe(401);
	});

	it("正常系: カードが表裏の表示に必要な情報つきで返る", async () => {
		const res = await requestJson(app, "GET", `/api/v1/cards/${setId}`, cookie);

		expect(res.status).toBe(200);
		const body: Json = await res.json();
		expect(body.scope).toBe("all");
		expect(body.cards).toHaveLength(1);
		expect(body.cards[0].wordId).toBe(wordId);
		expect(body.cards[0].text).toBe("ephemeral");
		expect(body.cards[0].isMastered).toBe(false);
		expect(body.cards[0].meanings[0].meaning).toBe("短命な");
		expect(body.cards[0].meanings[0].partOfSpeech).toBe("adjective");
	});

	it("不正なscopeは400", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/cards/${setId}?scope=bogus`,
			cookie,
		);
		expect(res.status).toBe(400);
	});

	it("範囲外のlimitは400", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/cards/${setId}?limit=0`,
			cookie,
		);
		expect(res.status).toBe(400);
	});

	it("他ユーザーのセットは cards が空配列(study/targets・quizと同様)", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/cards/${otherSetId}`,
			cookie,
		);

		expect(res.status).toBe(200);
		const body: Json = await res.json();
		expect(body.cards).toEqual([]);
	});
});
