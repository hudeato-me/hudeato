import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// workers-ai モジュールをモックして、生成結果を差し替えられるようにする。
const { generateWordCompletion, generateEmbedding } = vi.hoisted(() => ({
	generateWordCompletion: vi.fn(),
	generateEmbedding: vi.fn(),
}));
vi.mock("./workers-ai", () => ({
	generateWordCompletion,
	generateEmbedding,
	WORKERS_AI_EMBEDDING_MODEL: "@cf/google/embeddinggemma-300m",
}));

import { user, word, wordEmbedding, wordMeaning, wordSet } from "../../db";
import { EMBEDDING_DIM } from "../../db/word-schema";
import { createTestDb } from "../../test/helpers";
import { createTestContext, type TestContext } from "../../test/setup";
import { meaningCacheKey } from "./cache";
import {
	buildEmbeddingInput,
	completeWord,
	generateWordEmbedding,
	hasEmptyCompletionFields,
	mergeEmptyFields,
	mergeTargetedFields,
} from "./completion";
import type { CompletionMeaningRow } from "./repository";

// 補完テスト用のインメモリ共有キャッシュ（Workers KV 相当）。
const makeFakeKv = () => {
	const store = new Map<string, string>();
	return {
		store,
		get: vi.fn(async (key: string) => {
			const raw = store.get(key);
			return raw == null ? null : JSON.parse(raw);
		}),
		put: vi.fn(async (key: string, value: string) => {
			store.set(key, value);
		}),
	};
};

// 生成関数はモジュールごとモックするため、AIバインディングはダミーでよい。
const fakeAi = { run: vi.fn() };

// ---------------------------------------------------------------------------
// 純粋関数（DB不要）
// ---------------------------------------------------------------------------

describe("hasEmptyCompletionFields", () => {
	it("意味が空配列なら true（全てAI任せ）", () => {
		expect(hasEmptyCompletionFields([])).toBe(true);
	});

	it("いずれかの補完対象が空なら true", () => {
		expect(hasEmptyCompletionFields([{ meaning: "x", example: "" }])).toBe(true);
		expect(hasEmptyCompletionFields([{ meaning: "x", phonetic: null }])).toBe(
			true,
		);
	});

	it("補完対象が全て埋まっていれば false", () => {
		expect(
			hasEmptyCompletionFields([
				{
					meaning: "x",
					partOfSpeech: "n",
					phonetic: "p",
					example: "e",
					collocation: "c",
					synonym: "s",
					etymology: "y",
				},
			]),
		).toBe(false);
	});
});

describe("mergeEmptyFields", () => {
	const row = (over: Partial<CompletionMeaningRow>): CompletionMeaningRow => ({
		id: "m1",
		slot: 1,
		meaning: "",
		partOfSpeech: null,
		phonetic: null,
		example: null,
		collocation: null,
		synonym: null,
		etymology: null,
		...over,
	});

	it("既存の空欄だけ埋め、入力済みは触らない", () => {
		const existing = [
			row({ id: "m1", meaning: "入力済み", example: "既存例文" }),
		];
		const generated = [
			{
				meaning: "AI意味",
				partOfSpeech: "名詞",
				phonetic: "/x/",
				example: "AI例文",
				collocation: "col",
				synonym: "syn",
				etymology: "ety",
			},
		];
		const { updates, inserts } = mergeEmptyFields(existing, generated);
		expect(inserts).toHaveLength(0);
		expect(updates).toHaveLength(1);
		expect(updates[0].id).toBe("m1");
		// 入力済みは触らない
		expect(updates[0].patch.meaning).toBeUndefined();
		expect(updates[0].patch.example).toBeUndefined();
		// 空だった項目は埋まる
		expect(updates[0].patch.partOfSpeech).toBe("名詞");
		expect(updates[0].patch.phonetic).toBe("/x/");
		expect(updates[0].patch.synonym).toBe("syn");
	});

	it("既存が無ければ AI 語義を新規スロットに追加する", () => {
		const { updates, inserts } = mergeEmptyFields(
			[],
			[{ meaning: "一つ目" }, { meaning: "二つ目" }],
		);
		expect(updates).toHaveLength(0);
		expect(inserts.map((i) => [i.slot, i.meaning])).toEqual([
			[1, "一つ目"],
			[2, "二つ目"],
		]);
	});

	it("追加スロットは最大5まで", () => {
		const generated = Array.from({ length: 8 }, (_, i) => ({
			meaning: `m${i}`,
		}));
		const { inserts } = mergeEmptyFields([], generated);
		expect(inserts).toHaveLength(5);
		expect(inserts[4].slot).toBe(5);
	});
});

describe("mergeTargetedFields", () => {
	const row = (over: Partial<CompletionMeaningRow>): CompletionMeaningRow => ({
		id: "m1",
		slot: 1,
		meaning: "",
		partOfSpeech: null,
		phonetic: null,
		example: null,
		collocation: null,
		synonym: null,
		etymology: null,
		...over,
	});

	it("指定した欄は入力済みでも上書きし、指定外には触らない", () => {
		const existing = [
			row({ id: "m1", slot: 1, meaning: "古い意味", example: "古い例文" }),
		];
		const generated = [
			{ meaning: "新しい意味", example: "新しい例文", synonym: "syn" },
		];
		const { updates, inserts } = mergeTargetedFields(existing, generated, [
			{ slot: 1, fields: ["example"] },
		]);
		expect(inserts).toHaveLength(0);
		expect(updates).toEqual([
			{ id: "m1", patch: { example: "新しい例文" } },
		]);
	});

	it("存在しないslotの指定やAI出力が空の欄はスキップする", () => {
		const existing = [row({ id: "m1", slot: 1, meaning: "意味" })];
		const generated = [{ meaning: "新", example: null }];
		const { updates } = mergeTargetedFields(existing, generated, [
			{ slot: 3, fields: ["meaning"] }, // slot 3 は存在しない
			{ slot: 1, fields: ["example"] }, // AI出力が null
		]);
		expect(updates).toHaveLength(0);
	});

	it("新規語義の追加は行わない", () => {
		const existing = [row({ id: "m1", slot: 1, meaning: "意味" })];
		const generated = [{ meaning: "a" }, { meaning: "b" }, { meaning: "c" }];
		const { inserts } = mergeTargetedFields(existing, generated, [
			{ slot: 1, fields: ["meaning"] },
		]);
		expect(inserts).toHaveLength(0);
	});
});

describe("buildEmbeddingInput", () => {
	it("単語と意味を結合する", () => {
		expect(
			buildEmbeddingInput("ephemeral", [
				{ meaning: "はかない" },
				{ meaning: "つかの間の" },
			]),
		).toBe("ephemeral: はかない; つかの間の");
	});

	it("意味が無ければ単語のみ", () => {
		expect(buildEmbeddingInput("ephemeral", [])).toBe("ephemeral");
	});
});

// ---------------------------------------------------------------------------
// completeWord / generateWordEmbedding（DB結合・workers-aiモック）
// ---------------------------------------------------------------------------

describe("completeWord", () => {
	let ctx: TestContext & { _applyMigrations: () => Promise<void> };
	let db: ReturnType<typeof createTestDb>;
	let cache: ReturnType<typeof makeFakeKv>;

	beforeAll(async () => {
		ctx = createTestContext() as TestContext & {
			_applyMigrations: () => Promise<void>;
		};
		await ctx._applyMigrations();
		db = createTestDb(ctx);
		await db.insert(user).values({ id: "u1", name: "U", email: "u@example.com" });
		await db.insert(wordSet).values({ id: "s1", userId: "u1", name: "S" });
	});

	afterAll(() => ctx.cleanup());
	beforeEach(() => {
		vi.clearAllMocks();
		cache = makeFakeKv();
	});

	it("空欄のみ補完し、入力済みは保持して status を done にする", async () => {
		await db.insert(word).values({
			id: "w1",
			userId: "u1",
			wordSetId: "s1",
			text: "ephemeral",
			completionStatus: "pending",
		});
		await db.insert(wordMeaning).values({
			id: "m1",
			wordId: "w1",
			meaning: "",
			slot: 1,
			example: "手入力の例文",
		});
		generateWordCompletion.mockResolvedValue({
			meanings: [
				{
					meaning: "はかない",
					partOfSpeech: "形容詞",
					example: "AI例文",
					phonetic: "/ɪˈfɛm(ə)rəl/",
					collocation: null,
					synonym: null,
					etymology: null,
				},
			],
		});

		await completeWord(
			{ db, ai: fakeAi, cache },
			{ wordId: "w1", userId: "u1", wordSetId: "s1", lang: "ja", prompt: null },
		);

		const m = await db.query.wordMeaning.findFirst({
			where: eq(wordMeaning.id, "m1"),
		});
		expect(m?.meaning).toBe("はかない"); // 空だったので補完
		expect(m?.partOfSpeech).toBe("形容詞");
		expect(m?.phonetic).toBe("/ɪˈfɛm(ə)rəl/");
		expect(m?.example).toBe("手入力の例文"); // 入力済みは保持
		const w = await db.query.word.findFirst({ where: eq(word.id, "w1") });
		expect(w?.completionStatus).toBe("done");
	});

	it("意味が無い単語には AI 語義を新規追加する", async () => {
		await db.insert(word).values({
			id: "w2",
			userId: "u1",
			wordSetId: "s1",
			text: "serendipity",
			completionStatus: "pending",
		});
		generateWordCompletion.mockResolvedValue({
			meanings: [{ meaning: "偶然の幸運" }, { meaning: "掘り出し上手" }],
		});

		await completeWord(
			{ db, ai: fakeAi, cache },
			{ wordId: "w2", userId: "u1", wordSetId: "s1", lang: "ja", prompt: null },
		);

		const ms = await db.query.wordMeaning.findMany({
			where: eq(wordMeaning.wordId, "w2"),
			orderBy: [asc(wordMeaning.slot)],
		});
		expect(ms.map((m) => m.meaning)).toEqual(["偶然の幸運", "掘り出し上手"]);
		const w = await db.query.word.findFirst({ where: eq(word.id, "w2") });
		expect(w?.completionStatus).toBe("done");
	});

	it("promptを生成に渡す", async () => {
		await db.insert(word).values({
			id: "w3",
			userId: "u1",
			wordSetId: "s1",
			text: "bank",
			completionStatus: "pending",
		});
		generateWordCompletion.mockResolvedValue({
			meanings: [{ meaning: "土手" }],
		});

		await completeWord(
			{ db, ai: fakeAi, cache },
			{
				wordId: "w3",
				userId: "u1",
				wordSetId: "s1",
				lang: "ja",
				prompt: "川辺の文脈で",
			},
		);

		expect(generateWordCompletion).toHaveBeenCalledWith(
			expect.objectContaining({ word: "bank", prompt: "川辺の文脈で" }),
		);
	});

	it("存在しない単語では生成を呼ばず何もしない", async () => {
		generateWordCompletion.mockResolvedValue({ meanings: [{ meaning: "x" }] });
		await expect(
			completeWord(
				{ db, ai: fakeAi, cache },
				{
					wordId: "ghost",
					userId: "u1",
					wordSetId: "s1",
					lang: "ja",
					prompt: null,
				},
			),
		).resolves.toBeUndefined();
		expect(generateWordCompletion).not.toHaveBeenCalled();
	});

	it("他ユーザーの単語は補完対象にしない（スコープ）", async () => {
		await db.insert(user).values({ id: "u2", name: "U2", email: "u2@example.com" });
		await db.insert(word).values({
			id: "w-other",
			userId: "u2",
			wordSetId: "s1",
			text: "foreign",
			completionStatus: "pending",
		});
		generateWordCompletion.mockResolvedValue({ meanings: [{ meaning: "x" }] });

		// u1 として w-other を補完しようとしても対象が見つからない
		await completeWord(
			{ db, ai: fakeAi, cache },
			{
				wordId: "w-other",
				userId: "u1",
				wordSetId: "s1",
				lang: "ja",
				prompt: null,
			},
		);
		expect(generateWordCompletion).not.toHaveBeenCalled();
	});

	it("キャッシュヒット時は AI を呼ばずキャッシュの意味で補完する", async () => {
		await db.insert(word).values({
			id: "w-cache",
			userId: "u1",
			wordSetId: "s1",
			text: "cached-word",
			completionStatus: "pending",
		});
		// 共有キャッシュに事前投入
		cache.store.set(
			meaningCacheKey("cached-word", "ja"),
			JSON.stringify([{ meaning: "キャッシュ意味", partOfSpeech: "名詞" }]),
		);

		await completeWord(
			{ db, ai: fakeAi, cache },
			{
				wordId: "w-cache",
				userId: "u1",
				wordSetId: "s1",
				lang: "ja",
				prompt: null,
			},
		);

		expect(generateWordCompletion).not.toHaveBeenCalled();
		const ms = await db.query.wordMeaning.findMany({
			where: eq(wordMeaning.wordId, "w-cache"),
		});
		expect(ms.map((m) => m.meaning)).toEqual(["キャッシュ意味"]);
		const w = await db.query.word.findFirst({ where: eq(word.id, "w-cache") });
		expect(w?.completionStatus).toBe("done");
	});

	it("キャッシュミス時は生成し、結果を共有キャッシュに書く", async () => {
		await db.insert(word).values({
			id: "w-miss",
			userId: "u1",
			wordSetId: "s1",
			text: "novel-word",
			completionStatus: "pending",
		});
		generateWordCompletion.mockResolvedValue({
			meanings: [{ meaning: "新出の意味" }],
		});

		await completeWord(
			{ db, ai: fakeAi, cache },
			{
				wordId: "w-miss",
				userId: "u1",
				wordSetId: "s1",
				lang: "ja",
				prompt: null,
			},
		);

		expect(generateWordCompletion).toHaveBeenCalledTimes(1);
		expect(
			JSON.parse(cache.store.get(meaningCacheKey("novel-word", "ja"))!),
		).toEqual([{ meaning: "新出の意味" }]);
	});

	it("カスタムprompt付きは共有キャッシュを読まず・書かず生成する", async () => {
		await db.insert(word).values({
			id: "w-ctx",
			userId: "u1",
			wordSetId: "s1",
			text: "context-word",
			completionStatus: "pending",
		});
		// キャッシュにヒットする状態でも prompt があれば無視する
		cache.store.set(
			meaningCacheKey("context-word", "ja"),
			JSON.stringify([{ meaning: "キャッシュ意味" }]),
		);
		generateWordCompletion.mockResolvedValue({
			meanings: [{ meaning: "文脈付きの意味" }],
		});

		await completeWord(
			{ db, ai: fakeAi, cache },
			{
				wordId: "w-ctx",
				userId: "u1",
				wordSetId: "s1",
				lang: "ja",
				prompt: "医学の文脈で",
			},
		);

		expect(generateWordCompletion).toHaveBeenCalledTimes(1);
		// キャッシュは上書きされていない（文脈依存の出力で汚染しない）
		expect(
			JSON.parse(cache.store.get(meaningCacheKey("context-word", "ja"))!),
		).toEqual([{ meaning: "キャッシュ意味" }]);
		const ms = await db.query.wordMeaning.findMany({
			where: eq(wordMeaning.wordId, "w-ctx"),
		});
		expect(ms.map((m) => m.meaning)).toEqual(["文脈付きの意味"]);
	});

	it("targets指定時は入力済みの欄も上書き再生成する", async () => {
		await db.insert(word).values({
			id: "w-target",
			userId: "u1",
			wordSetId: "s1",
			text: "bank",
			completionStatus: "pending",
		});
		await db.insert(wordMeaning).values({
			id: "wm-target",
			wordId: "w-target",
			meaning: "銀行",
			example: "古い例文",
			slot: 1,
		});
		generateWordCompletion.mockResolvedValue({
			meanings: [{ meaning: "土手", example: "川辺の例文" }],
		});

		await completeWord(
			{ db, ai: fakeAi, cache },
			{
				wordId: "w-target",
				userId: "u1",
				wordSetId: "s1",
				lang: "ja",
				prompt: "川辺の文脈で",
				targets: [{ slot: 1, fields: ["meaning", "example"] }],
			},
		);

		const m = await db.query.wordMeaning.findFirst({
			where: eq(wordMeaning.id, "wm-target"),
		});
		// 指定した欄は入力済みでも上書き
		expect(m?.meaning).toBe("土手");
		expect(m?.example).toBe("川辺の例文");
		const w = await db.query.word.findFirst({ where: eq(word.id, "w-target") });
		expect(w?.completionStatus).toBe("done");
	});

	it("補完済み単語の埋め込みを生成して保存する", async () => {
		await db.insert(word).values({
			id: "we1",
			userId: "u1",
			wordSetId: "s1",
			text: "ephemeral",
			completionStatus: "done",
		});
		await db.insert(wordMeaning).values({
			id: "wem1",
			wordId: "we1",
			meaning: "はかない",
			slot: 1,
		});
		const vec = new Array<number>(EMBEDDING_DIM).fill(0);
		vec[0] = 1;
		generateEmbedding.mockResolvedValue(vec);

		await generateWordEmbedding(
			{ db, ai: fakeAi },
			{ wordId: "we1", userId: "u1", wordSetId: "s1" },
		);

		expect(generateEmbedding).toHaveBeenCalledWith(
			expect.objectContaining({ text: expect.stringContaining("ephemeral") }),
		);
		const emb = await db.query.wordEmbedding.findFirst({
			where: eq(wordEmbedding.wordId, "we1"),
			columns: { wordId: true, model: true },
		});
		expect(emb?.model).toBe("@cf/google/embeddinggemma-300m");
	});

	it("埋め込み生成が失敗しても例外を投げない（best-effort）", async () => {
		await db.insert(word).values({
			id: "we2",
			userId: "u1",
			wordSetId: "s1",
			text: "x",
			completionStatus: "done",
		});
		generateEmbedding.mockRejectedValue(new Error("ai down"));

		await expect(
			generateWordEmbedding(
				{ db, ai: fakeAi },
				{ wordId: "we2", userId: "u1", wordSetId: "s1" },
			),
		).resolves.toBeUndefined();
		const emb = await db.query.wordEmbedding.findFirst({
			where: eq(wordEmbedding.wordId, "we2"),
			columns: { wordId: true, model: true },
		});
		expect(emb).toBeUndefined();
	});
});
