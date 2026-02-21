import { useQuery } from "@tanstack/react-query";
import { client } from "~/lib/api-client";

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


// 全単語の取得
export const useWords = (enabled = true) =>
	useQuery({
		queryKey: wordKeys.all,
		queryFn: async () => {
			const res = await client.api.words.$get();
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled,
	});
// セットごとに単語取得
export const useWordsBySet = (wordSetId: string, enabled = true) =>
	useQuery({
		queryKey: wordKeys.bySet(wordSetId),
		queryFn: async () => {
			const res = await client.api.words.wordSet[":wordSetId"].$get({
				param: { wordSetId },
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled: enabled && !!wordSetId,
	});
// 単語の単体取得
export const useWord = (wordId: string, enabled = true) =>
	useQuery({
		queryKey: wordKeys.single(wordId),
		queryFn: async () => {
			const res = await client.api.words[":wordId"].$get({
				param: { wordId },
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled: enabled && !!wordId,
	});
// ダッシュボード
export const useDashboard = (wordSetId: string, enabled = true) =>
	useQuery({
		queryKey: wordKeys.dashboard(wordSetId),
		queryFn: async () => {
			const res = await client.api.dashboard.summary.$get({
				query: { wordSetId },
			});
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			const data = await res.json();

			// Streakの計算
			let streak = 0;
			if (data.activityTimestamps && data.activityTimestamps.length > 0) {
				const activeDates = new Set<string>();
				data.activityTimestamps.forEach((ts) => {
					const d = new Date(ts);
					activeDates.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
				});

				const today = new Date();
				const yesterday = new Date(today);
				yesterday.setDate(yesterday.getDate() - 1);

				const formatDate = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

				let checkDate = new Date(today);

				if (activeDates.has(formatDate(today))) {
					streak = 1;
					checkDate.setDate(checkDate.getDate() - 1);
				} else if (activeDates.has(formatDate(yesterday))) {
					streak = 1;
					checkDate.setDate(yesterday.getDate() - 1);
				}

				if (streak > 0) {
					while (activeDates.has(formatDate(checkDate))) {
						streak++;
						checkDate.setDate(checkDate.getDate() - 1);
					}
				}
			}

			return { ...data, streak };
		},
		enabled: enabled && !!wordSetId,
	});

// wordSet一覧の取得
export const useWordSets = (enabled = true) =>
	useQuery({
		queryKey: wordSetKeys.all,
		queryFn: async () => {
			const res = await client.api.wordSets.$get();
			if (!res.ok) {
				const err = await res.json() as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled,
	});
