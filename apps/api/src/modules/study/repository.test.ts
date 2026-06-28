import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { user, word, wordSet } from "../../db";
import { createTestDb } from "../../test/helpers";
import { createTestContext, type TestContext } from "../../test/setup";
import { findTargetWordIds } from "./repository";

// ===========================================================================
// 出題対象抽出 repository の単体テスト
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let db: ReturnType<typeof createTestDb>;

const userA = "user-a";
const userB = "user-b";
const setA = "set-a";
const setB = "set-b";
const wordIds = {
	a1: "word-a1",
	a2: "word-a2",
	a3mastered: "word-a3",
	b1: "word-b1",
};

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	db = createTestDb(ctx);

	// word.userId は user.id を参照する(FK有効)ため、先にユーザーを作る
	await db.insert(user).values([
		{ id: userA, name: "User A", email: "a@example.com" },
		{ id: userB, name: "User B", email: "b@example.com" },
	]);

	await db.insert(wordSet).values([
		{ id: setA, userId: userA, name: "Set A" },
		{ id: setB, userId: userB, name: "Set B" },
	]);

	// createdAt を明示して登録順を固定する
	const base = new Date("2026-01-01T00:00:00Z").getTime();
	await db.insert(word).values([
		{
			id: wordIds.a1,
			userId: userA,
			wordSetId: setA,
			text: "alpha",
			isMastered: false,
			createdAt: new Date(base + 1000),
		},
		{
			id: wordIds.a2,
			userId: userA,
			wordSetId: setA,
			text: "bravo",
			isMastered: false,
			createdAt: new Date(base + 2000),
		},
		{
			id: wordIds.a3mastered,
			userId: userA,
			wordSetId: setA,
			text: "charlie",
			isMastered: true,
			createdAt: new Date(base + 3000),
		},
		{
			id: wordIds.b1,
			userId: userB,
			wordSetId: setB,
			text: "delta",
			isMastered: false,
			createdAt: new Date(base + 4000),
		},
	]);
});

afterAll(() => {
	ctx.cleanup();
});

describe("findTargetWordIds", () => {
	it("scope=all はセット内の全件を登録順で返す", async () => {
		const ids = await findTargetWordIds(db, userA, setA, "all");
		expect(ids).toEqual([wordIds.a1, wordIds.a2, wordIds.a3mastered]);
	});

	it("scope=unmastered は未習得の言葉のみ返す", async () => {
		const ids = await findTargetWordIds(db, userA, setA, "unmastered");
		expect(ids).toEqual([wordIds.a1, wordIds.a2]);
	});

	it("他ユーザーのデータは混ざらない", async () => {
		// userA のIDで userB のセットを引いても 0 件
		const ids = await findTargetWordIds(db, userA, setB, "all");
		expect(ids).toEqual([]);
		// userB は自分のセットのみ見える
		const idsB = await findTargetWordIds(db, userB, setB, "all");
		expect(idsB).toEqual([wordIds.b1]);
	});
});
