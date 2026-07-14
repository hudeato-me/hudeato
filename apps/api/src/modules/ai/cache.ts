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

// 単語を正規化してキャッシュキーを作る（前後空白除去 + Unicode NFC正規化）。
// 大文字小文字は保持する（US/us・Polish/polish など大小で意味が変わる語を
// 同一視すると、誤った意味がキャッシュヒットしてそのまま保存されるため）。
export const meaningCacheKey = (word: string, lang: string): string =>
	`global:meaning:${word.trim().normalize("NFC")}:${lang}`;

// 共有キャッシュを読む。ヒットして形が正しければ意味配列、そうでなければ null。
// キャッシュは最適化にすぎないため、Redis障害時もミス扱いで続行する（登録/補完を失敗させない）。
export const readMeaningCache = async (
	redis: MeaningCacheClient,
	word: string,
	lang: string,
): Promise<GeneratedMeaning[] | null> => {
	try {
		const raw = await redis.get(meaningCacheKey(word, lang));
		if (raw == null) return null;
		const parsed = CachedMeaningsSchema.safeParse(raw);
		return parsed.success && parsed.data.length > 0 ? parsed.data : null;
	} catch (error) {
		console.error("failed to read meaning cache", word, error);
		return null;
	}
};

// 生成結果を共有キャッシュに書く（TTL付き）。空配列は書かない。
// 書き込み失敗も補完全体は失敗させない（best-effort）。
export const writeMeaningCache = async (
	redis: MeaningCacheClient,
	word: string,
	lang: string,
	meanings: GeneratedMeaning[],
): Promise<void> => {
	if (meanings.length === 0) return;
	try {
		await redis.set(meaningCacheKey(word, lang), meanings, {
			ex: MEANING_CACHE_TTL_SECONDS,
		});
	} catch (error) {
		console.error("failed to write meaning cache", word, error);
	}
};
