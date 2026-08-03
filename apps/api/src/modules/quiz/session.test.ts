import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QuizSessionItem } from "@hudeato/schema";
import { quizSession, user, wordSet } from "../../db";
import { createTestDb } from "../../test/helpers";
import { createTestContext, type TestContext } from "../../test/setup";
import { getQuizSessionDetail, getQuizSessions, recordQuizSession } from "./service";

// ===========================================================================
// クイズセッション履歴(recordQuizSession / getQuizSessions / getQuizSessionDetail)
// の単体テスト
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let db: ReturnType<typeof createTestDb>;

const userA = "session-user-a";
const userB = "session-user-b";

const setA = "session-set-a";
const setAOther = "session-set-a-other";
const setB = "session-set-b";
// recordQuizSession の単体テスト専用セット(getQuizSessionsの順序テストに実時刻の
// createdAtが混入しないよう、setAとは分離する)。
const setRecord = "session-set-record";

// 基準時刻。createdAtを明示的にずらして順序テストを挿入順に依存させない。
const base = 1_700_000_000_000;

// テスト用のセッション項目を作る(correctCount算出・itemsJsonデノーマライズの検証用)。
const buildItems = (correctFlags: boolean[]): QuizSessionItem[] =>
	correctFlags.map((correct, i) => ({
		wordId: `word-${i}`,
		meaningId: `meaning-${i}`,
		prompt: `prompt-${i}`,
		selectedText: correct ? `correct-text-${i}` : null,
		correctText: `correct-text-${i}`,
		correct,
	}));

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	db = createTestDb(ctx);

	await db.insert(user).values([
		{ id: userA, name: "Session User A", email: "session-a@example.com" },
		{ id: userB, name: "Session User B", email: "session-b@example.com" },
	]);

	await db.insert(wordSet).values([
		{ id: setA, userId: userA, name: "Session Set A" },
		{ id: setAOther, userId: userA, name: "Session Set A Other" },
		{ id: setB, userId: userB, name: "Session Set B" },
		{ id: setRecord, userId: userA, name: "Session Set Record" },
	]);
});

afterAll(() => {
	ctx.cleanup();
});

describe("recordQuizSession", () => {
	it("itemsの正誤からcorrectCount/totalCountを算出し、itemsJsonをデノーマライズして保存する", async () => {
		const items = buildItems([true, false, true]);

		const result = await recordQuizSession(db, {
			userId: userA,
			wordSetId: setRecord,
			scope: "all",
			direction: "wordToMeaning",
			timeLimitSeconds: 20,
			items,
		});

		expect(result.correctCount).toBe(2);
		expect(result.totalCount).toBe(3);
		expect(result.scope).toBe("all");
		expect(result.direction).toBe("wordToMeaning");
		expect(result.timeLimitSeconds).toBe(20);
		expect(typeof result.id).toBe("string");
		expect(typeof result.createdAt).toBe("number");

		const row = await db.query.quizSession.findFirst({
			where: eq(quizSession.id, result.id),
		});
		expect(row).toBeTruthy();
		expect(row?.correctCount).toBe(2);
		expect(row?.totalCount).toBe(3);
		expect(JSON.parse(row!.itemsJson)).toEqual(items);
	});

	it("全問不正解ならcorrectCount=0になる", async () => {
		const items = buildItems([false, false]);

		const result = await recordQuizSession(db, {
			userId: userA,
			wordSetId: setRecord,
			scope: "unanswered",
			direction: "meaningToWord",
			timeLimitSeconds: 10,
			items,
		});

		expect(result.correctCount).toBe(0);
		expect(result.totalCount).toBe(2);
	});
});

describe("getQuizSessions", () => {
	// 挿入順とcreatedAt順をわざとずらし、orderBy欠落を検出できるようにする。
	const newest = "session-list-newest";
	const middle = "session-list-middle";
	const oldest = "session-list-oldest";
	// 別セット(同一ユーザー)。wordSetIdスコープの検証用。
	const otherSetSession = "session-list-other-set";
	// 同一セットIDだが別ユーザー。userIdスコープが単独で効いていることの検証用
	// (wordSetIdだけを条件にすると誤って混入する設計になっていないかを確認する)。
	const sameSetOtherUserSession = "session-list-same-set-other-user";

	beforeAll(async () => {
		await db.insert(quizSession).values([
			{
				id: oldest,
				userId: userA,
				wordSetId: setA,
				scope: "all",
				direction: "wordToMeaning",
				timeLimitSeconds: 10,
				correctCount: 1,
				totalCount: 1,
				itemsJson: JSON.stringify(buildItems([true])),
				createdAt: new Date(base),
			},
			{
				id: newest,
				userId: userA,
				wordSetId: setA,
				scope: "all",
				direction: "wordToMeaning",
				timeLimitSeconds: 10,
				correctCount: 1,
				totalCount: 1,
				itemsJson: JSON.stringify(buildItems([true])),
				createdAt: new Date(base + 3000),
			},
			{
				id: middle,
				userId: userA,
				wordSetId: setA,
				scope: "all",
				direction: "wordToMeaning",
				timeLimitSeconds: 10,
				correctCount: 1,
				totalCount: 1,
				itemsJson: JSON.stringify(buildItems([true])),
				createdAt: new Date(base + 1500),
			},
			{
				id: otherSetSession,
				userId: userA,
				wordSetId: setAOther,
				scope: "all",
				direction: "wordToMeaning",
				timeLimitSeconds: 10,
				correctCount: 1,
				totalCount: 1,
				itemsJson: JSON.stringify(buildItems([true])),
				createdAt: new Date(base + 4000),
			},
			{
				id: sameSetOtherUserSession,
				// setA はuserA所有だが、行だけuserIdをuserBにして紛れ込ませる
				userId: userB,
				wordSetId: setA,
				scope: "all",
				direction: "wordToMeaning",
				timeLimitSeconds: 10,
				correctCount: 1,
				totalCount: 1,
				itemsJson: JSON.stringify(buildItems([true])),
				createdAt: new Date(base + 5000),
			},
		]);
	});

	it("作成日時の降順で返る(挿入順には依存しない)", async () => {
		const result = await getQuizSessions(db, userA, setA, 10);
		expect(result.map((r) => r.id)).toEqual([newest, middle, oldest]);
	});

	it("limitで件数が絞られ、新しい順の上位が返る", async () => {
		const result = await getQuizSessions(db, userA, setA, 2);
		expect(result.map((r) => r.id)).toEqual([newest, middle]);
	});

	it("同一setIdでも他ユーザーの行は混入しない(userIdスコープ)", async () => {
		const result = await getQuizSessions(db, userA, setA, 10);
		expect(result.map((r) => r.id)).not.toContain(sameSetOtherUserSession);
	});

	it("同一ユーザーでも他セットの行は混入しない(wordSetIdスコープ)", async () => {
		const result = await getQuizSessions(db, userA, setA, 10);
		expect(result.map((r) => r.id)).not.toContain(otherSetSession);
	});

	it("itemsJson/itemsを含まない軽量サマリのみを返す", async () => {
		const result = await getQuizSessions(db, userA, setA, 10);
		for (const row of result) {
			expect(row).not.toHaveProperty("itemsJson");
			expect(row).not.toHaveProperty("items");
		}
	});
});

describe("getQuizSessionDetail", () => {
	it("所有するセッションの詳細をitems込みで取得できる", async () => {
		const items = buildItems([true, false]);
		const created = await recordQuizSession(db, {
			userId: userA,
			wordSetId: setRecord,
			scope: "all",
			direction: "wordToMeaning",
			timeLimitSeconds: 30,
			items,
		});

		const result = await getQuizSessionDetail(db, userA, setRecord, created.id);

		expect(result).not.toBeNull();
		expect(result?.items).toEqual(items);
		expect(result?.correctCount).toBe(1);
		expect(result?.totalCount).toBe(2);
		expect(result?.timeLimitSeconds).toBe(30);
	});

	it("他ユーザーのセッションはnullを返す(所有スコープ)", async () => {
		const created = await recordQuizSession(db, {
			userId: userA,
			wordSetId: setRecord,
			scope: "all",
			direction: "wordToMeaning",
			timeLimitSeconds: 20,
			items: buildItems([true]),
		});

		const result = await getQuizSessionDetail(db, userB, setRecord, created.id);
		expect(result).toBeNull();
	});

	it("正しいユーザーでも別セット指定ならnullを返す", async () => {
		const created = await recordQuizSession(db, {
			userId: userA,
			wordSetId: setRecord,
			scope: "all",
			direction: "wordToMeaning",
			timeLimitSeconds: 20,
			items: buildItems([true]),
		});

		const result = await getQuizSessionDetail(db, userA, setAOther, created.id);
		expect(result).toBeNull();
	});

	it("存在しないセッションIDはnullを返す", async () => {
		const result = await getQuizSessionDetail(db, userA, setRecord, "no-such-session");
		expect(result).toBeNull();
	});

	it("itemsJsonの構文が壊れている場合はitems:[]で防御的に返す", async () => {
		const brokenId = "session-detail-broken-json";
		await db.insert(quizSession).values({
			id: brokenId,
			userId: userA,
			wordSetId: setRecord,
			scope: "all",
			direction: "wordToMeaning",
			timeLimitSeconds: 20,
			correctCount: 1,
			totalCount: 2,
			itemsJson: "not-valid-json{{{",
		});

		const result = await getQuizSessionDetail(db, userA, setRecord, brokenId);
		expect(result).not.toBeNull();
		expect(result?.items).toEqual([]);
		// items が壊れていても、他の列(件数など)はDBの値をそのまま返す
		expect(result?.correctCount).toBe(1);
		expect(result?.totalCount).toBe(2);
	});

	it("itemsJsonの中身がスキーマに違反している場合もitems:[]で防御的に返す", async () => {
		const invalidId = "session-detail-invalid-schema";
		await db.insert(quizSession).values({
			id: invalidId,
			userId: userA,
			wordSetId: setRecord,
			scope: "all",
			direction: "wordToMeaning",
			timeLimitSeconds: 20,
			correctCount: 0,
			totalCount: 1,
			// JSONとしては正しいが、QuizSessionItemの形になっていない
			itemsJson: JSON.stringify([{ foo: "bar" }]),
		});

		const result = await getQuizSessionDetail(db, userA, setRecord, invalidId);
		expect(result).not.toBeNull();
		expect(result?.items).toEqual([]);
	});
});
