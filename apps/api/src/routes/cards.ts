import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { CardsQuerySchema, type CardsResponse } from "@hudeato/schema";
import { Bindings, WordsRouteVariables } from "../types";
import { generateCardDeck } from "../modules/cards/service";
import { handleZodError } from "../utils/error-validator";

// フラッシュカード(単語帳)API。
// マウント: /api/v1/cards
const cards = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()
	// カードデッキを取得（scope=all|unmastered）
	.get(
		"/:setId",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("query", CardsQuerySchema, handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const { scope, limit } = c.req.valid("query");
			const result = await generateCardDeck(
				c.get("db"),
				c.get("userId"),
				setId,
				scope,
				limit,
			);
			return c.json(result satisfies CardsResponse);
		},
	);

export default cards;
