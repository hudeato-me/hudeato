import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tts from "./tts";
import { signUpAndGetSession } from "../test/helpers";
import { createTestContext, type TestContext } from "../test/setup";

// ===========================================================================
// TTS API 結合テスト
// DB/Redisを使わないため、認証チェックのみ本番同様に再現した最小のテストapp
// （createStudyTestAppと同じ考え方）を組み立てる。KV/APIキーはHonoの
// request(input, init, env)経由で注入する（fetchはグローバルをvi.stubGlobalで差し替える）。
// ===========================================================================

// MEANING_CACHE を模したフェイクKV（"text"型のget/putのみ満たす）。
function createFakeKv() {
	const store = new Map<string, string>();
	return {
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		put: vi.fn(async (key: string, value: string) => {
			store.set(key, value);
		}),
	};
}

function createTtsTestApp(ctx: TestContext) {
	const app = new Hono();

	app.on(["POST", "GET"], "/api/auth/*", (c) => ctx.auth.handler(c.req.raw));

	const protectedMiddleware = createMiddleware(async (c, next) => {
		const session = await ctx.auth.api.getSession({ headers: c.req.raw.headers });
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		await next();
	});

	const api = new Hono().use("*", protectedMiddleware).route("/v1/tts", tts);

	app.route("/api", api);
	return app;
}

let ctx: TestContext & { _applyMigrations: () => Promise<void> };
let app: ReturnType<typeof createTtsTestApp>;
let cookie: string;

beforeAll(async () => {
	ctx = createTestContext() as TestContext & {
		_applyMigrations: () => Promise<void>;
	};
	await ctx._applyMigrations();
	app = createTtsTestApp(ctx);

	const session = await signUpAndGetSession(app);
	cookie = session.cookie;
});

afterAll(() => {
	ctx.cleanup();
});

describe("GET /api/v1/tts", () => {
	it("未認証は401", async () => {
		const res = await app.request("/api/v1/tts?text=hello&lang=en", {
			headers: { Cookie: "" },
		});
		expect(res.status).toBe(401);
	});

	it("不正なlangは400", async () => {
		const res = await app.request(
			"/api/v1/tts?text=hello&lang=fr",
			{ headers: { Cookie: cookie } },
			{ MEANING_CACHE: createFakeKv(), GOOGLE_TTS_API_KEY: "test-key" },
		);
		expect(res.status).toBe(400);
	});

	it("正常系: 音声を audio/mpeg で返し、KVキャッシュに書き込む", async () => {
		const audio = Buffer.from("synth-audio").toString("base64");
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ audioContent: audio }), { status: 200 }),
			);
		vi.stubGlobal("fetch", fetchMock);

		const kv = createFakeKv();
		const res = await app.request(
			"/api/v1/tts?text=hello&lang=en",
			{ headers: { Cookie: cookie } },
			{ MEANING_CACHE: kv, GOOGLE_TTS_API_KEY: "test-key" },
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
		expect(res.headers.get("Cache-Control")).toBe("private, max-age=86400");
		const buf = new Uint8Array(await res.arrayBuffer());
		expect(Buffer.from(buf).toString()).toBe("synth-audio");
		expect(kv.put).toHaveBeenCalledTimes(1);

		vi.unstubAllGlobals();
	});

	it("GOOGLE_TTS_API_KEY未設定は503", async () => {
		const res = await app.request(
			"/api/v1/tts?text=hello&lang=en",
			{ headers: { Cookie: cookie } },
			{ MEANING_CACHE: createFakeKv() },
		);
		expect(res.status).toBe(503);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("TTS is not configured");
	});
});
