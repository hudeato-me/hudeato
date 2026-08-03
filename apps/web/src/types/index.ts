import { authClient } from '~/lib/auth-client'
import { InferResponseType, InferRequestType } from "hono/client"
import { client } from "~/lib/api-client"

export type Session = typeof authClient.$Infer.Session

export type WordSet = InferResponseType<typeof client.api.v1.sets.$get, 200>[number]

export type Word = InferResponseType<typeof client.api.v1.sets[":setId"]["words"]["$get"], 200>[number]

// 単語詳細の型 (GET /api/v1/sets/:setId/words/:wordId)
export type WordWithDetails = InferResponseType<typeof client.api.v1.sets[":setId"]["words"][":wordId"]["$get"], 200>["data"]

export type CreateWordReq = InferRequestType<typeof client.api.v1.sets[":setId"]["words"]["$post"]>["json"]
export type UpdateWordReq = InferRequestType<typeof client.api.v1.sets[":setId"]["words"][":wordId"]["$put"]>["json"]
// AI再補完 (POST /api/v1/sets/:setId/words/:wordId/complete)
export type CompleteWordReq = InferRequestType<typeof client.api.v1.sets[":setId"]["words"][":wordId"]["complete"]["$post"]>["json"]
export type CreateWordSetReq = InferRequestType<typeof client.api.v1.sets["$post"]>["json"]
export type UpdateWordSetReq = InferRequestType<typeof client.api.v1.sets[":setId"]["$put"]>["json"]

// クイズ生成 (GET /api/v1/quiz/:setId)
export type QuizQuery = InferRequestType<typeof client.api.v1.quiz[":setId"]["$get"]>["query"]
export type QuizResponse = InferResponseType<typeof client.api.v1.quiz[":setId"]["$get"], 200>
export type QuizQuestion = QuizResponse["questions"][number]
export type QuizScope = QuizResponse["scope"]
export type QuizDirection = QuizResponse["direction"]

// クイズ回答記録 (POST /api/v1/quiz/:setId/answer)
export type QuizAnswerReq = InferRequestType<typeof client.api.v1.quiz[":setId"]["answer"]["$post"]>["json"]
export type QuizAnswerRes = InferResponseType<typeof client.api.v1.quiz[":setId"]["answer"]["$post"], 201>

// クイズ解説 (GET /api/v1/quiz/:setId/:wordId/explain)
export type QuizExplainRes = InferResponseType<typeof client.api.v1.quiz[":setId"][":wordId"]["explain"]["$get"], 200>
export type QuizExplainMeaning = QuizExplainRes["meanings"][number]

// クイズセッション履歴
// (POST /api/v1/quiz/:setId/sessions, GET /api/v1/quiz/:setId/sessions, GET /api/v1/quiz/:setId/sessions/:sessionId)
export type QuizSessionCreateReq = InferRequestType<typeof client.api.v1.quiz[":setId"]["sessions"]["$post"]>["json"]
export type QuizSessionSummary = InferResponseType<typeof client.api.v1.quiz[":setId"]["sessions"]["$get"], 200>[number]
export type QuizSessionDetail = InferResponseType<typeof client.api.v1.quiz[":setId"]["sessions"][":sessionId"]["$get"], 200>
// セッション内の1問分の表示用レコード。selectedText が null は時間切れ(未回答)。
// ライブ結果(quiz.tsx)・履歴結果(QuizSessionDetail)の両方でこの形を共有する。
export type QuizSessionItem = QuizSessionDetail["items"][number]
export type QuizTimeLimit = QuizSessionCreateReq["timeLimitSeconds"]

export interface FieldSetting {
    key: string;
    label: string;
    type: 'text' | 'textarea';
    visible: boolean;
    order: number;
}

