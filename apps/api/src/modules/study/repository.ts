import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { ReviewMode, ReviewResult, StudyScope } from "@hudeato/schema";
import { reviewLog, reviewState, word, wordEmbedding, wordMeaning } from "../../db";
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

// 指定の meaning がその単語に属するか確認する（review 記録の整合性確保）。
export const findMeaningForWord = async (
	db: Db,
	wordId: string,
	meaningId: string,
) => {
	return db.query.wordMeaning.findFirst({
		where: and(eq(wordMeaning.id, meaningId), eq(wordMeaning.wordId, wordId)),
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

// ---------------------------------------------------------------------------
// ベクトル埋め込み（Turso Vector）。クイズのディストラクタ近傍検索に使う。
// 値は vector32() / 検索は vector_distance_cos() で扱う。
// ---------------------------------------------------------------------------

// ベクトルが有限な数値の非空配列であることを検証する（SQL実行前のガード）。
const assertFiniteVector = (v: number[]) => {
	if (v.length === 0 || v.some((n) => !Number.isFinite(n))) {
		throw new Error("vector must contain finite numeric values");
	}
};

// 単語の埋め込みベクトルを upsert する。
export const upsertWordEmbedding = async (
	db: Db,
	wordId: string,
	vector: number[],
	model: string,
) => {
	assertFiniteVector(vector);
	const vectorJson = JSON.stringify(vector);
	await db
		.insert(wordEmbedding)
		.values({
			wordId,
			embedding: sql`vector32(${vectorJson})`,
			model,
		})
		.onConflictDoUpdate({
			target: wordEmbedding.wordId,
			set: {
				embedding: sql`vector32(${vectorJson})`,
				model,
				updatedAt: new Date(),
			},
		});
};

// クエリベクトルに近い単語IDを近い順に返す（コサイン距離の昇順）。
// userId / wordSetId スコープで絞り、excludeWordId を除外できる。
export const findNearestWordIds = async (
	db: Db,
	userId: string,
	wordSetId: string,
	queryVector: number[],
	k: number,
	excludeWordId?: string,
): Promise<Array<{ wordId: string; distance: number }>> => {
	if (!Number.isInteger(k) || k < 1) {
		throw new Error("k must be a positive integer");
	}
	assertFiniteVector(queryVector);
	const queryJson = JSON.stringify(queryVector);
	const distance = sql<number>`vector_distance_cos(${wordEmbedding.embedding}, vector32(${queryJson}))`;

	const conditions = [
		eq(word.userId, userId),
		eq(word.wordSetId, wordSetId),
	];
	if (excludeWordId) {
		conditions.push(ne(wordEmbedding.wordId, excludeWordId));
	}

	return db
		.select({ wordId: wordEmbedding.wordId, distance })
		.from(wordEmbedding)
		.innerJoin(word, eq(word.id, wordEmbedding.wordId))
		.where(and(...conditions))
		.orderBy(asc(distance))
		.limit(k);
};
