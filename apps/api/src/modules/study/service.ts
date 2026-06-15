import type { StudyScope, StudyTargetsResponse } from "@hudeato/schema";
import { Db } from "../../types/words-route-type";
import { findTargetWordIds } from "./repository";

// 学習APIのビジネスロジック層。

// 出題対象の単語ID群を取得する。
export const getStudyTargets = async (
	db: Db,
	userId: string,
	wordSetId: string,
	scope: StudyScope,
): Promise<StudyTargetsResponse> => {
	const wordIds = await findTargetWordIds(db, userId, wordSetId, scope);
	return { scope, wordIds, count: wordIds.length };
};
