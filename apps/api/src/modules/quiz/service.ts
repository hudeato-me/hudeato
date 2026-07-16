import type {
	QuizDirection,
	QuizQuestion,
	QuizResponse,
	QuizScope,
} from "@hudeato/schema";
import { Db } from "../../types/words-route-type";
import {
	findNearestWordIdsForWord,
	findQuizCandidates,
	type QuizCandidate,
} from "./repository";

// クイズ生成のビジネスロジック層。
// 正解はセット内からランダム選定し、ダミー選択肢は正解語のベクトル近傍(上位10件)からの
// サンプリングを優先する。近傍が足りない・埋め込みが無い場合は残りの候補からランダムに
// フォールバックして補う。

export type QuizGenerationParams = {
	userId: string;
	wordSetId: string;
	scope: QuizScope;
	direction: QuizDirection;
	count: number;
};

// Fisher–Yates シャッフル。rng を注入することでテストを決定的にできる。
const shuffle = <T>(items: T[], rng: () => number): T[] => {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
};

// 出題候補を単語IDでグループ化する(1回の生成内で同一単語から最大1問にするため)。
const groupByWordId = (
	candidates: QuizCandidate[],
): Map<string, QuizCandidate[]> => {
	const grouped = new Map<string, QuizCandidate[]>();
	for (const candidate of candidates) {
		const list = grouped.get(candidate.wordId);
		if (list) {
			list.push(candidate);
		} else {
			grouped.set(candidate.wordId, [candidate]);
		}
	}
	return grouped;
};

// プールを単語単位でグループ化し、各単語から1件をランダムに残す
// (ディストラクタが同一単語の複数意味から重複して選ばれないようにするため)。
const pickOneCandidatePerWord = (
	candidates: QuizCandidate[],
	rng: () => number,
): QuizCandidate[] => {
	const grouped = groupByWordId(candidates);
	return Array.from(grouped.values()).map(
		(list) => list[Math.floor(rng() * list.length)],
	);
};

// direction に応じたディストラクタ候補テキストを取り出す。
// wordToMeaning(問題文=単語) → ディストラクタは他語の意味
// meaningToWord(問題文=意味) → ディストラクタは他語の単語
const distractorText = (candidate: QuizCandidate, direction: QuizDirection) =>
	direction === "wordToMeaning" ? candidate.meaningText : candidate.wordText;

// 正解語を除いた候補プールから、テキスト重複なしのディストラクタを最大3件選ぶ。
// preferredWordIds(正解語のベクトル近傍・近い順)があればそこからのサンプリングを優先し、
// 足りない分は残りの候補(非近傍、または埋め込み欠損時は全候補)からランダムに埋める。
export const pickDistractors = (
	pool: QuizCandidate[],
	correct: { wordId: string; text: string },
	direction: QuizDirection,
	rng: () => number = Math.random,
	preferredWordIds: string[] = [],
): string[] => {
	const correctText = correct.text.trim();
	const otherCandidates = pickOneCandidatePerWord(
		pool.filter((candidate) => candidate.wordId !== correct.wordId),
		rng,
	);

	const preferredWordIdSet = new Set(preferredWordIds);
	const preferredCandidates = otherCandidates.filter((candidate) =>
		preferredWordIdSet.has(candidate.wordId),
	);
	const restCandidates = otherCandidates.filter(
		(candidate) => !preferredWordIdSet.has(candidate.wordId),
	);
	// 近傍群→残り群の順で、それぞれをシャッフルして連結する(=近傍優先のサンプリング)。
	const orderedCandidates = [
		...shuffle(preferredCandidates, rng),
		...shuffle(restCandidates, rng),
	];

	const seenTexts = new Set([correctText]);
	const distractors: string[] = [];
	for (const candidate of orderedCandidates) {
		const text = distractorText(candidate, direction).trim();
		if (!text || seenTexts.has(text)) continue;
		seenTexts.add(text);
		distractors.push(text);
		if (distractors.length === 3) break;
	}

	return distractors;
};

// 正解語につきベクトル近傍検索で優先する候補数(上位k件からサンプリングする)。
const NEIGHBOR_DISTRACTOR_LIMIT = 10;

// 指定範囲(scope)から4択クイズを生成する。
// 1. 出題候補を単語単位でグループ化し、シャッフルして先頭 count 語を採用する。
// 2. 各語につき eligible な意味から1つを正解として選ぶ。
// 3. 正解語のベクトル近傍(上位10件)を優先してディストラクタを3件選ぶ
//    (scope=unanswered でもディストラクタは all プールから選ぶ)。
//    近傍が足りない・埋め込みが無い場合は残りの候補からランダムに補う。
// 4. ディストラクタが3件揃わない問題はドロップする。
export const generateQuiz = async (
	db: Db,
	params: QuizGenerationParams,
	rng: () => number = Math.random,
): Promise<QuizResponse> => {
	const { userId, wordSetId, scope, direction, count } = params;

	const targetCandidates = await findQuizCandidates(
		db,
		userId,
		wordSetId,
		scope,
	);
	// scope=all のときはクエリを2重発行せず同じ結果を使い回す
	const distractorPool =
		scope === "all"
			? targetCandidates
			: await findQuizCandidates(db, userId, wordSetId, "all");

	const wordGroups = groupByWordId(targetCandidates);
	const targetWordIds = shuffle(Array.from(wordGroups.keys()), rng).slice(
		0,
		count,
	);

	const questions: QuizQuestion[] = [];
	for (const wordId of targetWordIds) {
		const meanings = wordGroups.get(wordId);
		if (!meanings) continue;
		const correct = meanings[Math.floor(rng() * meanings.length)];
		const correctText =
			direction === "wordToMeaning" ? correct.meaningText : correct.wordText;

		const neighborWordIds = await findNearestWordIdsForWord(
			db,
			userId,
			wordSetId,
			wordId,
			NEIGHBOR_DISTRACTOR_LIMIT,
		);
		const distractors = pickDistractors(
			distractorPool,
			{ wordId, text: correctText },
			direction,
			rng,
			neighborWordIds,
		);
		if (distractors.length < 3) continue;

		const choices = shuffle([correctText, ...distractors], rng);
		const correctIndex = choices.indexOf(correctText);
		const prompt =
			direction === "wordToMeaning" ? correct.wordText : correct.meaningText;

		questions.push({
			wordId,
			meaningId: correct.meaningId,
			prompt,
			choices,
			correctIndex,
		});
	}

	return { scope, direction, questions };
};
