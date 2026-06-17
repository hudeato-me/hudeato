import { z } from "zod";

export const UserSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string().email(),
});

export type User = z.infer<typeof UserSchema>;

// ---------------------------------------------------------------------------
// 学習系（クイズ/カード/間隔反復）の共有スキーマ
// api / web / mobile はこのZodを単一の正として共有する。
// ---------------------------------------------------------------------------

// レビューのモード（クイズ / 単語帳）
export const ReviewModeSchema = z.enum(["quiz", "flashcard"]);
export type ReviewMode = z.infer<typeof ReviewModeSchema>;

// レビュー結果。quiz は correct/wrong、flashcard は known/unknown を使う。
export const ReviewResultSchema = z.enum([
	"correct",
	"wrong",
	"known",
	"unknown",
]);
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

// 出題対象の抽出範囲。all=全ての言葉 / unmastered=未習得の言葉
export const StudyScopeSchema = z.enum(["all", "unmastered"]);
export type StudyScope = z.infer<typeof StudyScopeSchema>;

// GET /study/:setId/targets のクエリ
export const StudyTargetsQuerySchema = z.object({
	scope: StudyScopeSchema.default("all"),
});
export type StudyTargetsQuery = z.infer<typeof StudyTargetsQuerySchema>;

// GET /study/:setId/targets のレスポンス
export const StudyTargetsResponseSchema = z.object({
	scope: StudyScopeSchema,
	wordIds: z.array(z.string()),
	count: z.number().int().nonnegative(),
});
export type StudyTargetsResponse = z.infer<typeof StudyTargetsResponseSchema>;

// POST /study/:setId/review のリクエスト
// 間隔反復は意味(meaning)単位で記録するため meaningId は必須。
export const StudyReviewRequestSchema = z.object({
	wordId: z.string().min(1),
	meaningId: z.string().min(1),
	mode: ReviewModeSchema,
	result: ReviewResultSchema,
});
export type StudyReviewRequest = z.infer<typeof StudyReviewRequestSchema>;

// review_state の公開表現（レビュー後の最新状態）。meaning 単位。
export const ReviewStateSchema = z.object({
	meaningId: z.string(),
	reps: z.number().int().nonnegative(),
	lapses: z.number().int().nonnegative(),
	intervalDays: z.number().int().nonnegative(),
	easeFactor: z.number(),
	nextReviewAt: z.number().nullable(),
});
export type ReviewState = z.infer<typeof ReviewStateSchema>;

// POST /study/:setId/review のレスポンス
export const StudyReviewResponseSchema = z.object({
	success: z.boolean(),
	reviewState: ReviewStateSchema,
});
export type StudyReviewResponse = z.infer<typeof StudyReviewResponseSchema>;
