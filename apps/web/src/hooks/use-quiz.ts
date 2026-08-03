import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "~/lib/api-client";
import { wordKeys } from "~/hooks/use-words";
import { QuizAnswerReq, QuizQuery, QuizSessionCreateReq } from "~/types";

const CACHE_STALE_TIME = 5 * 60 * 1000;
// 開始画面の履歴一覧は直近10件まで表示する
const HISTORY_LIST_LIMIT = 10;

// クイズのクエリキー（use-words.ts の流儀に合わせたファクトリ）
export const quizKeys = {
	all: ["quiz"] as const,
	explain: (wordSetId: string, wordId: string) =>
		["quiz", "explain", wordSetId, wordId] as const,
	sessions: (wordSetId: string) => ["quiz", "sessions", wordSetId] as const,
	sessionDetail: (wordSetId: string, sessionId: string) =>
		["quiz", "sessions", wordSetId, sessionId] as const,
};

// クイズ生成。「開始」アクションなので useMutation として実装し、
// 結果（questions等）はルート側の state に保持する
export const useGenerateQuiz = () =>
	useMutation({
		mutationFn: async ({
			wordSetId,
			scope,
			direction,
			count,
		}: { wordSetId: string } & QuizQuery) => {
			const res = await client.api.v1.quiz[":setId"].$get({
				param: { setId: wordSetId },
				query: {
					scope,
					direction,
					count,
				},
			});
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
	});

// 1問ごとの回答記録（バックグラウンド送信。画面は待たせない）
export const useAnswerQuiz = (wordSetId: string) =>
	useMutation({
		mutationFn: async (data: QuizAnswerReq) => {
			const res = await client.api.v1.quiz[":setId"].answer.$post({
				param: { setId: wordSetId },
				json: data,
			});
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
	});

// 結果一覧タップ時の解説取得。シートを開いたときのみ enabled にする
export const useQuizExplanation = (
	wordSetId: string,
	wordId: string,
	enabled: boolean,
) =>
	useQuery({
		queryKey: quizKeys.explain(wordSetId, wordId),
		queryFn: async () => {
			const res = await client.api.v1.quiz[":setId"][":wordId"].explain.$get({
				param: { setId: wordSetId, wordId },
			});
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled: enabled && !!wordSetId && !!wordId,
		staleTime: CACHE_STALE_TIME,
	});

// セッション終了時(result到達時)に単語まわりのキャッシュを無効化するためのフック。
// isMastered/isRemembered が回答によって変わるため、一覧・ダッシュボードを更新する。
export const useInvalidateWordsAfterQuiz = () => {
	const queryClient = useQueryClient();
	return (wordSetId: string) => {
		queryClient.invalidateQueries({ queryKey: wordKeys.bySet(wordSetId) });
		queryClient.invalidateQueries({ queryKey: wordKeys.dashboard(wordSetId) });
	};
};

// 解説シート経由の単語編集後に呼ぶ無効化フック。
// 意味が変わりうるため、解説キャッシュと（sessionsをprefixに持つ）履歴詳細キャッシュを無効化する。
export const useInvalidateQuizAfterWordEdit = (wordSetId: string) => {
	const queryClient = useQueryClient();
	return (wordId: string) => {
		queryClient.invalidateQueries({ queryKey: quizKeys.explain(wordSetId, wordId) });
		queryClient.invalidateQueries({ queryKey: quizKeys.sessions(wordSetId) });
	};
};

// 開始画面の履歴一覧（直近10件、サマリのみ）
export const useQuizSessions = (wordSetId: string) =>
	useQuery({
		queryKey: quizKeys.sessions(wordSetId),
		queryFn: async () => {
			const res = await client.api.v1.quiz[":setId"].sessions.$get({
				param: { setId: wordSetId },
				query: { limit: HISTORY_LIST_LIMIT },
			});
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled: !!wordSetId,
		staleTime: CACHE_STALE_TIME,
	});

// クイズセッションの保存（結果画面到達時に1回だけ呼ぶ）。成功したら履歴一覧を無効化する。
export const useSaveQuizSession = (wordSetId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: QuizSessionCreateReq) => {
			const res = await client.api.v1.quiz[":setId"].sessions.$post({
				param: { setId: wordSetId },
				json: data,
			});
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: quizKeys.sessions(wordSetId) });
		},
	});
};

// 過去の結果画面の再表示用。履歴カードをタップしたときのみ enabled にする
export const useQuizSessionDetail = (
	wordSetId: string,
	sessionId: string,
	enabled: boolean,
) =>
	useQuery({
		queryKey: quizKeys.sessionDetail(wordSetId, sessionId),
		queryFn: async () => {
			const res = await client.api.v1.quiz[":setId"].sessions[
				":sessionId"
			].$get({
				param: { setId: wordSetId, sessionId },
			});
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled: enabled && !!wordSetId && !!sessionId,
		staleTime: CACHE_STALE_TIME,
	});
