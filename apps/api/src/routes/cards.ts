import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
	CardsQuerySchema,
	CardSwipeRequestSchema,
	type CardsResponse,
	type CardSwipeResponse,
} from "@hudeato/schema";
import { Bindings, WordsRouteVariables } from "../types";
import { findWordForUser } from "../modules/study/repository";
import { generateCardDeck, recordCardSwipe } from "../modules/cards/service";
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
	)
	// スワイプ結果を記録（右=知っている / 左=まだ知らない。単語単位で全意味に適用）
	.post(
		"/:setId/swipe",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("json", CardSwipeRequestSchema, handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const body = c.req.valid("json");
			const db = c.get("db");
			const userId = c.get("userId");

			// 対象の単語がログインユーザー・セットに属するか確認
			const owned = await findWordForUser(db, userId, setId, body.wordId);
			if (!owned) {
				return c.json({ error: "Not Found", data: null } as const, 404);
			}

			const result = await recordCardSwipe(db, body);
			return c.json(
				{ success: true, ...result } satisfies CardSwipeResponse,
				201,
			);
		},
	);

export default cards;
