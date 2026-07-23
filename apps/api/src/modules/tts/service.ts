// ===========================================================================
// Google Cloud Text-to-Speech 連携モジュール
// クイズの出題プロンプトの自動再生用に音声(MP3)を生成する。
// 依存(KVキャッシュ・fetch)は引数で受け取り、シングルトンを作らない
// （modules/ai/workers-ai.ts と同じ流儀。テストでは差し替える）。
// ===========================================================================

// 対応言語。将来、単語の言語自動判定に差し替える予定（issue #90）だが、
// APIのlangパラメータ設計自体はそのまま流用できる形にしておく。
export type TtsLang = "en" | "ja";

// 言語ごとのGoogle Cloud TTSの音声設定。
const VOICE_CONFIG: Record<TtsLang, { languageCode: string; voiceName: string }> = {
	en: { languageCode: "en-US", voiceName: "en-US-Neural2-D" },
	ja: { languageCode: "ja-JP", voiceName: "ja-JP-Neural2-B" },
};

// キャッシュに必要な最小インターフェース（Workers KV の KVNamespace が満たす）。
// MEANING_CACHE を共用するため、値は base64 文字列で "text" 型として読み書きする。
export interface TtsCacheStore {
	get(key: string, type: "text"): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<unknown>;
}

// 共有キャッシュのTTL（30日）。よく再生される語・意味でGoogle TTS呼び出しを削減する。
export const TTS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

// キャッシュキーを作る（前後空白除去 + Unicode NFC正規化。cache.tsのmeaningCacheKeyと同じ流儀）。
export const ttsCacheKey = (lang: TtsLang, text: string): string => {
	const { voiceName } = VOICE_CONFIG[lang];
	return `tts:${lang}:${voiceName}:${text.trim().normalize("NFC")}`;
};

const GOOGLE_TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

export type SynthesizeSpeechResult =
	| { ok: true; audio: Uint8Array }
	| { ok: false; status: 503; error: string }
	| { ok: false; status: 502; error: string };

export interface SynthesizeSpeechParams {
	cache: TtsCacheStore;
	// 未設定（devの.dev.vars未記入・本番のsecret未設定）ならTTSを503で無効化する。
	apiKey: string | undefined;
	text: string;
	lang: TtsLang;
	// テストでフェイクを注入するための依存注入。省略時はグローバルfetch。
	fetchImpl?: typeof fetch;
}

// 発音音声(MP3)を生成する。KVキャッシュ(MEANING_CACHEを共用)がヒットすれば
// Google TTSを呼ばずに返す。キャッシュの読み書きはbest-effort（障害時もミス扱いで
// 続行し、生成自体は失敗させない）。
export async function synthesizeSpeech(
	params: SynthesizeSpeechParams,
): Promise<SynthesizeSpeechResult> {
	const { cache, apiKey, text, lang } = params;
	const fetchImpl = params.fetchImpl ?? fetch;
	const key = ttsCacheKey(lang, text);

	const cached = await readTtsCache(cache, key);
	if (cached) {
		return { ok: true, audio: base64ToBytes(cached) };
	}

	if (!apiKey) {
		return { ok: false, status: 503, error: "TTS is not configured" };
	}

	const { languageCode, voiceName } = VOICE_CONFIG[lang];

	let response: Response;
	try {
		response = await fetchImpl(`${GOOGLE_TTS_ENDPOINT}?key=${apiKey}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				input: { text },
				voice: { languageCode, name: voiceName },
				audioConfig: { audioEncoding: "MP3" },
			}),
		});
	} catch (error) {
		console.error("failed to call Google TTS", error);
		return { ok: false, status: 502, error: "Failed to synthesize speech" };
	}

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		console.error("Google TTS returned an error", response.status, body);
		return { ok: false, status: 502, error: "Failed to synthesize speech" };
	}

	const json = (await response.json().catch(() => null)) as {
		audioContent?: string;
	} | null;
	const audioContent = json?.audioContent;
	if (!audioContent) {
		console.error("Google TTS response did not contain audioContent");
		return { ok: false, status: 502, error: "Failed to synthesize speech" };
	}

	await writeTtsCache(cache, key, audioContent);
	return { ok: true, audio: base64ToBytes(audioContent) };
}

// 共有キャッシュを読む。キャッシュは最適化にすぎないため、KV障害時もミス扱いで続行する。
async function readTtsCache(
	cache: TtsCacheStore,
	key: string,
): Promise<string | null> {
	try {
		return await cache.get(key, "text");
	} catch (error) {
		console.error("failed to read tts cache", key, error);
		return null;
	}
}

// 生成結果を共有キャッシュに書く（TTL付き）。書き込み失敗もレスポンス自体は失敗させない。
async function writeTtsCache(
	cache: TtsCacheStore,
	key: string,
	base64Audio: string,
): Promise<void> {
	try {
		await cache.put(key, base64Audio, { expirationTtl: TTS_CACHE_TTL_SECONDS });
	} catch (error) {
		console.error("failed to write tts cache", key, error);
	}
}

// base64文字列を音声バイト列に変換する。
// Workersランタイムには Buffer が無いため、Web標準の atob を使う（Node(vitest)にも存在する）。
function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
