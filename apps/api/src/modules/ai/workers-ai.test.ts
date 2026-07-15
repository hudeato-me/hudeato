import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIM } from "../../db/word-schema";
import {
	WORKERS_AI_COMPLETION_MODEL,
	WORKERS_AI_EMBEDDING_MODEL,
	generateEmbedding,
	generateWordCompletion,
	type AiClient,
} from "./workers-ai";

// AI バインディングは注入なので vi.mock 不要。run をテストごとに差し替える。
const run = vi.fn();
const ai: AiClient = { run };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateWordCompletion", () => {
	it("構造化出力(JSON)をパースして意味を返す", async () => {
		run.mockResolvedValueOnce({
			response: JSON.stringify({
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
		});

		const result = await generateWordCompletion({ ai, word: "ephemeral" });

		expect(result.meanings).toHaveLength(1);
		expect(result.meanings[0].meaning).toBe("はかない、つかの間の");
		expect(result.meanings[0].synonym).toBe("transient");
		// 構造化出力(Responses APIのjson_schema)の指定つきで生成モデルを呼んでいる
		expect(run).toHaveBeenCalledWith(
			WORKERS_AI_COMPLETION_MODEL,
			expect.objectContaining({
				text: expect.objectContaining({
					format: expect.objectContaining({ type: "json_schema", strict: true }),
				}),
			}),
		);
	});

	it("response がパース済みオブジェクトで返る形も受け付ける", async () => {
		run.mockResolvedValueOnce({
			response: { meanings: [{ meaning: "意味" }] },
		});
		const result = await generateWordCompletion({ ai, word: "x" });
		expect(result.meanings[0].meaning).toBe("意味");
	});

	it("Responses API 形（output[].content[].text）も受け付ける", async () => {
		run.mockResolvedValueOnce({
			output: [
				{ type: "reasoning", content: [{ type: "reasoning_text", text: "…" }] },
				{
					type: "message",
					content: [
						{
							type: "output_text",
							text: JSON.stringify({ meanings: [{ meaning: "出力形の意味" }] }),
						},
					],
				},
			],
		});
		const result = await generateWordCompletion({ ai, word: "x" });
		expect(result.meanings[0].meaning).toBe("出力形の意味");
	});

	it("prompt(チャット文脈)を生成プロンプトに含める", async () => {
		run.mockResolvedValueOnce({
			response: JSON.stringify({ meanings: [{ meaning: "意味" }] }),
		});

		await generateWordCompletion({ ai, word: "bank", prompt: "川辺の文脈で" });

		const inputs = run.mock.calls[0][1] as { input: string };
		expect(inputs.input).toContain("bank");
		expect(inputs.input).toContain("川辺の文脈で");
	});

	it("一時的な失敗はリトライして成功する", async () => {
		run
			.mockRejectedValueOnce(new Error("503 Service Unavailable"))
			.mockResolvedValueOnce({
				response: JSON.stringify({ meanings: [{ meaning: "回復" }] }),
			});

		const result = await generateWordCompletion({
			ai,
			word: "resilient",
			retry: { attempts: 3, baseDelayMs: 0 },
		});

		expect(result.meanings[0].meaning).toBe("回復");
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("リトライ上限を超えたら例外を投げる", async () => {
		run.mockRejectedValue(new Error("boom"));

		await expect(
			generateWordCompletion({
				ai,
				word: "x",
				retry: { attempts: 2, baseDelayMs: 0 },
			}),
		).rejects.toThrow();
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("不正なJSONやスキーマ違反は失敗として扱う", async () => {
		// JSONとして壊れている
		run.mockResolvedValue({ response: "not json" });
		await expect(
			generateWordCompletion({
				ai,
				word: "x",
				retry: { attempts: 1, baseDelayMs: 0 },
			}),
		).rejects.toThrow();

		// meanings が空（min(1) 違反）
		run.mockResolvedValue({ response: JSON.stringify({ meanings: [] }) });
		await expect(
			generateWordCompletion({
				ai,
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
		run.mockResolvedValueOnce({ shape: [1, EMBEDDING_DIM], data: [raw] });

		const vector = await generateEmbedding({ ai, text: "hi" });

		expect(vector).toHaveLength(EMBEDDING_DIM);
		expect(vector[0]).toBeCloseTo(1, 5);
		expect(vector[1]).toBeCloseTo(0, 5);
		expect(run).toHaveBeenCalledWith(WORKERS_AI_EMBEDDING_MODEL, {
			text: ["hi"],
		});
	});

	it("OpenAI互換形（data[].embedding）も受け付ける", async () => {
		const raw = new Array<number>(EMBEDDING_DIM).fill(0);
		raw[1] = 2;
		run.mockResolvedValueOnce({ data: [{ embedding: raw }] });

		const vector = await generateEmbedding({ ai, text: "hi" });
		expect(vector[1]).toBeCloseTo(1, 5);
	});

	it("値が空なら例外を投げる", async () => {
		run.mockResolvedValue({ data: [] });
		await expect(
			generateEmbedding({
				ai,
				text: "hi",
				retry: { attempts: 1, baseDelayMs: 0 },
			}),
		).rejects.toThrow();
	});

	it("次元数が想定と異なれば例外を投げる", async () => {
		run.mockResolvedValue({ data: [[1, 2, 3]] });
		await expect(
			generateEmbedding({
				ai,
				text: "hi",
				retry: { attempts: 1, baseDelayMs: 0 },
			}),
		).rejects.toThrow();
	});
});
