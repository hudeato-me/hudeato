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
			return res.json();
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
