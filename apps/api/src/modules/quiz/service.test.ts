import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { user, word, wordMeaning, wordSet } from "../../db";
import { createTestDb } from "../../test/helpers";
import { createTestContext, type TestContext } from "../../test/setup";
import { generateQuiz } from "./service";

// ===========================================================================
// クイズ生成 service の単体テスト
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let db: ReturnType<typeof createTestDb>;

const userA = "user-a";
const userB = "user-b";

// セット内5語(うち1語は意味を2つ持つ)。wordToMeaning/meaningToWord/件数系のテストで使う。
const setMain = "set-main";
const words = {
	apple: "word-apple",
	book: "word-book",
	cat: "word-cat",
	dog: "word-dog",
	egg: "word-egg",
};

// isRemembered=true を1語だけ含む4語セット。scope=unanswered のテスト専用。
// 4語ちょうどにすることで「対象語を除いた残り3語が全てディストラクタに使われる」
// ことをrngの挙動に依存せず保証できる。
const setUnanswered = "set-unanswered";
const unansweredWords = {
	leaf: "word-leaf", // isRemembered=true (既に正解済み)
	pen: "word-pen",
	sun: "word-sun",
	moon: "word-moon",
};

// 3語のみのセット。ディストラクタが3件揃わないため questions が空になることを確認する。
const setSmall = "set-small";
const smallWords = {
	one: "word-one",
	two: "word-two",
	three: "word-three",
};

// 他ユーザーのセット。userA からは見えないことを確認する。
const setB = "set-b";
const wordsB = {
	fish: "word-fish",
	bird: "word-bird",
	lion: "word-lion",
	tiger: "word-tiger",
};

// テストを決定的にするため常に0を返す擬似乱数(常に配列の先頭を選ぶ)を使う。
const fakeRng = () => 0;

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	db = createTestDb(ctx);

	await db.insert(user).values([
		{ id: userA, name: "User A", email: "quiz-a@example.com" },
		{ id: userB, name: "User B", email: "quiz-b@example.com" },
	]);

	await db.insert(wordSet).values([
		{ id: setMain, userId: userA, name: "Main Set" },
		{ id: setUnanswered, userId: userA, name: "Unanswered Set" },
		{ id: setSmall, userId: userA, name: "Small Set" },
		{ id: setB, userId: userB, name: "Set B" },
	]);

	const base = new Date("2026-01-01T00:00:00Z").getTime();

	await db.insert(word).values([
		{ id: words.apple, userId: userA, wordSetId: setMain, text: "apple", createdAt: new Date(base + 1000) },
		{ id: words.book, userId: userA, wordSetId: setMain, text: "book", createdAt: new Date(base + 2000) },
		{ id: words.cat, userId: userA, wordSetId: setMain, text: "cat", createdAt: new Date(base + 3000) },
		{ id: words.dog, userId: userA, wordSetId: setMain, text: "dog", createdAt: new Date(base + 4000) },
		{ id: words.egg, userId: userA, wordSetId: setMain, text: "egg", createdAt: new Date(base + 5000) },

		{ id: unansweredWords.leaf, userId: userA, wordSetId: setUnanswered, text: "leaf", createdAt: new Date(base + 6000) },
		{ id: unansweredWords.pen, userId: userA, wordSetId: setUnanswered, text: "pen", createdAt: new Date(base + 7000) },
		{ id: unansweredWords.sun, userId: userA, wordSetId: setUnanswered, text: "sun", createdAt: new Date(base + 8000) },
		{ id: unansweredWords.moon, userId: userA, wordSetId: setUnanswered, text: "moon", createdAt: new Date(base + 9000) },

		{ id: smallWords.one, userId: userA, wordSetId: setSmall, text: "one", createdAt: new Date(base + 10000) },
		{ id: smallWords.two, userId: userA, wordSetId: setSmall, text: "two", createdAt: new Date(base + 11000) },
		{ id: smallWords.three, userId: userA, wordSetId: setSmall, text: "three", createdAt: new Date(base + 12000) },

		{ id: wordsB.fish, userId: userB, wordSetId: setB, text: "fish", createdAt: new Date(base + 13000) },
		{ id: wordsB.bird, userId: userB, wordSetId: setB, text: "bird", createdAt: new Date(base + 14000) },
		{ id: wordsB.lion, userId: userB, wordSetId: setB, text: "lion", createdAt: new Date(base + 15000) },
		{ id: wordsB.tiger, userId: userB, wordSetId: setB, text: "tiger", createdAt: new Date(base + 16000) },
	]);

	await db.insert(wordMeaning).values([
		{ id: "meaning-apple-1", wordId: words.apple, meaning: "りんご", slot: 1 },
		{ id: "meaning-apple-2", wordId: words.apple, meaning: "アップルの木", slot: 2 },
		{ id: "meaning-book", wordId: words.book, meaning: "本", slot: 1 },
		{ id: "meaning-cat", wordId: words.cat, meaning: "猫", slot: 1 },
		{ id: "meaning-dog", wordId: words.dog, meaning: "犬", slot: 1 },
		{ id: "meaning-egg", wordId: words.egg, meaning: "卵", slot: 1 },

		{ id: "meaning-leaf", wordId: unansweredWords.leaf, meaning: "葉", slot: 1, isRemembered: true },
		{ id: "meaning-pen", wordId: unansweredWords.pen, meaning: "ペン", slot: 1, isRemembered: false },
		{ id: "meaning-sun", wordId: unansweredWords.sun, meaning: "太陽", slot: 1, isRemembered: false },
		{ id: "meaning-moon", wordId: unansweredWords.moon, meaning: "月", slot: 1, isRemembered: false },

		{ id: "meaning-one", wordId: smallWords.one, meaning: "一", slot: 1 },
		{ id: "meaning-two", wordId: smallWords.two, meaning: "二", slot: 1 },
		{ id: "meaning-three", wordId: smallWords.three, meaning: "三", slot: 1 },

		{ id: "meaning-fish", wordId: wordsB.fish, meaning: "魚", slot: 1 },
		{ id: "meaning-bird", wordId: wordsB.bird, meaning: "鳥", slot: 1 },
		{ id: "meaning-lion", wordId: wordsB.lion, meaning: "ライオン", slot: 1 },
		{ id: "meaning-tiger", wordId: wordsB.tiger, meaning: "虎", slot: 1 },
	]);
});

afterAll(() => {
	ctx.cleanup();
});

describe("generateQuiz", () => {
	it("direction=wordToMeaning は問題文が単語テキスト、正解選択肢が意味テキストになる", async () => {
		const result = await generateQuiz(
			db,
			{ userId: userA, wordSetId: setMain, scope: "all", direction: "wordToMeaning", count: 10 },
			fakeRng,
		);

		expect(result.scope).toBe("all");
		expect(result.direction).toBe("wordToMeaning");

		const catQuestion = result.questions.find((q) => q.wordId === words.cat);
		expect(catQuestion).toBeDefined();
		expect(catQuestion?.prompt).toBe("cat");
		expect(catQuestion?.choices).toHaveLength(4);
		expect(catQuestion?.choices[catQuestion.correctIndex]).toBe("猫");
		// choices に重複がないこと
		expect(new Set(catQuestion?.choices).size).toBe(4);
	});

	it("direction=meaningToWord は問題文が意味テキスト、正解選択肢が単語テキストになる", async () => {
		const result = await generateQuiz(
			db,
			{ userId: userA, wordSetId: setMain, scope: "all", direction: "meaningToWord", count: 10 },
			fakeRng,
		);

		const catQuestion = result.questions.find((q) => q.wordId === words.cat);
		expect(catQuestion).toBeDefined();
		expect(catQuestion?.prompt).toBe("猫");
		expect(catQuestion?.choices[catQuestion.correctIndex]).toBe("cat");
		expect(new Set(catQuestion?.choices).size).toBe(4);
	});

	it("scope=unanswered は isRemembered=true の意味が出題されず、ディストラクタには使われる", async () => {
		const result = await generateQuiz(
			db,
			{ userId: userA, wordSetId: setUnanswered, scope: "unanswered", direction: "wordToMeaning", count: 10 },
			fakeRng,
		);

		// isRemembered=true の leaf は出題対象にならない
		expect(result.questions.some((q) => q.wordId === unansweredWords.leaf)).toBe(false);
		expect(result.questions).toHaveLength(3);

		// leaf(isRemembered=true)の意味「葉」は all プール由来のディストラクタとして
		// 全ての問題の選択肢に含まれる(このセットは対象外の1語+対象3語の計4語しかなく、
		// 各問題は自語を除いた残り3語を必ず全てディストラクタに採用するため決定的)
		for (const question of result.questions) {
			expect(question.choices).toContain("葉");
		}
	});

	it("他ユーザー・他セットの単語が混入しない", async () => {
		// userA で userB のセットを引くと候補が0件のため questions は空
		const crossUserResult = await generateQuiz(
			db,
			{ userId: userA, wordSetId: setB, scope: "all", direction: "wordToMeaning", count: 10 },
			fakeRng,
		);
		expect(crossUserResult.questions).toEqual([]);

		// userB は自分のセットのみ取得でき、userA の単語は混入しない
		const ownerResult = await generateQuiz(
			db,
			{ userId: userB, wordSetId: setB, scope: "all", direction: "wordToMeaning", count: 10 },
			fakeRng,
		);
		expect(ownerResult.questions.length).toBeGreaterThan(0);
		const allChoices = ownerResult.questions.flatMap((q) => q.choices);
		expect(allChoices).not.toContain("りんご");
		expect(allChoices).not.toContain("猫");
	});

	it("セット内の語が3語以下でディストラクタが3件揃わない場合は questions が空になる", async () => {
		const result = await generateQuiz(
			db,
			{ userId: userA, wordSetId: setSmall, scope: "all", direction: "wordToMeaning", count: 10 },
			fakeRng,
		);
		expect(result.questions).toEqual([]);
	});

	it("count が語数より多い場合は語数分だけ返り、同一wordIdの重複問題は発生しない", async () => {
		const result = await generateQuiz(
			db,
			{ userId: userA, wordSetId: setMain, scope: "all", direction: "wordToMeaning", count: 10 },
			fakeRng,
		);

		expect(result.questions).toHaveLength(5);
		const wordIds = result.questions.map((q) => q.wordId);
		expect(new Set(wordIds).size).toBe(wordIds.length);
	});

	it("意味が複数ある語(apple)からは1問しか出ない", async () => {
		const result = await generateQuiz(
			db,
			{ userId: userA, wordSetId: setMain, scope: "all", direction: "wordToMeaning", count: 10 },
			fakeRng,
		);

		const appleQuestions = result.questions.filter((q) => q.wordId === words.apple);
		expect(appleQuestions).toHaveLength(1);
	});
});
