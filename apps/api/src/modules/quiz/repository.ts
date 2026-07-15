import { and, asc, eq, ne } from "drizzle-orm";
import type { QuizScope } from "@hudeato/schema";
import { word, wordMeaning } from "../../db";
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
