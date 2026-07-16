import { and, asc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { QuizScope } from "@hudeato/schema";
import { word, wordEmbedding, wordMeaning } from "../../db";
import { Db } from "../../types/words-route-type";

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
