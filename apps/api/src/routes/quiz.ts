import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
	QuizAnswerRequestSchema,
	type QuizAnswerResponse,
	QuizQuerySchema,
	QuizSessionCreateRequestSchema,
	type QuizExplainResponse,
	type QuizResponse,
	type QuizSessionDetail,
	type QuizSessionSummary,
} from "@hudeato/schema";
import { Bindings, WordsRouteVariables } from "../types";
import {
	findMeaningForWord,
	findWordForUser,
} from "../modules/study/repository";
import { findWordSetForUser } from "../modules/quiz/repository";
import {
	generateQuiz,
	getQuizExplanation,
	getQuizSessionDetail,
	getQuizSessions,
	recordQuizAnswer,
	recordQuizSession,
} from "../modules/quiz/service";
import { handleZodError } from "../utils/error-validator";

// GET /:setId/sessions のクエリ（履歴一覧の取得件数）
const QuizSessionListQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(30).default(10),
});

// 4択クイズAPI。
// マウント: /api/v1/quiz
const quiz = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()
	// クイズを生成（scope/direction/countはクエリで指定）
	.get(
		"/:setId",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("query", QuizQuerySchema, handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const { scope, direction, count } = c.req.valid("query");
			const result = await generateQuiz(c.get("db"), {
				userId: c.get("userId"),
				wordSetId: setId,
				scope,
				direction,
				count,
			});
			return c.json(result satisfies QuizResponse);
		},
	)
	// 1問の回答結果を記録（review 経由で review_log/review_state を更新）
	.post(
		"/:setId/answer",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("json", QuizAnswerRequestSchema, handleZodError),
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

			// 回答した meaning が対象単語に属するか確認する
			const meaning = await findMeaningForWord(db, body.wordId, body.meaningId);
			if (!meaning) {
				return c.json({ error: "Not Found", data: null } as const, 404);
			}

			const result = await recordQuizAnswer(db, body);
			return c.json(
				{ success: true, ...result } satisfies QuizAnswerResponse,
				201,
			);
		},
	)
	// クイズセッションを記録（結果画面の保存。/:setId/:wordId/explain とのパス衝突を避けるため
	// sessions系のルートは explain より前に定義する）
	.post(
		"/:setId/sessions",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("json", QuizSessionCreateRequestSchema, handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const body = c.req.valid("json");
			const db = c.get("db");
			const userId = c.get("userId");

			// 対象のセットがログインユーザーの所有か確認する
			const owned = await findWordSetForUser(db, userId, setId);
			if (!owned) {
				return c.json({ error: "Not Found", data: null } as const, 404);
			}

			const result = await recordQuizSession(db, {
				userId,
				wordSetId: setId,
				...body,
			});
			return c.json(result satisfies QuizSessionSummary, 201);
		},
	)
	// クイズセッション履歴一覧を取得（サマリのみ。他ユーザーのセットは study/quiz の他
	// エンドポイントと同様、追加の所有チェックはせず空配列を返す）
	.get(
		"/:setId/sessions",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("query", QuizSessionListQuerySchema, handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const { limit } = c.req.valid("query");
			const result = await getQuizSessions(
				c.get("db"),
				c.get("userId"),
				setId,
				limit,
			);
			return c.json(result satisfies QuizSessionSummary[]);
		},
	)
	// クイズセッション1件の詳細を取得（過去の結果画面の再表示用）
	.get(
		"/:setId/sessions/:sessionId",
		zValidator(
			"param",
			z.object({ setId: z.string(), sessionId: z.string() }),
			handleZodError,
		),
		async (c) => {
			const { setId, sessionId } = c.req.valid("param");
			const result = await getQuizSessionDetail(
				c.get("db"),
				c.get("userId"),
				setId,
				sessionId,
			);
			if (!result) {
				return c.json({ error: "Not Found", data: null } as const, 404);
			}
			return c.json(result satisfies QuizSessionDetail);
		},
	)
	// 結果一覧タップ時の解説を取得
	.get(
		"/:setId/:wordId/explain",
		zValidator(
			"param",
			z.object({ setId: z.string(), wordId: z.string() }),
			handleZodError,
		),
		async (c) => {
			const { setId, wordId } = c.req.valid("param");
			const result = await getQuizExplanation(
				c.get("db"),
				c.get("userId"),
				setId,
				wordId,
			);
			if (!result) {
				return c.json({ error: "Not Found", data: null } as const, 404);
			}
			return c.json(result satisfies QuizExplainResponse);
		},
	);

export default quiz;
