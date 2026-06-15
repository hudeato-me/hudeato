import { and, asc, eq } from "drizzle-orm";
import type { StudyScope } from "@hudeato/schema";
import { word } from "../../db";
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
