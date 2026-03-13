import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Bindings, WordsRouteVariables } from "../types";
import { getWordById, getWords } from "../modules/word/service";
import { handleZodError } from "../utils/error-validator";

const words = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()

	// セット内の単語一覧を取得
	.get(
		"/",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("query", z.object({ limit: z.coerce.number().optional().default(50), offset: z.coerce.number().optional().default(0) }), handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const { limit, offset } = c.req.valid("query");
			const result = await getWords(c.get("db"), c.get("userId"), { wordSetId: setId, limit, offset });
			return c.json(result);
		}
	)
	//　単語詳細情報の取得 
	.get(
		"/:wordId",
		// パスパラメータの検証
		zValidator("param", z.object({ setId: z.string(), wordId: z.string() }), handleZodError),
		async (c) => {
			const { setId, wordId } = c.req.valid("param");
			const result = await getWordById(c.get("db"), c.get("userId"), setId, wordId);
			if (!result) {
				return c.json({ error: "Not Found", data: null } as const, 404);
			}
			return c.json({ error: null, data: result } as const);
		}
	);

export default words;