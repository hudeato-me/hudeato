import { createDb } from "../../db";
import { findWordSets } from "./repository";

import { Db } from "../../types/words-route-type";

// サービス関数を定義

// ユーザーのwordSet一覧を取得
export const getWordSets = async (
	db: Db,
	userId: string,
) => {
	const wordSets = await findWordSets(db, userId);
	return wordSets;
};
