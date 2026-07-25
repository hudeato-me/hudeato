import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "~/lib/api-client";
import { wordKeys } from "~/hooks/use-words";
import type { CardScope, CardSwipeReq, CardsResponse } from "~/types";

const CACHE_STALE_TIME = 5 * 60 * 1000;
// 1セッションで捌ける現実的な枚数（APIの既定値と揃える）
const DECK_LIMIT = 30;

// カードのクエリキー（use-quiz.ts の流儀に合わせたファクトリ）
export const cardKeys = {
	all: ["cards"] as const,
	deck: (wordSetId: string, scope: CardScope) =>
		["cards", "deck", wordSetId, scope] as const,
};

// カードデッキの取得。開始画面で範囲を選んでから取りに行くため、
// 明示的に enabled を渡して制御する（scope ごとにキャッシュを分ける）。
export const useCardDeck = (
	wordSetId: string,
	scope: CardScope,
	enabled: boolean,
) =>
	useQuery({
		queryKey: cardKeys.deck(wordSetId, scope),
		queryFn: async () => {
			const res = await client.api.v1.cards[":setId"].$get({
				param: { setId: wordSetId },
				query: { scope, limit: DECK_LIMIT },
			});
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		enabled: enabled && !!wordSetId,
		staleTime: CACHE_STALE_TIME,
	});

// スワイプ結果の記録。カードは指を離した瞬間に次へ進むため、記録はバックグラウンドで送る。
// デッキキャッシュ（表示中の isMastered/isRemembered）を楽観更新し、失敗したら元に戻す。
export const useSwipeCard = (wordSetId: string, scope: CardScope) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CardSwipeReq) => {
			const res = await client.api.v1.cards[":setId"].swipe.$post({
				param: { setId: wordSetId },
				json: data,
			});
			if (!res.ok) {
				const err = (await res.json()) as { error?: string };
				throw new Error(err.error ?? `API Error: ${res.status}`);
			}
			return res.json();
		},
		onMutate: async (data) => {
			const queryKey = cardKeys.deck(wordSetId, scope);
			const previous = queryClient.getQueryData<CardsResponse>(queryKey);
			if (!previous) return { previous };

			// 評価は単語単位なので、配下の全ての意味に同じ結果を当てる（サーバーと同じ導出）
			queryClient.setQueryData<CardsResponse>(queryKey, {
				...previous,
				cards: previous.cards.map((card) =>
					card.wordId === data.wordId
						? {
								...card,
								isMastered: data.remembered,
								meanings: card.meanings.map((meaning) => ({
									...meaning,
									isRemembered: data.remembered,
								})),
							}
						: card,
				),
			});
			return { previous };
		},
		onError: (_error, _data, context) => {
			if (context?.previous) {
				queryClient.setQueryData(
					cardKeys.deck(wordSetId, scope),
					context.previous,
				);
			}
		},
	});
};

// セッション終了時に呼ぶ無効化フック。isRemembered/isMastered がスワイプで変わるため、
// 一覧・ダッシュボード・もう一方の scope のデッキを更新する。
export const useInvalidateAfterCards = () => {
	const queryClient = useQueryClient();
	return (wordSetId: string) => {
		queryClient.invalidateQueries({ queryKey: wordKeys.bySet(wordSetId) });
		queryClient.invalidateQueries({ queryKey: wordKeys.dashboard(wordSetId) });
		queryClient.invalidateQueries({ queryKey: cardKeys.all });
	};
};
