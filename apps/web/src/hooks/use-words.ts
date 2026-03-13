import { useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "~/lib/api-client";
const CACHE_STALE_TIME = 5 * 60 * 1000;
import { Word } from "~/types";

// クエリキーの管理
// 単語のクエリキー
export const wordKeys = {
	all: ["words"] as const,
	bySet: (wordSetId: string) => ["words", "set", wordSetId] as const,
	single: (wordId: string) => ["words", wordId] as const,
	dashboard: (wordSetId: string) => ["dashboard", wordSetId] as const,
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
		staleTime: 1000 * 60 * 60, // 1時間キャッシュ (永続化環境で一生更新されないのを防ぐ)
		enabled,
	});
