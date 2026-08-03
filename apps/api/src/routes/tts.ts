import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Bindings, WordsRouteVariables } from "../types";
import { synthesizeSpeech } from "../modules/tts/service";
import { handleZodError } from "../utils/error-validator";

// GET /api/v1/tts のクエリ（読み上げるテキストと言語）。
const TtsQuerySchema = z.object({
	text: z.string().min(1).max(200),
	lang: z.enum(["en", "ja"]),
});

// 発音音声(TTS)API。クイズの出題プロンプト自動再生で使う。
// マウント: /api/v1/tts
const tts = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>().get(
	"/",
	zValidator("query", TtsQuerySchema, handleZodError),
	async (c) => {
		const { text, lang } = c.req.valid("query");
		const result = await synthesizeSpeech({
			cache: c.env.MEANING_CACHE,
			apiKey: c.env.GOOGLE_TTS_API_KEY,
			text,
			lang,
		});

		if (!result.ok) {
			return c.json({ error: result.error } as const, result.status);
		}

		// workers-typesとDOMのBodyInit型差を避けるためのcast（実体は同じUint8Array、upload.tsと同様の対処）
		return new Response(result.audio as unknown as BodyInit, {
			headers: {
				"Content-Type": "audio/mpeg",
				"Cache-Control": "private, max-age=86400",
			},
		});
	},
);

export default tts;
