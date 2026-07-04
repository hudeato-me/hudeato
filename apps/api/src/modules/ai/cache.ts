import { GeneratedMeaningSchema, type GeneratedMeaning } from "@hudeato/schema";
import { z } from "zod";

// ===========================================================================
// 共有キャッシュ（P1-4）
// global:meaning:{word}:{lang} に AI 生成の意味を保存し、よく登録される語で
// Gemini 呼び出しを削減する。全ユーザー横断の共通キャッシュ。
// ===========================================================================

// キャッシュに必要な最小インターフェース（Upstash Redis が満たす）。テストでは差し替える。
export interface MeaningCacheClient {
	get(key: string): Promise<unknown>;
	set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
}

// 共有キャッシュのTTL（30日）。
export const MEANING_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

// キャッシュに保存する形（AI生成の意味配列）。
const CachedMeaningsSchema = z.array(GeneratedMeaningSchema);

// 単語を正規化してキャッシュキーを作る（前後空白除去 + 小文字化）。
export const meaningCacheKey = (word: string, lang: string): string =>
	`global:meaning:${word.trim().toLowerCase()}:${lang}`;

// 共有キャッシュを読む。ヒットして形が正しければ意味配列、そうでなければ null。
export const readMeaningCache = async (
	redis: MeaningCacheClient,
	word: string,
	lang: string,
): Promise<GeneratedMeaning[] | null> => {
	const raw = await redis.get(meaningCacheKey(word, lang));
	if (raw == null) return null;
	const parsed = CachedMeaningsSchema.safeParse(raw);
	return parsed.success && parsed.data.length > 0 ? parsed.data : null;
};

// 生成結果を共有キャッシュに書く（TTL付き）。空配列は書かない。
export const writeMeaningCache = async (
	redis: MeaningCacheClient,
	word: string,
	lang: string,
	meanings: GeneratedMeaning[],
): Promise<void> => {
	if (meanings.length === 0) return;
	await redis.set(meaningCacheKey(word, lang), meanings, {
		ex: MEANING_CACHE_TTL_SECONDS,
	});
};
