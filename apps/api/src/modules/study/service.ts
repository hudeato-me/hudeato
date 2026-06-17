import type {
	ReviewState,
	StudyReviewRequest,
	StudyScope,
	StudyTargetsResponse,
} from "@hudeato/schema";
import { Db } from "../../types/words-route-type";
import { findTargetWordIds, saveReview } from "./repository";

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

// レビュー結果を記録し、更新後の review_state を返す。
// 呼び出し側で対象 word の所有確認を済ませている前提。
export const recordReview = async (
	db: Db,
	params: StudyReviewRequest,
): Promise<ReviewState> => {
	const state = await saveReview(db, {
		logId: crypto.randomUUID(),
		wordId: params.wordId,
		meaningId: params.meaningId,
		mode: params.mode,
		result: params.result,
	});

	return {
		meaningId: state.meaningId,
		reps: state.reps,
		lapses: state.lapses,
		intervalDays: state.intervalDays,
		easeFactor: state.easeFactor,
		nextReviewAt: state.nextReviewAt ? state.nextReviewAt.getTime() : null,
	};
};
