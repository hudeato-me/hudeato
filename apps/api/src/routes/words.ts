import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Bindings, WordsRouteVariables } from "../types";
import { getWordById, getWords } from "../modules/word/service";
import { handleZodError } from "../utils/error-validator";

const words = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()

	// /api/words/のroute

	// 全てのセットの単語を取得
	.get("/", async (c) => {
		const result = await getWords(c.get("db"), c.get("userId"));
		return c.json(result);
	})
	// セット内の単語を取得
	.get(
		"/wordSet/:wordSetId",
		// パスパラメータの検証
		zValidator("param", z.object({ wordSetId: z.string() }), handleZodError),
		async (c) => {
			const { wordSetId } = c.req.valid("param");
			const result = await getWords(
				c.get("db"),
				c.get("userId"),
				{ wordSetId },
			);
			return c.json(result);
		}
	)
	//　単語詳細情報の取得 
	.get(
		"/:wordId",
		// パスパラメータの検証
		zValidator("param", z.object({ wordId: z.string() }), handleZodError),
		async (c) => {
			const { wordId } = c.req.valid("param");
			const result = await getWordById(
				c.get("db"),
				c.get("userId"),
				wordId,
			);
			if (!result) return c.json({ error: "Not Found" }, 404);
			return c.json(result);
		}
	);

export default words;