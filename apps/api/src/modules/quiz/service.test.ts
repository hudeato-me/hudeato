import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { user, word, wordMeaning, wordSet } from "../../db";
import { EMBEDDING_DIM } from "../../db/word-schema";
import { createTestDb } from "../../test/helpers";
import { createTestContext, type TestContext } from "../../test/setup";
import { upsertWordEmbedding } from "../study/repository";
import { findNearestWordIdsForWord } from "./repository";
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

// ---------------------------------------------------------------------------
// ベクトル近傍ディストラクタ(P2-2)用のテストデータ
// ---------------------------------------------------------------------------

// 768次元ベクトルを生成するヘルパー。先頭の数次元だけ与え、残りを0でパディングする。
const vec = (values: number[]): number[] => {
	const v = new Array<number>(EMBEDDING_DIM).fill(0);
	for (let i = 0; i < values.length && i < EMBEDDING_DIM; i++) v[i] = values[i];
	return v;
};

// findNearestWordIdsForWord 単体テスト用のセット・語。
// correct(基準方向)に対し near は近い方向、far は直交方向でコサイン距離を確実に分ける。
// word の挿入順は意図的に「期待される距離順(near→far)」と逆(far→near)にする
// (下記 word.values を参照)。.orderBy(asc(distance)) が抜け落ちた場合、
// 実際の返却順は word テーブルへの挿入順に従うため、この逆順設定によって
// テストが必ず失敗するようにしている。
const setEmbed = "set-embed";
const embedWords = {
	correct: "word-embed-correct",
	near: "word-embed-near",
	far: "word-embed-far",
	noEmbedding: "word-embed-no-embedding",
};
// 他ユーザーの埋め込み(correct と同方向。混入しないことの確認用)。
const setEmbedOtherUser = "set-embed-other-user";
const embedOtherUserWord = "word-embed-other-user-near";
// 同じ wordSetId(setEmbed)だが word.userId のみ別ユーザーの語。
// wordSetId フィルタだけでは除外されないため、userId スコープが単独で効いていることの検証に使う。
// correct と完全に同方向(距離0)にして、userId 条件が外れた場合は必ず最上位に出るようにする。
const embedOtherUserSameSetWord = "word-embed-other-user-same-set";

// generateQuiz: 正解語に埋め込みがあり近傍3語以上あるケース用のセット・語。
// near1〜3(埋め込みあり・基準方向に近い)と far1〜2(埋め込みなし=近傍検索の対象外)を用意し、
// ディストラクタが near 群のみから選ばれることを確認する。
const setNeighborMany = "set-neighbor-many";
const neighborManyWords = {
	correct: "word-neighbor-many-correct",
	near1: "word-neighbor-many-near1",
	near2: "word-neighbor-many-near2",
	near3: "word-neighbor-many-near3",
	far1: "word-neighbor-many-far1",
	far2: "word-neighbor-many-far2",
};

// generateQuiz: 埋め込みを持つのが正解語＋1語のみ(近傍1件)のケース用のセット・語。
// other1〜4(埋め込みなし)を十分に用意し、near が必ずディストラクタに含まれることを確認する。
const setNeighborOne = "set-neighbor-one";
const neighborOneWords = {
	correct: "word-neighbor-one-correct",
	near: "word-neighbor-one-near",
	other1: "word-neighbor-one-other1",
	other2: "word-neighbor-one-other2",
	other3: "word-neighbor-one-other3",
	other4: "word-neighbor-one-other4",
};

// generateQuiz: 正解語に埋め込みが無いケース用のセット・語(全ランダムフォールバック)。
const setNeighborNone = "set-neighbor-none";
const neighborNoneWords = {
	correct: "word-neighbor-none-correct",
	other1: "word-neighbor-none-other1",
	other2: "word-neighbor-none-other2",
	other3: "word-neighbor-none-other3",
};

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
		{ id: setEmbed, userId: userA, name: "Embed Set" },
		{ id: setEmbedOtherUser, userId: userB, name: "Embed Other User Set" },
		{ id: setNeighborMany, userId: userA, name: "Neighbor Many Set" },
		{ id: setNeighborOne, userId: userA, name: "Neighbor One Set" },
		{ id: setNeighborNone, userId: userA, name: "Neighbor None Set" },
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

		{ id: embedWords.correct, userId: userA, wordSetId: setEmbed, text: "embed-correct", createdAt: new Date(base + 17000) },
		// far を near より先に挿入する(距離順とは逆順。orderBy欠落を検出するため)
		{ id: embedWords.far, userId: userA, wordSetId: setEmbed, text: "embed-far", createdAt: new Date(base + 18000) },
		{ id: embedWords.near, userId: userA, wordSetId: setEmbed, text: "embed-near", createdAt: new Date(base + 19000) },
		{ id: embedWords.noEmbedding, userId: userA, wordSetId: setEmbed, text: "embed-no-embedding", createdAt: new Date(base + 20000) },
		{ id: embedOtherUserWord, userId: userB, wordSetId: setEmbedOtherUser, text: "embed-other-user-near", createdAt: new Date(base + 21000) },
		// word.userId のみ userB(word.wordSetId は userA のセット setEmbed のまま)。
		// wordSet.userId との一致は FK 制約で強制されないため挿入可能。
		{ id: embedOtherUserSameSetWord, userId: userB, wordSetId: setEmbed, text: "embed-other-user-same-set", createdAt: new Date(base + 21500) },

		{ id: neighborManyWords.correct, userId: userA, wordSetId: setNeighborMany, text: "neighbor-many-correct", createdAt: new Date(base + 22000) },
		{ id: neighborManyWords.near1, userId: userA, wordSetId: setNeighborMany, text: "neighbor-many-near1", createdAt: new Date(base + 23000) },
		{ id: neighborManyWords.near2, userId: userA, wordSetId: setNeighborMany, text: "neighbor-many-near2", createdAt: new Date(base + 24000) },
		{ id: neighborManyWords.near3, userId: userA, wordSetId: setNeighborMany, text: "neighbor-many-near3", createdAt: new Date(base + 25000) },
		{ id: neighborManyWords.far1, userId: userA, wordSetId: setNeighborMany, text: "neighbor-many-far1", createdAt: new Date(base + 26000) },
		{ id: neighborManyWords.far2, userId: userA, wordSetId: setNeighborMany, text: "neighbor-many-far2", createdAt: new Date(base + 27000) },

		{ id: neighborOneWords.correct, userId: userA, wordSetId: setNeighborOne, text: "neighbor-one-correct", createdAt: new Date(base + 28000) },
		{ id: neighborOneWords.near, userId: userA, wordSetId: setNeighborOne, text: "neighbor-one-near", createdAt: new Date(base + 29000) },
		{ id: neighborOneWords.other1, userId: userA, wordSetId: setNeighborOne, text: "neighbor-one-other1", createdAt: new Date(base + 30000) },
		{ id: neighborOneWords.other2, userId: userA, wordSetId: setNeighborOne, text: "neighbor-one-other2", createdAt: new Date(base + 31000) },
		{ id: neighborOneWords.other3, userId: userA, wordSetId: setNeighborOne, text: "neighbor-one-other3", createdAt: new Date(base + 32000) },
		{ id: neighborOneWords.other4, userId: userA, wordSetId: setNeighborOne, text: "neighbor-one-other4", createdAt: new Date(base + 33000) },

		{ id: neighborNoneWords.correct, userId: userA, wordSetId: setNeighborNone, text: "neighbor-none-correct", createdAt: new Date(base + 34000) },
		{ id: neighborNoneWords.other1, userId: userA, wordSetId: setNeighborNone, text: "neighbor-none-other1", createdAt: new Date(base + 35000) },
		{ id: neighborNoneWords.other2, userId: userA, wordSetId: setNeighborNone, text: "neighbor-none-other2", createdAt: new Date(base + 36000) },
		{ id: neighborNoneWords.other3, userId: userA, wordSetId: setNeighborNone, text: "neighbor-none-other3", createdAt: new Date(base + 37000) },
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

		{ id: "meaning-embed-correct", wordId: embedWords.correct, meaning: "embed正解", slot: 1 },
		{ id: "meaning-embed-near", wordId: embedWords.near, meaning: "embed近い", slot: 1 },
		{ id: "meaning-embed-far", wordId: embedWords.far, meaning: "embed遠い", slot: 1 },
		{ id: "meaning-embed-no-embedding", wordId: embedWords.noEmbedding, meaning: "embedなし", slot: 1 },
		{ id: "meaning-embed-other-user", wordId: embedOtherUserWord, meaning: "embed他ユーザー", slot: 1 },
		{ id: "meaning-embed-other-user-same-set", wordId: embedOtherUserSameSetWord, meaning: "embed他ユーザー同セット", slot: 1 },

		{ id: "meaning-neighbor-many-correct", wordId: neighborManyWords.correct, meaning: "近傍多数正解", slot: 1 },
		{ id: "meaning-neighbor-many-near1", wordId: neighborManyWords.near1, meaning: "近傍語1", slot: 1 },
		{ id: "meaning-neighbor-many-near2", wordId: neighborManyWords.near2, meaning: "近傍語2", slot: 1 },
		{ id: "meaning-neighbor-many-near3", wordId: neighborManyWords.near3, meaning: "近傍語3", slot: 1 },
		{ id: "meaning-neighbor-many-far1", wordId: neighborManyWords.far1, meaning: "遠語1", slot: 1 },
		{ id: "meaning-neighbor-many-far2", wordId: neighborManyWords.far2, meaning: "遠語2", slot: 1 },

		{ id: "meaning-neighbor-one-correct", wordId: neighborOneWords.correct, meaning: "近傍単独正解", slot: 1 },
		{ id: "meaning-neighbor-one-near", wordId: neighborOneWords.near, meaning: "近傍単独語", slot: 1 },
		{ id: "meaning-neighbor-one-other1", wordId: neighborOneWords.other1, meaning: "近傍単独残り1", slot: 1 },
		{ id: "meaning-neighbor-one-other2", wordId: neighborOneWords.other2, meaning: "近傍単独残り2", slot: 1 },
		{ id: "meaning-neighbor-one-other3", wordId: neighborOneWords.other3, meaning: "近傍単独残り3", slot: 1 },
		{ id: "meaning-neighbor-one-other4", wordId: neighborOneWords.other4, meaning: "近傍単独残り4", slot: 1 },

		{ id: "meaning-neighbor-none-correct", wordId: neighborNoneWords.correct, meaning: "埋め込みなし正解", slot: 1 },
		{ id: "meaning-neighbor-none-other1", wordId: neighborNoneWords.other1, meaning: "埋め込みなし残り1", slot: 1 },
		{ id: "meaning-neighbor-none-other2", wordId: neighborNoneWords.other2, meaning: "埋め込みなし残り2", slot: 1 },
		{ id: "meaning-neighbor-none-other3", wordId: neighborNoneWords.other3, meaning: "埋め込みなし残り3", slot: 1 },
	]);

	// --- ベクトル埋め込みの投入(P2-2) ---
	// setEmbed: near は基準方向に極めて近く、far は直交方向にして距離を確実に分ける。
	await upsertWordEmbedding(db, embedWords.correct, vec([1]), "test-model");
	await upsertWordEmbedding(db, embedWords.near, vec([1, 0.1]), "test-model");
	await upsertWordEmbedding(db, embedWords.far, vec([0, 1]), "test-model");
	// embedWords.noEmbedding は意図的に埋め込みを与えない
	// (correct と同方向。userId/wordSetId スコープで混入しないことを確認する)
	await upsertWordEmbedding(db, embedOtherUserWord, vec([1]), "test-model");
	// correct と完全に同方向(距離0)。userId スコープが外れていれば near より
	// 確実に近い結果として最上位に混入してしまう。
	await upsertWordEmbedding(db, embedOtherUserSameSetWord, vec([1]), "test-model");

	// setNeighborMany: near1〜3 のみ埋め込みを持ち、いずれも正解と近い方向にする。
	// far1/far2 は埋め込みを与えず、近傍検索の対象外(=フォールバック候補)にする。
	await upsertWordEmbedding(db, neighborManyWords.correct, vec([1]), "test-model");
	await upsertWordEmbedding(db, neighborManyWords.near1, vec([1, 0.001]), "test-model");
	await upsertWordEmbedding(db, neighborManyWords.near2, vec([1, -0.001]), "test-model");
	await upsertWordEmbedding(db, neighborManyWords.near3, vec([1, 0, 0.001]), "test-model");

	// setNeighborOne: 埋め込みを持つのは correct と near のみ(近傍1件)。
	await upsertWordEmbedding(db, neighborOneWords.correct, vec([1]), "test-model");
	await upsertWordEmbedding(db, neighborOneWords.near, vec([1, 0.001]), "test-model");

	// setNeighborNone: correct には埋め込みを与えず、近傍0件のフォールバックを確認する。
	await upsertWordEmbedding(db, neighborNoneWords.other1, vec([0, 1]), "test-model");
	await upsertWordEmbedding(db, neighborNoneWords.other2, vec([0, 1]), "test-model");
	await upsertWordEmbedding(db, neighborNoneWords.other3, vec([0, 1]), "test-model");
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

describe("findNearestWordIdsForWord", () => {
	it("コサイン距離の昇順で単語IDを返す(埋め込みが無い語は候補に上らない)", async () => {
		const results = await findNearestWordIdsForWord(db, userA, setEmbed, embedWords.correct, 10);
		expect(results).toEqual([embedWords.near, embedWords.far]);
	});

	it("対象語に埋め込みが無ければ空配列を返す", async () => {
		const results = await findNearestWordIdsForWord(db, userA, setEmbed, embedWords.noEmbedding, 10);
		expect(results).toEqual([]);
	});

	it("k で件数を制限できる", async () => {
		const results = await findNearestWordIdsForWord(db, userA, setEmbed, embedWords.correct, 1);
		expect(results).toEqual([embedWords.near]);
	});

	it("他セットの埋め込みを拾わない", async () => {
		const results = await findNearestWordIdsForWord(db, userA, setEmbed, embedWords.correct, 10);
		expect(results).not.toContain(embedOtherUserWord);
	});

	it("同じ wordSetId でも別ユーザーの埋め込みを拾わない(userId スコープ単独の検証)", async () => {
		// embedOtherUserSameSetWord は wordSetId こそ setEmbed と同一だが word.userId が userB。
		// embedding は correct と完全に同方向(距離0)にしてあるため、
		// eq(word.userId, userId) が欠落すると必ず結果の先頭に混入する。
		const results = await findNearestWordIdsForWord(db, userA, setEmbed, embedWords.correct, 10);
		expect(results).not.toContain(embedOtherUserSameSetWord);
	});

	it("不正な k(0以下・非整数)は実行前に弾く", async () => {
		await expect(
			findNearestWordIdsForWord(db, userA, setEmbed, embedWords.correct, 0),
		).rejects.toThrow();
	});
});

describe("generateQuiz（ベクトル近傍ディストラクタ）", () => {
	it("正解語に埋め込みがあり近傍3語以上ある場合、ディストラクタ3件が全て近傍群の語から選ばれる(遠い群は混入しない)", async () => {
		const result = await generateQuiz(
			db,
			{ userId: userA, wordSetId: setNeighborMany, scope: "all", direction: "wordToMeaning", count: 10 },
			fakeRng,
		);

		const correctQuestion = result.questions.find((q) => q.wordId === neighborManyWords.correct);
		expect(correctQuestion).toBeDefined();
		if (!correctQuestion) return;

		const correctText = correctQuestion.choices[correctQuestion.correctIndex];
		const distractorChoices = correctQuestion.choices.filter((choice) => choice !== correctText);
		expect(distractorChoices).toHaveLength(3);
		expect([...distractorChoices].sort()).toEqual(["近傍語1", "近傍語2", "近傍語3"].sort());
		expect(distractorChoices).not.toContain("遠語1");
		expect(distractorChoices).not.toContain("遠語2");
	});

	it("近傍が1語しか無い場合、近傍語は必ず含みつつ残りはフォールバックで埋めて計3件になる", async () => {
		const result = await generateQuiz(
			db,
			{ userId: userA, wordSetId: setNeighborOne, scope: "all", direction: "wordToMeaning", count: 10 },
			fakeRng,
		);

		const correctQuestion = result.questions.find((q) => q.wordId === neighborOneWords.correct);
		expect(correctQuestion).toBeDefined();
		if (!correctQuestion) return;

		const correctText = correctQuestion.choices[correctQuestion.correctIndex];
		const distractorChoices = correctQuestion.choices.filter((choice) => choice !== correctText);
		expect(distractorChoices).toHaveLength(3);
		// 唯一の近傍語は必ずディストラクタに含まれる(preferred優先の証拠)
		expect(distractorChoices).toContain("近傍単独語");
	});

	it("正解語に埋め込みが無い場合でもディストラクタ3件が揃う(ランダムフォールバック)", async () => {
		const result = await generateQuiz(
			db,
			{ userId: userA, wordSetId: setNeighborNone, scope: "all", direction: "wordToMeaning", count: 10 },
			fakeRng,
		);

		const correctQuestion = result.questions.find((q) => q.wordId === neighborNoneWords.correct);
		expect(correctQuestion).toBeDefined();
		if (!correctQuestion) return;

		const correctText = correctQuestion.choices[correctQuestion.correctIndex];
		const distractorChoices = correctQuestion.choices.filter((choice) => choice !== correctText);
		expect(distractorChoices).toHaveLength(3);
	});
});
