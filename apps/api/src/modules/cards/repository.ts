import { and, asc, eq } from "drizzle-orm";
import type { StudyScope } from "@hudeato/schema";
import { word, wordMeaning } from "../../db";
import { Db } from "../../types/words-route-type";
import { recalcMasteredInTx, saveReviewInTx } from "../study/repository";

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

// ---------------------------------------------------------------------------
// スワイプ記録。
// ---------------------------------------------------------------------------

// カードのスワイプ結果を1トランザクションで記録する。
// カードは単語1枚・評価も単語単位なので、配下の全 meaning に同じ結果を適用する。
// (a) 各 meaning に review_log 追記 + review_state 更新（study.saveReviewInTx を共有）
// (b) 全 meaning の isRemembered を remembered で更新
// (c) word.isMastered を再計算（study.recalcMasteredInTx を共有）
// review_log は meaning 単位で残すため、単語の意味数だけ行が増える（P4 の入力として必要）。
// 呼び出し元で対象 word の所有確認を済ませている前提。
// 意味を1件も持たない単語（デッキに出ないはず）の場合は何も記録せず isRemembered=false を返す。
export const saveCardSwipe = async (
	db: Db,
	params: { wordId: string; remembered: boolean },
) => {
	return db.transaction(async (tx) => {
		const meanings = await tx
			.select({ id: wordMeaning.id })
			.from(wordMeaning)
			.where(eq(wordMeaning.wordId, params.wordId))
			.orderBy(asc(wordMeaning.slot));

		if (meanings.length === 0) {
			return { isRemembered: false, isMastered: false };
		}

		for (const meaning of meanings) {
			await saveReviewInTx(tx, {
				logId: crypto.randomUUID(),
				wordId: params.wordId,
				meaningId: meaning.id,
				mode: "flashcard",
				result: params.remembered ? "known" : "unknown",
			});
		}

		await tx
			.update(wordMeaning)
			.set({ isRemembered: params.remembered })
			.where(eq(wordMeaning.wordId, params.wordId));

		const isMastered = await recalcMasteredInTx(tx, params.wordId);

		return { isRemembered: params.remembered, isMastered };
	});
};
