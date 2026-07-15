import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { user, word, wordMeaning, wordSet } from "../../db";
import { createTestDb } from "../../test/helpers";
import { createTestContext, type TestContext } from "../../test/setup";
import {
	applyWordCompletion,
	markWordCompletionFailed,
	markWordCompletionPending,
} from "./repository";

// ===========================================================================
// AI補完 repository の単体テスト
// 特に「生成中のユーザー編集を上書きしない」トランザクション内再チェックと、
// completionStatus 遷移のガードを検証する。
// ===========================================================================

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let db: ReturnType<typeof createTestDb>;

const userA = "ai-repo-user";
const setA = "ai-repo-set";

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	db = createTestDb(ctx);

	await db.insert(user).values({ id: userA, name: "U", email: "ai-repo@example.com" });
	await db.insert(wordSet).values({ id: setA, userId: userA, name: "Set" });
});

const insertWordWithMeaning = async (
	wordId: string,
	meaningId: string,
	overrides?: Partial<typeof wordMeaning.$inferInsert>,
) => {
	await db.insert(word).values({
		id: wordId,
		userId: userA,
		wordSetId: setA,
		text: wordId,
		completionStatus: "pending",
	});
	await db.insert(wordMeaning).values({
		id: meaningId,
		wordId,
		slot: 1,
		meaning: "",
		...overrides,
	});
};

describe("applyWordCompletion (fillBlanksOnly)", () => {
	it("空欄のフィールドだけ埋め、生成中に入力された値は上書きしない", async () => {
		await insertWordWithMeaning("w-fill", "m-fill", {
			// 生成中にユーザーが meaning を入力した想定（スナップショット後の編集）
			meaning: "ユーザーが入力した意味",
			example: "",
		});

		await applyWordCompletion(
			db,
			"w-fill",
			{
				// merge はスナップショット時点（meaning が空欄）の判断で作られている
				updates: [
					{ id: "m-fill", patch: { meaning: "AIの意味", example: "AIの例文" } },
				],
				inserts: [],
			},
			{ fillBlanksOnly: true },
		);

		const m = await db.query.wordMeaning.findFirst({
			where: eq(wordMeaning.id, "m-fill"),
		});
		expect(m?.meaning).toBe("ユーザーが入力した意味");
		expect(m?.example).toBe("AIの例文");
		const w = await db.query.word.findFirst({ where: eq(word.id, "w-fill") });
		expect(w?.completionStatus).toBe("done");
	});

	it("生成中に埋まったスロットへの新規追加は捨てる", async () => {
		await insertWordWithMeaning("w-slot", "m-slot1", { meaning: "既存1" });
		// 生成中にユーザーが slot2 を追加した想定
		await db.insert(wordMeaning).values({
			id: "m-slot2",
			wordId: "w-slot",
			slot: 2,
			meaning: "ユーザー追加の語義2",
		});

		await applyWordCompletion(
			db,
			"w-slot",
			{
				updates: [],
				inserts: [
					{
						slot: 2,
						meaning: "AI追加の語義2",
						partOfSpeech: null,
						phonetic: null,
						example: null,
						collocation: null,
						synonym: null,
						etymology: null,
					},
					{
						slot: 3,
						meaning: "AI追加の語義3",
						partOfSpeech: null,
						phonetic: null,
						example: null,
						collocation: null,
						synonym: null,
						etymology: null,
					},
				],
			},
			{ fillBlanksOnly: true },
		);

		const meanings = await db.query.wordMeaning.findMany({
			where: eq(wordMeaning.wordId, "w-slot"),
		});
		const bySlot = new Map(meanings.map((m) => [m.slot, m.meaning]));
		expect(bySlot.get(2)).toBe("ユーザー追加の語義2");
		expect(bySlot.get(3)).toBe("AI追加の語義3");
	});

	it("fillBlanksOnly でない（明示上書き）場合は入力済みでも上書きする", async () => {
		await insertWordWithMeaning("w-force", "m-force", { meaning: "元の意味" });

		await applyWordCompletion(
			db,
			"w-force",
			{
				updates: [{ id: "m-force", patch: { meaning: "上書き後の意味" } }],
				inserts: [],
			},
			{ fillBlanksOnly: false },
		);

		const m = await db.query.wordMeaning.findFirst({
			where: eq(wordMeaning.id, "m-force"),
		});
		expect(m?.meaning).toBe("上書き後の意味");
	});
});

describe("completionStatus の遷移ガード", () => {
	it("markWordCompletionFailed は pending のときだけ failed にする", async () => {
		await insertWordWithMeaning("w-done", "m-done", { meaning: "済" });
		await db
			.update(word)
			.set({ completionStatus: "done" })
			.where(eq(word.id, "w-done"));

		// 遅延した古いリトライが done を failed に倒さない
		await markWordCompletionFailed(db, "w-done");
		const w = await db.query.word.findFirst({ where: eq(word.id, "w-done") });
		expect(w?.completionStatus).toBe("done");

		await insertWordWithMeaning("w-pend", "m-pend");
		await markWordCompletionFailed(db, "w-pend");
		const w2 = await db.query.word.findFirst({ where: eq(word.id, "w-pend") });
		expect(w2?.completionStatus).toBe("failed");
	});

	it("markWordCompletionPending はすでに pending なら false（多重エンキュー防止）", async () => {
		await insertWordWithMeaning("w-idem", "m-idem", { meaning: "済" });
		await db
			.update(word)
			.set({ completionStatus: "done" })
			.where(eq(word.id, "w-idem"));

		const first = await markWordCompletionPending(db, userA, setA, "w-idem");
		expect(first).toBe(true);
		const second = await markWordCompletionPending(db, userA, setA, "w-idem");
		expect(second).toBe(false);
	});
});
