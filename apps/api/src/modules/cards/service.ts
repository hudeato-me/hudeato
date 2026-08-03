import type {
	Card,
	CardsResponse,
	CardSwipeRequest,
	StudyScope,
} from "@hudeato/schema";
import { Db } from "../../types/words-route-type";
import { findCardDeckWords, saveCardSwipe } from "./repository";

// フラッシュカード(P3)のビジネスロジック層。

// カードデッキを生成する。
// 表示テキストは trim して返し、意味が空文字の行は裏面に空欄が並ぶだけなので除外する。
// その結果、意味が1件も残らない単語（AI補完待ちなど）はカードとして成立しないため
// デッキから落とす。取得件数の上限は SQL 側で掛けているため、除外により limit を
// 下回ることはあるが、追加クエリを撃たずに1往復で済ませることを優先する。
export const generateCardDeck = async (
	db: Db,
	userId: string,
	wordSetId: string,
	scope: StudyScope,
	limit: number,
): Promise<CardsResponse> => {
	const rows = await findCardDeckWords(db, userId, wordSetId, scope, limit);

	const cards: Card[] = [];
	for (const row of rows) {
		const text = row.text.trim();
		if (!text) continue;

		const meanings = row.meanings
			.filter((meaning) => meaning.meaning.trim() !== "")
			.map((meaning) => ({ ...meaning, meaning: meaning.meaning.trim() }));
		if (meanings.length === 0) continue;

		cards.push({
			wordId: row.id,
			text,
			locationLabel: row.locationLabel,
			imageKey: row.imageKey,
			isMastered: row.isMastered,
			meanings,
		});
	}

	return { scope, cards };
};

// カードのスワイプ結果（右=知っている / 左=まだ知らない）を記録し、
// 更新後の isRemembered / isMastered を返す（Web の楽観更新の確定用）。
// 呼び出し側で対象 word の所有確認を済ませている前提（quiz.recordQuizAnswer と同様）。
export const recordCardSwipe = async (
	db: Db,
	params: CardSwipeRequest,
): Promise<{ isRemembered: boolean; isMastered: boolean }> => {
	return saveCardSwipe(db, {
		wordId: params.wordId,
		remembered: params.remembered,
	});
};
