import { and, asc, eq, sql } from "drizzle-orm";
import type { ReviewMode, ReviewResult, StudyScope } from "@hudeato/schema";
import { reviewLog, reviewState, word } from "../../db";
import { Db } from "../../types/words-route-type";

// 学習(クイズ/カード)が共用する出題対象・レビュー記録のSQLクエリを定義する。

// 出題対象の単語ID群を抽出する。
// scope=all       … セット内の全ての言葉
// scope=unmastered … 未習得(isMastered=false)の言葉のみ
// userId スコープで必ず絞り、登録順(createdAt 昇順)で返す。
export const findTargetWordIds = async (
	db: Db,
	userId: string,
	wordSetId: string,
	scope: StudyScope,
): Promise<string[]> => {
	const conditions = [eq(word.userId, userId), eq(word.wordSetId, wordSetId)];
	if (scope === "unmastered") {
		conditions.push(eq(word.isMastered, false));
	}

	const rows = await db
		.select({ id: word.id })
		.from(word)
		.where(and(...conditions))
		.orderBy(asc(word.createdAt));

	return rows.map((r) => r.id);
};

// 指定の単語がそのユーザー・セットに属するか確認する（認可スコープ用）。
export const findWordForUser = async (
	db: Db,
	userId: string,
	wordSetId: string,
	wordId: string,
) => {
	return db.query.word.findFirst({
		where: and(
			eq(word.userId, userId),
			eq(word.wordSetId, wordSetId),
			eq(word.id, wordId),
		),
		columns: { id: true },
	});
};

// 正答系の結果か（correct / known）。
const isPositiveResult = (result: ReviewResult) =>
	result === "correct" || result === "known";

// レビュー結果を記録する最小版。
// review_log への追記 + review_state の upsert + word.lastReviewedAt 更新を
// 1トランザクションで行い、更新後の review_state を返す。
// 間隔反復の本アルゴリズムは P4 で実装する。
export const saveReview = async (
	db: Db,
	params: {
		logId: string;
		wordId: string;
		meaningId?: string;
		mode: ReviewMode;
		result: ReviewResult;
	},
) => {
	const positive = isPositiveResult(params.result);

	return db.transaction(async (tx) => {
		await tx.insert(reviewLog).values({
			id: params.logId,
			wordId: params.wordId,
			meaningId: params.meaningId ?? null,
			mode: params.mode,
			result: params.result,
		});

		// 正答→reps+1 / 誤答→lapses+1 & reps リセット の最小ロジック
		await tx
			.insert(reviewState)
			.values({
				wordId: params.wordId,
				reps: positive ? 1 : 0,
				lapses: positive ? 0 : 1,
			})
			.onConflictDoUpdate({
				target: reviewState.wordId,
				set: {
					reps: positive ? sql`${reviewState.reps} + 1` : 0,
					lapses: positive
						? sql`${reviewState.lapses}`
						: sql`${reviewState.lapses} + 1`,
					updatedAt: new Date(),
				},
			});

		// 既存の word.lastReviewedAt も更新しておく
		await tx
			.update(word)
			.set({ lastReviewedAt: new Date() })
			.where(eq(word.id, params.wordId));

		const state = await tx.query.reviewState.findFirst({
			where: eq(reviewState.wordId, params.wordId),
		});
		// 直前に upsert しているため必ず存在する
		return state!;
	});
};
