import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMBEDDING_DIM } from "../../db/word-schema";
import { user, word, wordSet } from "../../db";
import { createTestDb } from "../../test/helpers";
import { createTestContext, type TestContext } from "../../test/setup";
import { findNearestWordIds, upsertWordEmbedding } from "./repository";

// ===========================================================================
// Turso Vector 近傍検索の疎通確認（ダミーベクトル）
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let db: ReturnType<typeof createTestDb>;

const userA = "user-a";
const userB = "user-b";
const setA = "set-a";
const setB = "set-b";

// 先頭の数次元だけ与え、残りを0で EMBEDDING_DIM までパディングする
const vec = (values: number[]): number[] => {
	const v = new Array<number>(EMBEDDING_DIM).fill(0);
	for (let i = 0; i < values.length && i < EMBEDDING_DIM; i++) v[i] = values[i];
	return v;
};

// クエリ [1,0,0,...] に対するコサイン距離(1-cos類似度)の昇順:
//   near(同方向,0) < mid(45度,≈0.29) < far(直交,1) < opposite(逆方向,2)
const query = vec([1]);
const words = {
	near: "word-near",
	mid: "word-mid",
	far: "word-far",
	opposite: "word-opposite",
};

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	db = createTestDb(ctx);

	await db.insert(user).values([
		{ id: userA, name: "User A", email: "a@example.com" },
		{ id: userB, name: "User B", email: "b@example.com" },
	]);
	await db.insert(wordSet).values([
		{ id: setA, userId: userA, name: "Set A" },
		{ id: setB, userId: userB, name: "Set B" },
	]);
	await db.insert(word).values([
		{ id: words.near, userId: userA, wordSetId: setA, text: "near" },
		{ id: words.mid, userId: userA, wordSetId: setA, text: "mid" },
		{ id: words.far, userId: userA, wordSetId: setA, text: "far" },
		{ id: words.opposite, userId: userA, wordSetId: setA, text: "opposite" },
		// 別ユーザーの単語（スコープ確認用）。near と同方向にして近接させる。
		{ id: "word-other", userId: userB, wordSetId: setB, text: "other" },
	]);

	await upsertWordEmbedding(db, words.near, vec([1]), "dummy");
	await upsertWordEmbedding(db, words.mid, vec([1, 1]), "dummy");
	await upsertWordEmbedding(db, words.far, vec([0, 1]), "dummy");
	await upsertWordEmbedding(db, words.opposite, vec([-1]), "dummy");
	await upsertWordEmbedding(db, "word-other", vec([1]), "dummy");
});

afterAll(() => {
	ctx.cleanup();
});

describe("word_embedding 近傍検索", () => {
	it("クエリに近い順(コサイン距離昇順)で単語IDを返す", async () => {
		const results = await findNearestWordIds(db, userA, setA, query, 4);
		expect(results.map((r) => r.wordId)).toEqual([
			words.near,
			words.mid,
			words.far,
			words.opposite,
		]);
		// 同方向は距離ほぼ0、逆方向は距離ほぼ2
		expect(results[0].distance).toBeCloseTo(0, 5);
		expect(results[3].distance).toBeCloseTo(2, 5);
	});

	it("excludeWordId で指定した単語を除外できる", async () => {
		const results = await findNearestWordIds(db, userA, setA, query, 4, words.near);
		expect(results.map((r) => r.wordId)).not.toContain(words.near);
		expect(results[0].wordId).toBe(words.mid);
	});

	it("k で件数を制限できる", async () => {
		const results = await findNearestWordIds(db, userA, setA, query, 2);
		expect(results).toHaveLength(2);
		expect(results.map((r) => r.wordId)).toEqual([words.near, words.mid]);
	});

	it("他ユーザーの埋め込みは混ざらない（userId スコープ）", async () => {
		const results = await findNearestWordIds(db, userA, setA, query, 10);
		expect(results.map((r) => r.wordId)).not.toContain("word-other");
	});

	it("不正な入力(空ベクトル/非正のk)は実行前に弾く", async () => {
		await expect(
			upsertWordEmbedding(db, words.near, [], "dummy"),
		).rejects.toThrow();
		await expect(
			findNearestWordIds(db, userA, setA, query, 0),
		).rejects.toThrow();
		await expect(
			findNearestWordIds(db, userA, setA, [], 3),
		).rejects.toThrow();
	});

	it("upsert は同一単語のベクトルを上書きする", async () => {
		await upsertWordEmbedding(db, words.near, vec([-1]), "dummy-v2");
		// near を逆方向に更新したので、最も近いのは mid になる
		const results = await findNearestWordIds(db, userA, setA, query, 1);
		expect(results[0].wordId).toBe(words.mid);
		// 元に戻しておく
		await upsertWordEmbedding(db, words.near, vec([1]), "dummy");
	});
});
