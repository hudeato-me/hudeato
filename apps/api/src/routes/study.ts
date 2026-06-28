import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
	StudyReviewRequestSchema,
	type StudyReviewResponse,
	StudyTargetsQuerySchema,
} from "@hudeato/schema";
import { Bindings, WordsRouteVariables } from "../types";
import {
	findMeaningForWord,
	findWordForUser,
} from "../modules/study/repository";
import { getStudyTargets, recordReview } from "../modules/study/service";
import { handleZodError } from "../utils/error-validator";

// 学習(クイズ/カード)が共用する土台API。
// マウント: /api/v1/study
const study = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()
	// 出題対象の単語ID群を取得（scope=all|unmastered）
	.get(
		"/:setId/targets",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("query", StudyTargetsQuerySchema, handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const { scope } = c.req.valid("query");
			const result = await getStudyTargets(
				c.get("db"),
				c.get("userId"),
				setId,
				scope,
			);
			return c.json(result);
		},
	)
	// レビュー結果を記録（review_log 追記 + review_state 更新）
	.post(
		"/:setId/review",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("json", StudyReviewRequestSchema, handleZodError),
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

			// 間隔反復は meaning 単位のため、指定の意味が対象単語に属するか確認する
			const meaning = await findMeaningForWord(db, body.wordId, body.meaningId);
			if (!meaning) {
				return c.json({ error: "Not Found", data: null } as const, 404);
			}

			const reviewState = await recordReview(db, body);
			return c.json(
				{ success: true, reviewState } satisfies StudyReviewResponse,
				201,
			);
		},
	);

export default study;
