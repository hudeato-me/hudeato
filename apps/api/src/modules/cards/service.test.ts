import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { user, word, wordMeaning, wordSet } from "../../db";
import { createTestDb } from "../../test/helpers";
import { createTestContext, type TestContext } from "../../test/setup";
import { generateCardDeck } from "./service";

// ===========================================================================
// カードデッキ生成（P3-1）
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let db: ReturnType<typeof createTestDb>;

const userId = "cards-user-a";
const otherUserId = "cards-user-b";
const setId = "cards-set-a";
const otherSetId = "cards-set-b";

// 意味2件・未習得（slot をわざと逆順で挿入し orderBy 欠落を検出する）
const multiWordId = "cards-word-multi";
// 意味1件・習得済み（scope=unmastered で除外されることの確認用）
const masteredWordId = "cards-word-mastered";
// 意味が空文字のみ（カードとして成立しないため除外される）
const emptyMeaningWordId = "cards-word-empty-meaning";
// 意味を1件も持たない（AI補完待ちを想定。除外される）
const noMeaningWordId = "cards-word-no-meaning";

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	db = createTestDb(ctx);

	await db.insert(user).values([
		{ id: userId, name: "Cards User A", email: "cards-a@example.com" },
		{ id: otherUserId, name: "Cards User B", email: "cards-b@example.com" },
	]);
	await db.insert(wordSet).values([
		{ id: setId, userId, name: "Cards Set A" },
		{ id: otherSetId, userId: otherUserId, name: "Cards Set B" },
	]);

	// createdAt を明示して並び順を決定的にする
	await db.insert(word).values([
		{
			id: multiWordId,
			userId,
			wordSetId: setId,
			text: "  ephemeral  ",
			createdAt: new Date(1000),
		},
		{
			id: masteredWordId,
			userId,
			wordSetId: setId,
			text: "mastered",
			isMastered: true,
			createdAt: new Date(2000),
		},
		{
			id: emptyMeaningWordId,
			userId,
			wordSetId: setId,
			text: "emptymeaning",
			createdAt: new Date(3000),
		},
		{
			id: noMeaningWordId,
			userId,
			wordSetId: setId,
			text: "nomeaning",
			createdAt: new Date(4000),
		},
		{
			id: "cards-word-other",
			userId: otherUserId,
			wordSetId: otherSetId,
			text: "otheruser",
		},
	]);
	await db.insert(wordMeaning).values([
		{
			id: "cards-meaning-multi-2",
			wordId: multiWordId,
			meaning: "2番目の意味",
			slot: 2,
		},
		{
			id: "cards-meaning-multi-1",
			wordId: multiWordId,
			meaning: "  短命な  ",
			partOfSpeech: "adjective",
			phonetic: "/ɪˈfem(ə)rəl/",
			example: "an ephemeral moment",
			slot: 1,
		},
		{
			id: "cards-meaning-mastered",
			wordId: masteredWordId,
			meaning: "習得済みの意味",
			isRemembered: true,
			slot: 1,
		},
		{
			id: "cards-meaning-empty",
			wordId: emptyMeaningWordId,
			meaning: "   ",
			slot: 1,
		},
		{
			id: "cards-meaning-other",
			wordId: "cards-word-other",
			meaning: "他ユーザーの意味",
			slot: 1,
		},
	]);
});

afterAll(() => {
	ctx.cleanup();
});

describe("generateCardDeck", () => {
	it("scope=all: 意味を持つ単語がカードになり、意味はslot昇順で並ぶ", async () => {
		const result = await generateCardDeck(db, userId, setId, "all", 30);

		expect(result.scope).toBe("all");
		expect(result.cards.map((card) => card.wordId)).toEqual([
			multiWordId,
			masteredWordId,
		]);

		const [multi] = result.cards;
		// 表示テキストは trim される
		expect(multi.text).toBe("ephemeral");
		expect(multi.meanings.map((meaning) => meaning.slot)).toEqual([1, 2]);
		expect(multi.meanings[0].meaning).toBe("短命な");
		// 表面の補助情報（発音記号・品詞）と裏面の例文が1往復で揃う
		expect(multi.meanings[0].phonetic).toBe("/ɪˈfem(ə)rəl/");
		expect(multi.meanings[0].partOfSpeech).toBe("adjective");
		expect(multi.meanings[0].example).toBe("an ephemeral moment");
		expect(multi.isMastered).toBe(false);
	});

	it("意味が空文字のみ・意味なしの単語はカードにしない", async () => {
		const result = await generateCardDeck(db, userId, setId, "all", 30);
		const wordIds = result.cards.map((card) => card.wordId);

		expect(wordIds).not.toContain(emptyMeaningWordId);
		expect(wordIds).not.toContain(noMeaningWordId);
	});

	it("scope=unmastered: 習得済みの単語を除外する", async () => {
		const result = await generateCardDeck(db, userId, setId, "unmastered", 30);

		expect(result.scope).toBe("unmastered");
		expect(result.cards.map((card) => card.wordId)).toEqual([multiWordId]);
	});

	it("limit で取得枚数を絞る", async () => {
		const result = await generateCardDeck(db, userId, setId, "all", 1);

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0].wordId).toBe(multiWordId);
	});

	it("他ユーザーのセットは空デッキになる", async () => {
		const result = await generateCardDeck(db, userId, otherSetId, "all", 30);

		expect(result.cards).toEqual([]);
	});

	it("isMastered が後から変わってもデッキに反映される", async () => {
		await db
			.update(word)
			.set({ isMastered: true })
			.where(eq(word.id, multiWordId));

		const result = await generateCardDeck(db, userId, setId, "unmastered", 30);
		expect(result.cards).toEqual([]);

		await db
			.update(word)
			.set({ isMastered: false })
			.where(eq(word.id, multiWordId));
	});
});
