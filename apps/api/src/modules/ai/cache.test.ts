import { describe, expect, it, vi } from "vitest";
import {
	MEANING_CACHE_TTL_SECONDS,
	meaningCacheKey,
	readMeaningCache,
	writeMeaningCache,
} from "./cache";

describe("meaningCacheKey", () => {
	it("前後空白を除去しNFC正規化してキーを作る", () => {
		expect(meaningCacheKey("  ephemeral ", "ja")).toBe(
			"global:meaning:ephemeral:ja",
		);
		// 結合文字（e + ́）は合成形（é）に正規化される
		expect(meaningCacheKey("café", "ja")).toBe(
			"global:meaning:café:ja",
		);
	});

	it("大文字小文字は保持する（US/usなど大小で意味が変わる語を同一視しない）", () => {
		expect(meaningCacheKey("US", "ja")).toBe("global:meaning:US:ja");
		expect(meaningCacheKey("us", "ja")).toBe("global:meaning:us:ja");
	});
});

describe("readMeaningCache", () => {
	it("ヒット時は意味配列を返す", async () => {
		const kv = {
			get: vi.fn(async () => [{ meaning: "はかない" }]),
			put: vi.fn(),
		};
		const result = await readMeaningCache(kv, "ephemeral", "ja");
		expect(result).toEqual([{ meaning: "はかない" }]);
		expect(kv.get).toHaveBeenCalledWith("global:meaning:ephemeral:ja", "json");
	});

	it("null や形が不正なら null を返す", async () => {
		expect(
			await readMeaningCache(
				{ get: vi.fn(async () => null), put: vi.fn() },
				"x",
				"ja",
			),
		).toBeNull();
		expect(
			await readMeaningCache(
				{ get: vi.fn(async () => ({ notArray: true })), put: vi.fn() },
				"x",
				"ja",
			),
		).toBeNull();
		// meaning が空文字（スキーマ違反）なら null
		expect(
			await readMeaningCache(
				{ get: vi.fn(async () => [{ meaning: "" }]), put: vi.fn() },
				"x",
				"ja",
			),
		).toBeNull();
	});
});

describe("writeMeaningCache", () => {
	it("TTL付きでJSON文字列を書き込む", async () => {
		const put = vi.fn(async () => undefined);
		await writeMeaningCache({ get: vi.fn(), put }, "ephemeral", "ja", [
			{ meaning: "はかない" },
		]);
		expect(put).toHaveBeenCalledWith(
			"global:meaning:ephemeral:ja",
			JSON.stringify([{ meaning: "はかない" }]),
			{ expirationTtl: MEANING_CACHE_TTL_SECONDS },
		);
	});

	it("空配列は書き込まない", async () => {
		const put = vi.fn();
		await writeMeaningCache({ get: vi.fn(), put }, "x", "ja", []);
		expect(put).not.toHaveBeenCalled();
	});
});

describe("KV障害時の耐性（キャッシュはbest-effort）", () => {
	it("読み込み失敗はミス扱いで null を返す", async () => {
		const kv = {
			get: vi.fn(async () => {
				throw new Error("kv down");
			}),
			put: vi.fn(),
		};
		await expect(readMeaningCache(kv, "x", "ja")).resolves.toBeNull();
	});

	it("書き込み失敗は例外を伝播させない", async () => {
		const kv = {
			get: vi.fn(),
			put: vi.fn(async () => {
				throw new Error("kv down");
			}),
		};
		await expect(
			writeMeaningCache(kv, "x", "ja", [{ meaning: "m" }]),
		).resolves.toBeUndefined();
	});
});
