import { and, asc, eq } from "drizzle-orm";
import type { StudyScope } from "@hudeato/schema";
import { word, wordMeaning } from "../../db";
import { Db } from "../../types/words-route-type";

// フラッシュカード(P3)のデッキ取得クエリを定義する。
// カードは単語1枚で、裏面に配下の全ての意味を並べるため、単語と意味をまとめて取得する。

// デッキ対象の単語を意味つきで取得する。
// scope=all        … セット内の全ての言葉
// scope=unmastered … 未習得(word.isMastered=false)の言葉のみ
// userId / wordSetId スコープで必ず絞り、登録順(createdAt 昇順)で返す
// （出題順の忘却曲線最適化は P4）。意味は slot 昇順。
// 意味を1件も持たない単語はカードとして成立しないため、呼び出し元(service)で除外する。
export const findCardDeckWords = async (
	db: Db,
	userId: string,
	wordSetId: string,
	scope: StudyScope,
	limit: number,
) => {
	const conditions = [eq(word.userId, userId), eq(word.wordSetId, wordSetId)];
	if (scope === "unmastered") {
		conditions.push(eq(word.isMastered, false));
	}

	return db.query.word.findMany({
		where: and(...conditions),
		orderBy: [asc(word.createdAt)],
		limit,
		columns: {
			id: true,
			text: true,
			locationLabel: true,
			imageKey: true,
			isMastered: true,
		},
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
