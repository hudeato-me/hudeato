import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIM } from "../../db/word-schema";

// "@google/generative-ai" をモックする。generateContent / embedContent を
// テストごとに差し替えて、構造化出力のパース・リトライ・埋め込みを検証する。
const { generateContent, embedContent, getGenerativeModel } = vi.hoisted(() => {
	const generateContent = vi.fn();
	const embedContent = vi.fn();
	const getGenerativeModel = vi.fn(() => ({ generateContent, embedContent }));
	return { generateContent, embedContent, getGenerativeModel };
});

vi.mock("@google/generative-ai", () => ({
	// new GoogleGenerativeAI(apiKey) が確実に構築できるようクラスでモックする。
	GoogleGenerativeAI: class {
		getGenerativeModel = getGenerativeModel;
	},
	SchemaType: {
		OBJECT: "object",
		ARRAY: "array",
		STRING: "string",
		NUMBER: "number",
		INTEGER: "integer",
		BOOLEAN: "boolean",
	},
}));

import {
	GEMINI_EMBEDDING_MODEL,
	GEMINI_GENERATION_MODEL,
	generateEmbedding,
	generateWordCompletion,
} from "./gemini";

// generateContent が返す Gemini レスポンス形状を模したヘルパー。
const geminiJson = (obj: unknown) => ({
	response: { text: () => JSON.stringify(obj) },
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateWordCompletion", () => {
	it("構造化出力(JSON)をパースして意味を返す", async () => {
		generateContent.mockResolvedValueOnce(
			geminiJson({
				meanings: [
					{
						meaning: "はかない、つかの間の",
						partOfSpeech: "形容詞",
						phonetic: "/ɪˈfɛm(ə)rəl/",
						example: "ephemeral beauty",
						collocation: null,
						synonym: "transient",
						etymology: null,
					},
				],
			}),
		);

		const result = await generateWordCompletion({
			apiKey: "test-key",
			word: "ephemeral",
		});

		expect(result.meanings).toHaveLength(1);
		expect(result.meanings[0].meaning).toBe("はかない、つかの間の");
		expect(result.meanings[0].synonym).toBe("transient");
		// 構造化出力の設定でモデルを取得している
		expect(getGenerativeModel).toHaveBeenCalledWith(
			expect.objectContaining({
				model: GEMINI_GENERATION_MODEL,
				generationConfig: expect.objectContaining({
					responseMimeType: "application/json",
				}),
			}),
		);
	});

	it("prompt(チャット文脈)を生成プロンプトに含める", async () => {
		generateContent.mockResolvedValueOnce(
			geminiJson({ meanings: [{ meaning: "意味" }] }),
		);

		await generateWordCompletion({
			apiKey: "test-key",
			word: "bank",
			prompt: "川辺の文脈で",
		});

		const passedPrompt = generateContent.mock.calls[0][0] as string;
		expect(passedPrompt).toContain("bank");
		expect(passedPrompt).toContain("川辺の文脈で");
	});

	it("一時的な失敗はリトライして成功する", async () => {
		generateContent
			.mockRejectedValueOnce(new Error("503 Service Unavailable"))
			.mockResolvedValueOnce(geminiJson({ meanings: [{ meaning: "回復" }] }));

		const result = await generateWordCompletion({
			apiKey: "test-key",
			word: "resilient",
			retry: { attempts: 3, baseDelayMs: 0 },
		});

		expect(result.meanings[0].meaning).toBe("回復");
		expect(generateContent).toHaveBeenCalledTimes(2);
	});

	it("リトライ上限を超えたら例外を投げる", async () => {
		generateContent.mockRejectedValue(new Error("boom"));

		await expect(
			generateWordCompletion({
				apiKey: "test-key",
				word: "x",
				retry: { attempts: 2, baseDelayMs: 0 },
			}),
		).rejects.toThrow();
		expect(generateContent).toHaveBeenCalledTimes(2);
	});

	it("不正なJSONやスキーマ違反は失敗として扱う", async () => {
		// JSONとして壊れている
		generateContent.mockResolvedValue({ response: { text: () => "not json" } });
		await expect(
			generateWordCompletion({
				apiKey: "test-key",
				word: "x",
				retry: { attempts: 1, baseDelayMs: 0 },
			}),
		).rejects.toThrow();

		// meanings が空（min(1) 違反）
		generateContent.mockResolvedValue(geminiJson({ meanings: [] }));
		await expect(
			generateWordCompletion({
				apiKey: "test-key",
				word: "x",
				retry: { attempts: 1, baseDelayMs: 0 },
			}),
		).rejects.toThrow();
	});
});

describe("generateEmbedding", () => {
	it("EMBEDDING_DIM 次元の正規化ベクトルを返す", async () => {
		const raw = new Array<number>(EMBEDDING_DIM).fill(0);
		raw[0] = 3; // [3,0,0,...] → 正規化で [1,0,0,...]
		embedContent.mockResolvedValueOnce({ embedding: { values: raw } });

		const vector = await generateEmbedding({ apiKey: "test-key", text: "hi" });

		expect(vector).toHaveLength(EMBEDDING_DIM);
		expect(vector[0]).toBeCloseTo(1, 5);
		expect(vector[1]).toBeCloseTo(0, 5);
		expect(getGenerativeModel).toHaveBeenCalledWith({
			model: GEMINI_EMBEDDING_MODEL,
		});
	});

	it("値が空なら例外を投げる", async () => {
		embedContent.mockResolvedValue({ embedding: { values: [] } });
		await expect(
			generateEmbedding({
				apiKey: "test-key",
				text: "hi",
				retry: { attempts: 1, baseDelayMs: 0 },
			}),
		).rejects.toThrow();
	});

	it("次元数が想定と異なれば例外を投げる", async () => {
		embedContent.mockResolvedValue({ embedding: { values: [1, 2, 3] } });
		await expect(
			generateEmbedding({
				apiKey: "test-key",
				text: "hi",
				retry: { attempts: 1, baseDelayMs: 0 },
			}),
		).rejects.toThrow();
	});
});
