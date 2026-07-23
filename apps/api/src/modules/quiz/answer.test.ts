import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviewLog, reviewState, user, word, wordMeaning, wordSet } from "../../db";
import { createTestDb } from "../../test/helpers";
import { createTestContext, type TestContext } from "../../test/setup";
import { getQuizExplanation, recordQuizAnswer } from "./service";

// ===========================================================================
// クイズ回答記録(recordQuizAnswer) / 解説取得(getQuizExplanation) の単体テスト
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let db: ReturnType<typeof createTestDb>;

const userA = "user-answer-a";
const userB = "user-answer-b";

const setA = "set-answer-a";
const setAOther = "set-answer-a-other";
const setB = "set-answer-b";

// 意味を1つだけ持つ単語。正解→isMastered=true、その後誤答→isRemembered/isMastered が
// false に戻ることの確認、および reps/lapses が既存 saveReview と同じ挙動になることの確認に使う。
const wordSingle = "word-answer-single";
const meaningSingle = "meaning-answer-single";

// 意味を2つ持つ単語。片方だけ remembered では isMastered=false、
// 両方 remembered になって初めて isMastered=true になることの確認に使う。
const wordDouble = "word-answer-double";
const meaningDoubleA = "meaning-answer-double-a";
const meaningDoubleB = "meaning-answer-double-b";

// 解説取得用の単語。slot がバラバラの順で挿入し、slot昇順で返ることを確認する。
const wordExplain = "word-answer-explain";
const meaningExplainSlot3 = "meaning-answer-explain-slot3";
const meaningExplainSlot1 = "meaning-answer-explain-slot1";
const meaningExplainSlot2 = "meaning-answer-explain-slot2";

// 他ユーザーの単語（所有確認用）
const otherUserWord = "word-answer-other-user";

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	db = createTestDb(ctx);

	await db.insert(user).values([
		{ id: userA, name: "User A", email: "quiz-answer-a@example.com" },
		{ id: userB, name: "User B", email: "quiz-answer-b@example.com" },
	]);

	await db.insert(wordSet).values([
		{ id: setA, userId: userA, name: "Answer Set A" },
		{ id: setAOther, userId: userA, name: "Answer Set A Other" },
		{ id: setB, userId: userB, name: "Answer Set B" },
	]);

	await db.insert(word).values([
		{ id: wordSingle, userId: userA, wordSetId: setA, text: "single" },
		{ id: wordDouble, userId: userA, wordSetId: setA, text: "double" },
		{ id: wordExplain, userId: userA, wordSetId: setA, text: "explain" },
		{ id: otherUserWord, userId: userB, wordSetId: setB, text: "otherword" },
	]);

	await db.insert(wordMeaning).values([
		{ id: meaningSingle, wordId: wordSingle, meaning: "単一の意味", slot: 1 },
		{ id: meaningDoubleA, wordId: wordDouble, meaning: "二重A", slot: 1 },
		{ id: meaningDoubleB, wordId: wordDouble, meaning: "二重B", slot: 2 },
		// 挿入順をわざと slot 順と逆にする(orderBy欠落を検出するため)
		{
			id: meaningExplainSlot3,
			wordId: wordExplain,
			meaning: "3番目の意味",
			slot: 3,
			partOfSpeech: "noun",
			phonetic: "/ig'zæmpl/",
			example: "This is slot3.",
			collocation: "slot3 collocation",
			synonym: "slot3 synonym",
			etymology: "slot3 etymology",
			source: "slot3 source",
			isRemembered: true,
		},
		{
			id: meaningExplainSlot1,
			wordId: wordExplain,
			meaning: "1番目の意味",
			slot: 1,
		},
		{
			id: meaningExplainSlot2,
			wordId: wordExplain,
			meaning: "2番目の意味",
			slot: 2,
		},
	]);
});

afterAll(() => {
	ctx.cleanup();
});

describe("recordQuizAnswer", () => {
	it("正解を記録すると isRemembered=true になり、意味が1件のみの単語は isMastered=true になる", async () => {
		const result = await recordQuizAnswer(db, {
			wordId: wordSingle,
			meaningId: meaningSingle,
			correct: true,
		});

		expect(result.isRemembered).toBe(true);
		expect(result.isMastered).toBe(true);
		expect(result.reviewState.meaningId).toBe(meaningSingle);
		expect(result.reviewState.reps).toBe(1);
		expect(result.reviewState.lapses).toBe(0);

		const updatedWord = await db.query.word.findFirst({
			where: eq(word.id, wordSingle),
		});
		expect(updatedWord?.isMastered).toBe(true);

		const updatedMeaning = await db.query.wordMeaning.findFirst({
			where: eq(wordMeaning.id, meaningSingle),
		});
		expect(updatedMeaning?.isRemembered).toBe(true);
	});

	it("review_log に mode=quiz / result=correct が記録される", async () => {
		const logs = await db
			.select()
			.from(reviewLog)
			.where(eq(reviewLog.meaningId, meaningSingle));
		expect(logs).toHaveLength(1);
		expect(logs[0].mode).toBe("quiz");
		expect(logs[0].result).toBe("correct");
	});

	it("続けて誤答を記録すると isRemembered/isMastered が false に戻り、reps/lapses が既存 saveReview と同じ挙動になる", async () => {
		const result = await recordQuizAnswer(db, {
			wordId: wordSingle,
			meaningId: meaningSingle,
			correct: false,
		});

		expect(result.isRemembered).toBe(false);
		expect(result.isMastered).toBe(false);
		expect(result.reviewState.reps).toBe(0);
		expect(result.reviewState.lapses).toBe(1);

		const updatedWord = await db.query.word.findFirst({
			where: eq(word.id, wordSingle),
		});
		expect(updatedWord?.isMastered).toBe(false);

		const logs = await db
			.select()
			.from(reviewLog)
			.where(eq(reviewLog.meaningId, meaningSingle));
		expect(logs).toHaveLength(2);
		expect(logs[1].result).toBe("wrong");

		const state = await db.query.reviewState.findFirst({
			where: eq(reviewState.meaningId, meaningSingle),
		});
		expect(state?.reps).toBe(0);
		expect(state?.lapses).toBe(1);
	});

	it("一部の意味だけ remembered な場合は isMastered=false のまま", async () => {
		const result = await recordQuizAnswer(db, {
			wordId: wordDouble,
			meaningId: meaningDoubleA,
			correct: true,
		});

		expect(result.isRemembered).toBe(true);
		expect(result.isMastered).toBe(false);

		const updatedWord = await db.query.word.findFirst({
			where: eq(word.id, wordDouble),
		});
		expect(updatedWord?.isMastered).toBe(false);
	});

	it("残り全ての意味も remembered になると isMastered=true になる", async () => {
		const result = await recordQuizAnswer(db, {
			wordId: wordDouble,
			meaningId: meaningDoubleB,
			correct: true,
		});

		expect(result.isMastered).toBe(true);

		const updatedWord = await db.query.word.findFirst({
			where: eq(word.id, wordDouble),
		});
		expect(updatedWord?.isMastered).toBe(true);
	});
});

describe("getQuizExplanation", () => {
	it("所有する単語の解説を取得でき、meanings が slot昇順で返る", async () => {
		const result = await getQuizExplanation(db, userA, setA, wordExplain);

		expect(result).not.toBeNull();
		expect(result?.wordId).toBe(wordExplain);
		expect(result?.meanings.map((m) => m.slot)).toEqual([1, 2, 3]);
		expect(result?.meanings.map((m) => m.id)).toEqual([
			meaningExplainSlot1,
			meaningExplainSlot2,
			meaningExplainSlot3,
		]);

		const slot3 = result?.meanings.find((m) => m.slot === 3);
		expect(slot3).toMatchObject({
			meaning: "3番目の意味",
			partOfSpeech: "noun",
			phonetic: "/ig'zæmpl/",
			example: "This is slot3.",
			collocation: "slot3 collocation",
			synonym: "slot3 synonym",
			etymology: "slot3 etymology",
			source: "slot3 source",
			isRemembered: true,
		});
	});

	it("他ユーザーの単語は null を返す（所有スコープ）", async () => {
		const result = await getQuizExplanation(db, userA, setB, otherUserWord);
		expect(result).toBeNull();
	});

	it("正しいユーザーでも別セット指定なら null を返す", async () => {
		const result = await getQuizExplanation(db, userA, setAOther, wordExplain);
		expect(result).toBeNull();
	});

	it("存在しない単語IDは null を返す", async () => {
		const result = await getQuizExplanation(db, userA, setA, "no-such-word");
		expect(result).toBeNull();
	});
});
