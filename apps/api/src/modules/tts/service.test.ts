import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	TTS_CACHE_TTL_SECONDS,
	synthesizeSpeech,
	ttsCacheKey,
	type TtsCacheStore,
} from "./service";

// fetch はテストごとに差し替える依存注入（modules/ai/workers-ai.test.ts と同じ流儀）。
const fetchImpl = vi.fn();

const createCache = (initial: Record<string, string> = {}): TtsCacheStore & {
	get: ReturnType<typeof vi.fn>;
	put: ReturnType<typeof vi.fn>;
} => {
	const store = new Map(Object.entries(initial));
	return {
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		put: vi.fn(async (key: string, value: string) => {
			store.set(key, value);
		}),
	};
};

const okGoogleResponse = (audioContent: string) =>
	new Response(JSON.stringify({ audioContent }), { status: 200 });

beforeEach(() => {
	vi.clearAllMocks();
});

describe("ttsCacheKey", () => {
	it("lang・voice名・NFC正規化したtextでキーを作る", () => {
		expect(ttsCacheKey("en", "  ephemeral ")).toBe(
			"tts:en:en-US-Neural2-D:ephemeral",
		);
		expect(ttsCacheKey("ja", "こんにちは")).toBe(
			"tts:ja:ja-JP-Neural2-B:こんにちは",
		);
	});
});

describe("synthesizeSpeech", () => {
	it("キャッシュヒット時はfetchを呼ばずbase64をデコードして返す", async () => {
		const audio = Buffer.from("hello-audio").toString("base64");
		const cache = createCache({
			[ttsCacheKey("en", "hello")]: audio,
		});

		const result = await synthesizeSpeech({
			cache,
			apiKey: "test-key",
			text: "hello",
			lang: "en",
			fetchImpl,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Buffer.from(result.audio).toString()).toBe("hello-audio");
		}
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("キャッシュミス時はGoogle TTSを正しいリクエストボディで呼ぶ", async () => {
		const cache = createCache();
		const audio = Buffer.from("synth-audio").toString("base64");
		fetchImpl.mockResolvedValueOnce(okGoogleResponse(audio));

		const result = await synthesizeSpeech({
			cache,
			apiKey: "test-key",
			text: "hello",
			lang: "en",
			fetchImpl,
		});

		expect(result.ok).toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(
			"https://texttospeech.googleapis.com/v1/text:synthesize?key=test-key",
		);
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body as string)).toEqual({
			input: { text: "hello" },
			voice: { languageCode: "en-US", name: "en-US-Neural2-D" },
			audioConfig: { audioEncoding: "MP3" },
		});
	});

	it("日本語(ja)はja-JPの音声設定でリクエストする", async () => {
		const cache = createCache();
		fetchImpl.mockResolvedValueOnce(
			okGoogleResponse(Buffer.from("audio").toString("base64")),
		);

		await synthesizeSpeech({
			cache,
			apiKey: "test-key",
			text: "こんにちは",
			lang: "ja",
			fetchImpl,
		});

		const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
		expect(JSON.parse(init.body as string).voice).toEqual({
			languageCode: "ja-JP",
			name: "ja-JP-Neural2-B",
		});
	});

	it("生成成功時はKVキャッシュにbase64音声とTTLを書き込む", async () => {
		const cache = createCache();
		const audio = Buffer.from("synth-audio").toString("base64");
		fetchImpl.mockResolvedValueOnce(okGoogleResponse(audio));

		await synthesizeSpeech({
			cache,
			apiKey: "test-key",
			text: "hello",
			lang: "en",
			fetchImpl,
		});

		expect(cache.put).toHaveBeenCalledWith(
			ttsCacheKey("en", "hello"),
			audio,
			{ expirationTtl: TTS_CACHE_TTL_SECONDS },
		);
	});

	it("APIキー未設定は503を返しGoogle TTSを呼ばない", async () => {
		const cache = createCache();

		const result = await synthesizeSpeech({
			cache,
			apiKey: undefined,
			text: "hello",
			lang: "en",
			fetchImpl,
		});

		expect(result).toEqual({
			ok: false,
			status: 503,
			error: "TTS is not configured",
		});
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("Google TTSがエラーを返したら502", async () => {
		const cache = createCache();
		fetchImpl.mockResolvedValueOnce(
			new Response("Bad Request", { status: 400 }),
		);

		const result = await synthesizeSpeech({
			cache,
			apiKey: "test-key",
			text: "hello",
			lang: "en",
			fetchImpl,
		});

		expect(result).toEqual({
			ok: false,
			status: 502,
			error: "Failed to synthesize speech",
		});
		expect(cache.put).not.toHaveBeenCalled();
	});

	it("Google TTSがネットワークエラーを投げても502", async () => {
		const cache = createCache();
		fetchImpl.mockRejectedValueOnce(new Error("network down"));

		const result = await synthesizeSpeech({
			cache,
			apiKey: "test-key",
			text: "hello",
			lang: "en",
			fetchImpl,
		});

		expect(result).toEqual({
			ok: false,
			status: 502,
			error: "Failed to synthesize speech",
		});
	});

	it("audioContentを含まないレスポンスは502", async () => {
		const cache = createCache();
		fetchImpl.mockResolvedValueOnce(
			new Response(JSON.stringify({}), { status: 200 }),
		);

		const result = await synthesizeSpeech({
			cache,
			apiKey: "test-key",
			text: "hello",
			lang: "en",
			fetchImpl,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.status).toBe(502);
	});
});
