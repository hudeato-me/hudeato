import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviewLog, user, word, wordMeaning, wordSet } from "../db";
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
// クイズAPI 結合テスト
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let app: ReturnType<typeof createStudyTestApp>;
let db: ReturnType<typeof createTestDb>;
let cookie: string;

// ログインユーザー(userA)のセット・単語
const setId = "quiz-set-a";
// GET /:setId のクイズ生成用（5語×1意味。ディストラクタ3件が揃う件数を確保する）
const generationWords = {
	apple: "quiz-word-apple",
	book: "quiz-word-book",
	cat: "quiz-word-cat",
	dog: "quiz-word-dog",
	egg: "quiz-word-egg",
};
// POST answer 用（意味を1件のみ持つ単語。正解で isMastered=true になることも確認する）
const answerWordId = "quiz-word-answer";
const answerMeaningId = "quiz-meaning-answer";
// 整合性チェック用（別単語に属する意味）
const answerOtherWordId = "quiz-word-answer-2";
const answerOtherWordMeaningId = "quiz-meaning-answer-2";
// GET explain 用（意味2件、slotをわざと逆順で挿入する）
const explainWordId = "quiz-word-explain";
const explainMeaningIdSlot2 = "quiz-meaning-explain-slot2";
const explainMeaningIdSlot1 = "quiz-meaning-explain-slot1";

// 別ユーザー所有のセット・単語（認可確認用）
const otherUserId = "quiz-user-b";
const otherSetId = "quiz-set-b";
const otherWordId = "quiz-word-b1";
const otherMeaningId = "quiz-meaning-b1";

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

	// ログインユーザーのセット・単語
	await db.insert(wordSet).values({ id: setId, userId: myUserId, name: "Quiz Set A" });
	await db.insert(word).values([
		{ id: generationWords.apple, userId: myUserId, wordSetId: setId, text: "apple" },
		{ id: generationWords.book, userId: myUserId, wordSetId: setId, text: "book" },
		{ id: generationWords.cat, userId: myUserId, wordSetId: setId, text: "cat" },
		{ id: generationWords.dog, userId: myUserId, wordSetId: setId, text: "dog" },
		{ id: generationWords.egg, userId: myUserId, wordSetId: setId, text: "egg" },
		{ id: answerWordId, userId: myUserId, wordSetId: setId, text: "answerword" },
		{ id: answerOtherWordId, userId: myUserId, wordSetId: setId, text: "answerword2" },
		{ id: explainWordId, userId: myUserId, wordSetId: setId, text: "explainword" },
	]);
	await db.insert(wordMeaning).values([
		{ id: "quiz-meaning-apple", wordId: generationWords.apple, meaning: "りんご", slot: 1 },
		{ id: "quiz-meaning-book", wordId: generationWords.book, meaning: "本", slot: 1 },
		{ id: "quiz-meaning-cat", wordId: generationWords.cat, meaning: "猫", slot: 1 },
		{ id: "quiz-meaning-dog", wordId: generationWords.dog, meaning: "犬", slot: 1 },
		{ id: "quiz-meaning-egg", wordId: generationWords.egg, meaning: "卵", slot: 1 },
		{ id: answerMeaningId, wordId: answerWordId, meaning: "回答対象の意味", slot: 1 },
		{ id: answerOtherWordMeaningId, wordId: answerOtherWordId, meaning: "別単語の意味", slot: 1 },
		// slot を挿入順とは逆にする(orderBy欠落を検出するため)
		{ id: explainMeaningIdSlot2, wordId: explainWordId, meaning: "2番目の意味", slot: 2 },
		{
			id: explainMeaningIdSlot1,
			wordId: explainWordId,
			meaning: "1番目の意味",
			partOfSpeech: "noun",
			example: "This is an example.",
			slot: 1,
		},
	]);

	// 別ユーザーの単語
	await db
		.insert(user)
		.values({ id: otherUserId, name: "Quiz User B", email: "quiz-b@example.com" });
	await db.insert(wordSet).values({ id: otherSetId, userId: otherUserId, name: "Quiz Set B" });
	await db.insert(word).values({
		id: otherWordId,
		userId: otherUserId,
		wordSetId: otherSetId,
		text: "delta",
	});
	await db.insert(wordMeaning).values({
		id: otherMeaningId,
		wordId: otherWordId,
		meaning: "delta-meaning",
		slot: 1,
	});
});

afterAll(() => {
	ctx.cleanup();
});

describe("GET /api/v1/quiz/:setId", () => {
	it("未認証は401", async () => {
		const res = await requestJson(app, "GET", `/api/v1/quiz/${setId}`, "");
		expect(res.status).toBe(401);
	});

	it("正常系: 4択問題が生成され、選択肢4件と正解indexを含む", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/quiz/${setId}?count=3`,
			cookie,
		);
		expect(res.status).toBe(200);
		const body: Json = await res.json();
		expect(body.scope).toBe("all");
		expect(body.direction).toBe("wordToMeaning");
		expect(body.questions.length).toBeGreaterThan(0);
		for (const question of body.questions) {
			expect(question.choices).toHaveLength(4);
			expect(question.correctIndex).toBeGreaterThanOrEqual(0);
			expect(question.correctIndex).toBeLessThanOrEqual(3);
			expect(question.choices[question.correctIndex]).toBeTruthy();
		}
	});

	it("不正なscopeは400", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/quiz/${setId}?scope=bogus`,
			cookie,
		);
		expect(res.status).toBe(400);
	});

	it("他ユーザーのセットは questions が空配列(study/targetsと同様、追加の所有チェックはしない)", async () => {
		const res = await requestJson(app, "GET", `/api/v1/quiz/${otherSetId}`, cookie);
		expect(res.status).toBe(200);
		const body: Json = await res.json();
		expect(body.questions).toEqual([]);
	});
});

describe("POST /api/v1/quiz/:setId/answer", () => {
	it("未認証は401", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/quiz/${setId}/answer`,
			"",
			{ wordId: answerWordId, meaningId: answerMeaningId, correct: true },
		);
		expect(res.status).toBe(401);
	});

	it("不正なbody(correct欠落)は400", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/quiz/${setId}/answer`,
			cookie,
			{ wordId: answerWordId, meaningId: answerMeaningId },
		);
		expect(res.status).toBe(400);
	});

	it("存在しない単語は404", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/quiz/${setId}/answer`,
			cookie,
			{ wordId: "no-such-word", meaningId: answerMeaningId, correct: true },
		);
		expect(res.status).toBe(404);
	});

	it("他ユーザーの単語は404（認可スコープ）", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/quiz/${setId}/answer`,
			cookie,
			{ wordId: otherWordId, meaningId: otherMeaningId, correct: true },
		);
		expect(res.status).toBe(404);
	});

	it("別単語に属するmeaningIdは404（整合性チェック）", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/quiz/${setId}/answer`,
			cookie,
			{ wordId: answerWordId, meaningId: answerOtherWordMeaningId, correct: true },
		);
		expect(res.status).toBe(404);
	});

	it("正解を記録すると review_state / isRemembered / isMastered が更新される", async () => {
		const res = await requestJson(
			app,
			"POST",
			`/api/v1/quiz/${setId}/answer`,
			cookie,
			{ wordId: answerWordId, meaningId: answerMeaningId, correct: true },
		);
		expect(res.status).toBe(201);
		const body: Json = await res.json();
		expect(body.success).toBe(true);
		expect(body.reviewState.meaningId).toBe(answerMeaningId);
		expect(body.reviewState.reps).toBe(1);
		expect(body.reviewState.lapses).toBe(0);
		expect(body.isRemembered).toBe(true);
		// 意味が1件のみの単語のため、正解で isMastered=true になる
		expect(body.isMastered).toBe(true);

		const logs = await db
			.select()
			.from(reviewLog)
			.where(eq(reviewLog.meaningId, answerMeaningId));
		expect(logs).toHaveLength(1);
		expect(logs[0].mode).toBe("quiz");
		expect(logs[0].result).toBe("correct");
	});
});

describe("GET /api/v1/quiz/:setId/:wordId/explain", () => {
	it("未認証は401", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/quiz/${setId}/${explainWordId}/explain`,
			"",
		);
		expect(res.status).toBe(401);
	});

	it("正常系: 意味がslot昇順で返る", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/quiz/${setId}/${explainWordId}/explain`,
			cookie,
		);
		expect(res.status).toBe(200);
		const body: Json = await res.json();
		expect(body.wordId).toBe(explainWordId);
		expect(body.meanings.map((m: Json) => m.id)).toEqual([
			explainMeaningIdSlot1,
			explainMeaningIdSlot2,
		]);
		expect(body.meanings[0].partOfSpeech).toBe("noun");
		expect(body.meanings[0].example).toBe("This is an example.");
	});

	it("存在しない単語は404", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/quiz/${setId}/no-such-word/explain`,
			cookie,
		);
		expect(res.status).toBe(404);
	});

	it("他ユーザーの単語は404（認可スコープ）", async () => {
		const res = await requestJson(
			app,
			"GET",
			`/api/v1/quiz/${setId}/${otherWordId}/explain`,
			cookie,
		);
		expect(res.status).toBe(404);
	});
});
