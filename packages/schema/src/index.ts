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
// mode と result の組み合わせも検証する（quiz→correct/wrong, flashcard→known/unknown）。
export const StudyReviewRequestSchema = z
	.object({
		wordId: z.string().min(1),
		meaningId: z.string().min(1),
		mode: ReviewModeSchema,
		result: ReviewResultSchema,
	})
	.superRefine(({ mode, result }, ctx) => {
		const validPair =
			(mode === "quiz" && (result === "correct" || result === "wrong")) ||
			(mode === "flashcard" &&
				(result === "known" || result === "unknown"));
		if (!validPair) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["result"],
				message: "result is not valid for the selected review mode",
			});
		}
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

// ---------------------------------------------------------------------------
// AI補完（P1）の共有スキーマ
// Gemini の構造化出力(JSON)を受ける契約。api / web はこのZodを単一の正とする。
// ---------------------------------------------------------------------------

// 単語の補完ステータス。'pending'=補完中 / 'done'=完了 / 'failed'=失敗。
export const CompletionStatusSchema = z.enum(["pending", "done", "failed"]);
export type CompletionStatus = z.infer<typeof CompletionStatusSchema>;

// AIが生成する1つの意味。word_meaning の各slotに対応する。
// meaning のみ必須。他は不明なら null（Gemini responseSchema でも nullable）。
// source(出典) はユーザー由来のため AI 生成対象に含めない。
export const GeneratedMeaningSchema = z.object({
	meaning: z.string().min(1),
	partOfSpeech: z.string().nullish(),
	phonetic: z.string().nullish(),
	example: z.string().nullish(),
	collocation: z.string().nullish(),
	synonym: z.string().nullish(),
	etymology: z.string().nullish(),
});
export type GeneratedMeaning = z.infer<typeof GeneratedMeaningSchema>;

// AI補完1回分の結果（単語の複数語義）。
export const WordCompletionResultSchema = z.object({
	meanings: z.array(GeneratedMeaningSchema).min(1),
});
export type WordCompletionResult = z.infer<typeof WordCompletionResultSchema>;

// AI補完で埋めうるフィールド（source=出典 はユーザー由来のため対象外）。
export const CompletableFieldSchema = z.enum([
	"meaning",
	"partOfSpeech",
	"phonetic",
	"example",
	"collocation",
	"synonym",
	"etymology",
]);
export type CompletableField = z.infer<typeof CompletableFieldSchema>;
export const COMPLETABLE_FIELDS = CompletableFieldSchema.options;

// POST /words/:setId/:wordId/complete のリクエスト（チャット文脈つき再補完）。
// targets を明示指定した欄だけ上書き再生成する。省略時は空欄のみ補完。
export const WordRecompleteRequestSchema = z.object({
	prompt: z.string().nullish(),
	targets: z
		.array(
			z.object({
				slot: z.number().int().min(1).max(5),
				fields: z.array(CompletableFieldSchema).min(1),
			}),
		)
		.min(1)
		.optional(),
});
export type WordRecompleteRequest = z.infer<typeof WordRecompleteRequestSchema>;

// ---------------------------------------------------------------------------
// クイズ(P2)の共有スキーマ
// クイズは meaning 単位で出題する（review が meaning 単位のため）。
// 正誤判定はクライアント側で行うため、レスポンスに correctIndex を含める。
// ---------------------------------------------------------------------------

// 出題方向。wordToMeaning=問題文が単語・選択肢が意味 / meaningToWord=問題文が意味・選択肢が単語
export const QuizDirectionSchema = z.enum(["wordToMeaning", "meaningToWord"]);
export type QuizDirection = z.infer<typeof QuizDirectionSchema>;

// 出題範囲。all=セット内全ての意味 / unanswered=未正解(word_meaning.isRemembered=false)の意味のみ
export const QuizScopeSchema = z.enum(["all", "unanswered"]);
export type QuizScope = z.infer<typeof QuizScopeSchema>;

// GET /quiz/:setId のクエリ（エンドポイント自体は P2-3）
export const QuizQuerySchema = z.object({
	scope: QuizScopeSchema.default("all"),
	direction: QuizDirectionSchema.default("wordToMeaning"),
	count: z.coerce.number().int().min(1).max(20).default(10),
});
export type QuizQuery = z.infer<typeof QuizQuerySchema>;

// クイズの1問。正誤判定はクライアント側で行うため correctIndex を送出する。
export const QuizQuestionSchema = z.object({
	wordId: z.string(),
	meaningId: z.string(),
	prompt: z.string().min(1),
	choices: z.array(z.string()).length(4),
	correctIndex: z.number().int().min(0).max(3),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

// GET /quiz/:setId のレスポンス
export const QuizResponseSchema = z.object({
	scope: QuizScopeSchema,
	direction: QuizDirectionSchema,
	questions: z.array(QuizQuestionSchema),
});
export type QuizResponse = z.infer<typeof QuizResponseSchema>;

// POST /quiz/:setId/answer のリクエスト。正誤判定はクライアント側で行い、結果だけを記録する。
export const QuizAnswerRequestSchema = z.object({
	wordId: z.string().min(1),
	meaningId: z.string().min(1),
	correct: z.boolean(),
});
export type QuizAnswerRequest = z.infer<typeof QuizAnswerRequestSchema>;

// レスポンス: review_state に加え、更新後の isRemembered / isMastered を返す（Web の表示更新用）。
export const QuizAnswerResponseSchema = z.object({
	success: z.boolean(),
	reviewState: ReviewStateSchema,
	isRemembered: z.boolean(),
	isMastered: z.boolean(),
});
export type QuizAnswerResponse = z.infer<typeof QuizAnswerResponseSchema>;

// GET /quiz/:setId/:wordId/explain のレスポンス（結果一覧からの解説表示用）。
export const QuizExplainMeaningSchema = z.object({
	id: z.string(),
	slot: z.number().int(),
	meaning: z.string(),
	partOfSpeech: z.string().nullable(),
	phonetic: z.string().nullable(),
	example: z.string().nullable(),
	collocation: z.string().nullable(),
	synonym: z.string().nullable(),
	etymology: z.string().nullable(),
	source: z.string().nullable(),
	isRemembered: z.boolean(),
});
export type QuizExplainMeaning = z.infer<typeof QuizExplainMeaningSchema>;

export const QuizExplainResponseSchema = z.object({
	wordId: z.string(),
	text: z.string(),
	locationLabel: z.string().nullable(),
	imageKey: z.string().nullable(),
	meanings: z.array(QuizExplainMeaningSchema),
});
export type QuizExplainResponse = z.infer<typeof QuizExplainResponseSchema>;

// ---------------------------------------------------------------------------
// クイズセッション履歴(P2)の共有スキーマ
// 結果画面のセッション(正解数・各問の回答内容)をサーバーに保存し、開始画面の履歴一覧・
// 過去の結果画面の再表示に使う。review_log(学習記録)とは役割が別で、
// こちらは表示用にテキストをデノーマライズしたスナップショットを保持する。
// ---------------------------------------------------------------------------

// クイズの制限時間（秒）。開始画面で 10/20/30 から選ぶ。
export const QuizTimeLimitSchema = z.union([z.literal(10), z.literal(20), z.literal(30)]);
export type QuizTimeLimit = z.infer<typeof QuizTimeLimitSchema>;

// セッション内の1問分の表示用スナップショット。selectedText が null は時間切れ(未回答)。
export const QuizSessionItemSchema = z.object({
	wordId: z.string(),
	meaningId: z.string(),
	prompt: z.string(),
	selectedText: z.string().nullable(),
	correctText: z.string(),
	correct: z.boolean(),
});
export type QuizSessionItem = z.infer<typeof QuizSessionItemSchema>;

// POST /quiz/:setId/sessions のリクエスト。correctCount/totalCountはサーバー側でitemsから算出する。
export const QuizSessionCreateRequestSchema = z.object({
	scope: QuizScopeSchema,
	direction: QuizDirectionSchema,
	timeLimitSeconds: QuizTimeLimitSchema,
	items: z.array(QuizSessionItemSchema).min(1).max(20),
});
export type QuizSessionCreateRequest = z.infer<typeof QuizSessionCreateRequestSchema>;

// 履歴一覧の1件(itemsは含めない軽量サマリ)
export const QuizSessionSummarySchema = z.object({
	id: z.string(),
	scope: QuizScopeSchema,
	direction: QuizDirectionSchema,
	timeLimitSeconds: z.number().int(),
	correctCount: z.number().int().nonnegative(),
	totalCount: z.number().int().positive(),
	createdAt: z.number(), // epoch ms
});
export type QuizSessionSummary = z.infer<typeof QuizSessionSummarySchema>;

// GET /quiz/:setId/sessions/:sessionId のレスポンス(過去の結果画面の再表示用)
export const QuizSessionDetailSchema = QuizSessionSummarySchema.extend({
	items: z.array(QuizSessionItemSchema),
});
export type QuizSessionDetail = z.infer<typeof QuizSessionDetailSchema>;
