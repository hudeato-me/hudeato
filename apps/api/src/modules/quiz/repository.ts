import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { QuizDirection, QuizScope } from "@hudeato/schema";
import { quizSession, word, wordEmbedding, wordMeaning, wordSet } from "../../db";
import { Db } from "../../types/words-route-type";
import { saveReviewInTx } from "../study/repository";

// クイズ生成が使う出題候補(単語×意味)のSQLクエリを定義する。

// 出題候補の1行（単語1件・意味1件の組）。
export type QuizCandidate = {
	wordId: string;
	wordText: string;
	meaningId: string;
	meaningText: string;
};

// クイズの出題候補(単語×意味)を取得する。
// scope=all        … セット内の全ての意味
// scope=unanswered … 未正解(word_meaning.isRemembered=false)の意味のみ
// userId / wordSetId スコープで必ず絞り、登録順(word.createdAt昇順→slot昇順)で安定させる。
// 意味が空文字の行は候補として不適切なため除外する。
// テキストは trim して返し、選択肢の重複判定・表示が同じ正規化を共有できるようにする。
export const findQuizCandidates = async (
	db: Db,
	userId: string,
	wordSetId: string,
	scope: QuizScope,
): Promise<QuizCandidate[]> => {
	const conditions = [
		eq(word.userId, userId),
		eq(word.wordSetId, wordSetId),
		ne(wordMeaning.meaning, ""),
	];
	if (scope === "unanswered") {
		conditions.push(eq(wordMeaning.isRemembered, false));
	}

	const rows = await db
		.select({
			wordId: word.id,
			wordText: word.text,
			meaningId: wordMeaning.id,
			meaningText: wordMeaning.meaning,
		})
		.from(word)
		.innerJoin(wordMeaning, eq(wordMeaning.wordId, word.id))
		.where(and(...conditions))
		.orderBy(asc(word.createdAt), asc(wordMeaning.slot));

	return rows
		.map((row) => ({
			...row,
			wordText: row.wordText.trim(),
			meaningText: row.meaningText.trim(),
		}))
		.filter((row) => row.wordText !== "" && row.meaningText !== "");
};

// ---------------------------------------------------------------------------
// ベクトル近傍によるディストラクタ候補の抽出。
// ---------------------------------------------------------------------------

// 指定単語の埋め込みに近い同セット内の単語IDを近い順に返す（自己結合。
// 対象単語に埋め込みが無ければ空配列）。
// wordId は呼び出し元でユーザー/セットスコープ済みであることを前提とする
// （target 側結合にはスコープを掛けていない）。
export const findNearestWordIdsForWord = async (
	db: Db,
	userId: string,
	wordSetId: string,
	wordId: string,
	k: number,
): Promise<string[]> => {
	if (!Number.isInteger(k) || k < 1) {
		throw new Error("k must be a positive integer");
	}

	// 対象単語自身の埋め込みを自己結合で参照する側のエイリアス
	const target = alias(wordEmbedding, "target_embedding");
	const distance = sql<number>`vector_distance_cos(${wordEmbedding.embedding}, ${target.embedding})`;

	const rows = await db
		.select({ wordId: wordEmbedding.wordId, distance })
		.from(wordEmbedding)
		.innerJoin(word, eq(word.id, wordEmbedding.wordId))
		.innerJoin(target, eq(target.wordId, wordId))
		.where(
			and(
				eq(word.userId, userId),
				eq(word.wordSetId, wordSetId),
				ne(wordEmbedding.wordId, wordId),
			),
		)
		.orderBy(asc(distance))
		.limit(k);

	return rows.map((row) => row.wordId);
};

// ---------------------------------------------------------------------------
// クイズの回答記録・解説取得。
// ---------------------------------------------------------------------------

// 回答結果を1トランザクションで記録する。
// (a) study.saveReviewInTx で review_log 追記 + review_state 更新
// (b) 回答した meaning の isRemembered を正誤に応じて更新
// (c) その単語の全 meaning の isRemembered を集計し、word.isMastered を再計算
//     （全て true かつ meaning が1件以上 → true、それ以外 → false）
// 呼び出し元で対象 word/meaning の所有・整合性確認を済ませている前提。
export const saveQuizAnswer = async (
	db: Db,
	params: {
		logId: string;
		wordId: string;
		meaningId: string;
		correct: boolean;
	},
) => {
	return db.transaction(async (tx) => {
		const reviewState = await saveReviewInTx(tx, {
			logId: params.logId,
			wordId: params.wordId,
			meaningId: params.meaningId,
			mode: "quiz",
			result: params.correct ? "correct" : "wrong",
		});

		await tx
			.update(wordMeaning)
			.set({ isRemembered: params.correct })
			.where(eq(wordMeaning.id, params.meaningId));

		// 全行取得ではなく件数集計で isMastered を再計算する
		const [{ total, unrememberedCount }] = await tx
			.select({
				total: count(),
				unrememberedCount: count(
					sql`CASE WHEN ${wordMeaning.isRemembered} = false THEN 1 END`,
				),
			})
			.from(wordMeaning)
			.where(eq(wordMeaning.wordId, params.wordId));

		const isMastered = total > 0 && unrememberedCount === 0;

		await tx
			.update(word)
			.set({ isMastered })
			.where(eq(word.id, params.wordId));

		return { reviewState, isRemembered: params.correct, isMastered };
	});
};

// 解説表示用に単語＋意味一覧（slot昇順）を取得する。
// userId / wordSetId / wordId スコープで絞り、見つからなければ undefined。
// word/repository.ts の findWordById は meaning.id を含まず不要な列も多いため、
// 解説専用に必要な列だけを取得するクエリとしてここに新設する。
export const findWordExplanation = async (
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
		columns: { id: true, text: true, locationLabel: true, imageKey: true },
		with: {
			meanings: {
				orderBy: [asc(wordMeaning.slot)],
				columns: {
					id: true,
					slot: true,
					meaning: true,
					partOfSpeech: true,
					phonetic: true,
					example: true,
					collocation: true,
					synonym: true,
					etymology: true,
					source: true,
					isRemembered: true,
				},
			},
		},
	});
};

// ---------------------------------------------------------------------------
// クイズセッション履歴の永続化。
// ---------------------------------------------------------------------------

// 指定セットがそのユーザーの所有か確認する（認可スコープ用。word-sets 側に相当する
// 既存クエリが無いためここに新設する）。
export const findWordSetForUser = async (
	db: Db,
	userId: string,
	wordSetId: string,
) => {
	return db.query.wordSet.findFirst({
		where: and(eq(wordSet.userId, userId), eq(wordSet.id, wordSetId)),
		columns: { id: true },
	});
};

// クイズセッションを1件挿入する。
// createdAt はレスポンスと一致させるため呼び出し元(service)で採番した値をそのまま保存する
// （このリポジトリでは .returning() を使わない既存流儀のため、DB default 任せだと
// 挿入直後の正確な値をレスポンスに使えない）。
export const insertQuizSession = async (
	db: Db,
	params: {
		id: string;
		userId: string;
		wordSetId: string;
		scope: QuizScope;
		direction: QuizDirection;
		timeLimitSeconds: number;
		correctCount: number;
		totalCount: number;
		itemsJson: string;
		createdAt: Date;
	},
) => {
	await db.insert(quizSession).values(params);
};

// クイズセッション履歴一覧をサマリ列のみで取得する(itemsJsonは含めない・作成日時降順・limit件)。
export const findQuizSessions = async (
	db: Db,
	userId: string,
	wordSetId: string,
	limit: number,
) => {
	return db
		.select({
			id: quizSession.id,
			scope: quizSession.scope,
			direction: quizSession.direction,
			timeLimitSeconds: quizSession.timeLimitSeconds,
			correctCount: quizSession.correctCount,
			totalCount: quizSession.totalCount,
			createdAt: quizSession.createdAt,
		})
		.from(quizSession)
		.where(
			and(eq(quizSession.userId, userId), eq(quizSession.wordSetId, wordSetId)),
		)
		.orderBy(desc(quizSession.createdAt))
		.limit(limit);
};

// クイズセッション1件をitemsJson込みで取得する(結果画面の再表示用)。見つからなければ undefined。
export const findQuizSessionDetail = async (
	db: Db,
	userId: string,
	wordSetId: string,
	sessionId: string,
) => {
	return db.query.quizSession.findFirst({
		where: and(
			eq(quizSession.userId, userId),
			eq(quizSession.wordSetId, wordSetId),
			eq(quizSession.id, sessionId),
		),
	});
};
