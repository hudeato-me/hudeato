import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "~/lib/api-client";
import { Word, CreateWordReq, UpdateWordReq, CompleteWordReq, CreateWordSetReq, UpdateWordSetReq } from "~/types";

const CACHE_STALE_TIME = 5 * 60 * 1000;

// クエリキーの管理
// 単語のクエリキー
export const wordKeys = {
	all: ["words"] as const,
	bySet: (wordSetId: string) => ["words", "set", wordSetId] as const,
	single: (wordId: string) => ["words", wordId] as const,
	dashboard: (wordSetId: string) => ["dashboard", wordSetId] as const,
	search: (wordSetId: string, q: string) => ["words", "search", wordSetId, q] as const,
};
// 単語セットのクエリキー
export const wordSetKeys = {
	all: ["wordSets"] as const,
};


// 単語セット内の全単語取得
export const useWords = (wordSetId: string, enabled = true) =>
	useQuery({
		queryKey: wordKeys.bySet(wordSetId),
		queryFn: async () => {

			const res = await client.api.v1.sets[":setId"].words.$get({
				param: { setId: wordSetId },
				query: {}, // limit/offsetは省略可能だが型上オブジェクトは必要
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled: enabled && !!wordSetId,
		staleTime: CACHE_STALE_TIME,
		// AI補完中(pending)の単語がある間だけ2秒間隔でポーリングし、完了を反映する
		refetchInterval: (query) => {
			const words = query.state.data;
			const hasPending =
				Array.isArray(words) &&
				words.some((w) => w.completionStatus === "pending");
			return hasPending ? 2000 : false;
		},
	});

// 単語詳細情報の取得
export const useWord = (wordSetId: string, wordId: string, enabled = true) => {
	const queryClient = useQueryClient();
	return useQuery({
		queryKey: wordKeys.single(wordId),
		queryFn: async () => {

			const res = await client.api.v1.sets[":setId"].words[":wordId"].$get({
				param: { setId: wordSetId, wordId },
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled: enabled && !!wordId && !!wordSetId,
		staleTime: CACHE_STALE_TIME,
		// placeholderDataで表示は即座に行ないつつ、バックグラウンドでfetchして、fetch後画面を更新する
		placeholderData: () => {
			// wordSetIdの全件リストから探す
			const allWords = queryClient.getQueryData<Word[]>(wordKeys.bySet(wordSetId));
			const foundInAll = allWords?.find((w) => w.id === wordId);
			if (foundInAll) return { error: null, data: foundInAll } as any;

			return undefined;
		},
	});
};

// ダッシュボード
export const useDashboard = (wordSetId: string, enabled = true) => {
	const queryClient = useQueryClient();
	return useQuery({
		queryKey: wordKeys.dashboard(wordSetId),
		queryFn: async () => {
			const cached = queryClient.getQueryState(wordKeys.dashboard(wordSetId));

			const res = await client.api.dashboard.summary.$get({
				query: { wordSetId },
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json(); // 生データのみ返す
		},
		select: (data) => {
			// Streak計算をselectで行う（常に現在時刻で計算）
			let streak = 0;
			if (data.activityTimestamps && data.activityTimestamps.length > 0) {
				// リストを用意
				const activeDates = new Set<string>();
				// リストに日付を追加
				data.activityTimestamps.forEach((ts: number) => {
					// 日付の文字列に変換
					const d = new Date(ts);
					// リストに追加
					activeDates.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
				});
				// 今日の日付
				const today = new Date();
				// 昨日の日付
				const yesterday = new Date(today);
				yesterday.setDate(yesterday.getDate() - 1);
				// 日付の文字列に変換
				const formatDate = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
				// チェックする日付
				let checkDate = new Date(today);
				// 今日単語登録していたらStreakを1にする
				if (activeDates.has(formatDate(today))) {
					streak = 1;
					checkDate.setDate(checkDate.getDate() - 1);
					// 今日単語登録をしていなくても、昨日登録していたらStreakを1にする
				} else if (activeDates.has(formatDate(yesterday))) {
					streak = 1;
					checkDate = new Date(yesterday);
					checkDate.setDate(checkDate.getDate() - 1);
				}
				// Streakが1以上なら、さらに過去に遡ってチェック
				if (streak > 0) {
					while (activeDates.has(formatDate(checkDate))) {
						streak++;
						checkDate.setDate(checkDate.getDate() - 1);
					}
				}
				// 全てのifに当てはまらなかったら、streakは0のまま
			}
			return { ...data, streak };
		},
		enabled: enabled && !!wordSetId,
		staleTime: 1000 * 60, // 1 min
		gcTime: 1000 * 60 * 30, // 30 mins
	});
};

// wordSet一覧の取得
export const useWordSets = (enabled = true) =>
	useQuery({
		queryKey: wordSetKeys.all,
		queryFn: async () => {

			const res = await client.api.v1.sets.$get();
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		staleTime: 1000 * 60 * 5, // 5分キャッシュ
		enabled,
	});

// 単語の検索
export const useSearchWords = (wordSetId: string, q: string, enabled = true) =>
	useQuery({
		queryKey: wordKeys.search(wordSetId, q),
		queryFn: async () => {
			const res = await client.api.v1.sets[":setId"].words.search.$get({
				param: { setId: wordSetId },
				query: { q },
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled: enabled && !!wordSetId && !!q.trim(),
		staleTime: CACHE_STALE_TIME,
		placeholderData: keepPreviousData,
	});

// 単語作成
export const useCreateWord = (wordSetId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateWordReq) => {
			const res = await client.api.v1.sets[":setId"].words.$post({
				param: { setId: wordSetId },
				json: data,
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: wordKeys.bySet(wordSetId) });
			queryClient.invalidateQueries({ queryKey: wordKeys.dashboard(wordSetId) });
			queryClient.invalidateQueries({ queryKey: wordSetKeys.all });
		},
	});
};

// 単語更新
export const useUpdateWord = (wordSetId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ wordId, data }: { wordId: string; data: UpdateWordReq }) => {
			const res = await client.api.v1.sets[":setId"].words[":wordId"].$put({
				param: { setId: wordSetId, wordId },
				json: data,
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		onSuccess: (_, { wordId }) => {
			queryClient.invalidateQueries({ queryKey: wordKeys.single(wordId) });
			queryClient.invalidateQueries({ queryKey: wordKeys.bySet(wordSetId) });
			queryClient.invalidateQueries({ queryKey: wordKeys.dashboard(wordSetId) });
			queryClient.invalidateQueries({ queryKey: wordSetKeys.all });
		},
	});
};

// AI補完のキック（チャット文脈つき再補完 POST /:wordId/complete）
// targets省略時は空欄のみ補完、targets指定時はその欄だけ上書き再生成
export const useCompleteWord = (wordSetId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ wordId, data }: { wordId: string; data: CompleteWordReq }) => {
			const res = await client.api.v1.sets[":setId"].words[":wordId"].complete.$post({
				param: { setId: wordSetId, wordId },
				json: data,
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		onSuccess: (_, { wordId }) => {
			// pending表示に切り替わるよう即時再取得（一覧のポーリングが引き継ぐ）
			queryClient.invalidateQueries({ queryKey: wordKeys.single(wordId) });
			queryClient.invalidateQueries({ queryKey: wordKeys.bySet(wordSetId) });
		},
	});
};

// 単語削除
export const useDeleteWord = (wordSetId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (wordId: string) => {
			const res = await client.api.v1.sets[":setId"].words[":wordId"].$delete({
				param: { setId: wordSetId, wordId },
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: wordKeys.bySet(wordSetId) });
			queryClient.invalidateQueries({ queryKey: wordKeys.dashboard(wordSetId) });
			queryClient.invalidateQueries({ queryKey: wordSetKeys.all });
		},
	});
};

// WordSet作成
export const useCreateWordSet = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateWordSetReq) => {
			const res = await client.api.v1.sets.$post({ json: data });
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: wordSetKeys.all });
		},
	});
};

// WordSet更新
export const useUpdateWordSet = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ setId, data }: { setId: string; data: UpdateWordSetReq }) => {
			const res = await client.api.v1.sets[":setId"].$put({
				param: { setId },
				json: data,
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: wordSetKeys.all });
		},
	});
};

// WordSet削除
export const useDeleteWordSet = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (setId: string) => {
			const res = await client.api.v1.sets[":setId"].$delete({
				param: { setId },
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: wordSetKeys.all });
		},
	});
};

