import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviewLog, reviewState, user, word, wordMeaning, wordSet } from "../../db";
import { createTestDb } from "../../test/helpers";
import { createTestContext, type TestContext } from "../../test/setup";
import { recordCardSwipe } from "./service";

// ===========================================================================
// カードのスワイプ記録（P3-2）
// カードは単語1枚・評価も単語単位なので、配下の全 meaning に同じ結果が適用される。
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let db: ReturnType<typeof createTestDb>;

const userId = "swipe-user";
const setId = "swipe-set";

// 意味2件（単語単位の一括更新と isMastered の導出を確認する）
const multiWordId = "swipe-word-multi";
const multiMeaningId1 = "swipe-meaning-multi-1";
const multiMeaningId2 = "swipe-meaning-multi-2";
// 意味なし（デッキには出ないが、防御的な挙動を確認する）
const noMeaningWordId = "swipe-word-no-meaning";

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	db = createTestDb(ctx);

	await db
		.insert(user)
		.values({ id: userId, name: "Swipe User", email: "swipe@example.com" });
	await db.insert(wordSet).values({ id: setId, userId, name: "Swipe Set" });
	await db.insert(word).values([
		{ id: multiWordId, userId, wordSetId: setId, text: "ephemeral" },
		{ id: noMeaningWordId, userId, wordSetId: setId, text: "nomeaning" },
	]);
	await db.insert(wordMeaning).values([
		{ id: multiMeaningId1, wordId: multiWordId, meaning: "短命な", slot: 1 },
		{ id: multiMeaningId2, wordId: multiWordId, meaning: "はかない", slot: 2 },
	]);
});

afterAll(() => {
	ctx.cleanup();
});

describe("recordCardSwipe", () => {
	it("右スワイプ(remembered=true): 全ての意味が習得済みになり isMastered=true になる", async () => {
		const result = await recordCardSwipe(db, {
			wordId: multiWordId,
			remembered: true,
		});

		expect(result).toEqual({ isRemembered: true, isMastered: true });

		const meanings = await db.query.wordMeaning.findMany({
			where: eq(wordMeaning.wordId, multiWordId),
		});
		expect(meanings.every((meaning) => meaning.isRemembered)).toBe(true);

		const target = await db.query.word.findFirst({
			where: eq(word.id, multiWordId),
		});
		expect(target!.isMastered).toBe(true);
		// 既存の lastReviewedAt も更新される
		expect(target!.lastReviewedAt).not.toBeNull();
	});

	it("review_log が意味ごとに mode=flashcard / result=known で残る", async () => {
		const logs = await db.query.reviewLog.findMany({
			where: eq(reviewLog.wordId, multiWordId),
		});

		expect(logs).toHaveLength(2);
		expect(logs.every((log) => log.mode === "flashcard")).toBe(true);
		expect(logs.every((log) => log.result === "known")).toBe(true);
		expect(logs.map((log) => log.meaningId).sort()).toEqual(
			[multiMeaningId1, multiMeaningId2].sort(),
		);
	});

	it("review_state が意味ごとに作られ、正答扱いで reps が加算される", async () => {
		const state = await db.query.reviewState.findFirst({
			where: eq(reviewState.meaningId, multiMeaningId1),
		});

		expect(state!.reps).toBe(1);
		expect(state!.lapses).toBe(0);
	});

	it("左スワイプ(remembered=false): 全ての意味が未習得に戻り isMastered=false になる", async () => {
		const result = await recordCardSwipe(db, {
			wordId: multiWordId,
			remembered: false,
		});

		expect(result).toEqual({ isRemembered: false, isMastered: false });

		const meanings = await db.query.wordMeaning.findMany({
			where: eq(wordMeaning.wordId, multiWordId),
		});
		expect(meanings.every((meaning) => meaning.isRemembered)).toBe(false);

		const target = await db.query.word.findFirst({
			where: eq(word.id, multiWordId),
		});
		expect(target!.isMastered).toBe(false);

		// 忘却として lapses が加算され、reps はリセットされる
		const state = await db.query.reviewState.findFirst({
			where: eq(reviewState.meaningId, multiMeaningId1),
		});
		expect(state!.reps).toBe(0);
		expect(state!.lapses).toBe(1);

		const logs = await db.query.reviewLog.findMany({
			where: eq(reviewLog.wordId, multiWordId),
		});
		expect(logs).toHaveLength(4);
		expect(logs.filter((log) => log.result === "unknown")).toHaveLength(2);
	});

	it("意味を持たない単語は何も記録せず isRemembered/isMastered ともに false", async () => {
		const result = await recordCardSwipe(db, {
			wordId: noMeaningWordId,
			remembered: true,
		});

		expect(result).toEqual({ isRemembered: false, isMastered: false });

		const logs = await db.query.reviewLog.findMany({
			where: eq(reviewLog.wordId, noMeaningWordId),
		});
		expect(logs).toEqual([]);

		const target = await db.query.word.findFirst({
			where: eq(word.id, noMeaningWordId),
		});
		// 意味が無い単語を習得済みにしてしまわない
		expect(target!.isMastered).toBe(false);
	});
});
