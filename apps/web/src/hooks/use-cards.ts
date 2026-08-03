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

// デッキ取得の実処理。useQuery と、編集後の再取得（命令的な取得）で共有する。
const fetchCardDeck = async (
	wordSetId: string,
	scope: CardScope,
): Promise<CardsResponse> => {
	const res = await client.api.v1.cards[":setId"].$get({
		param: { setId: wordSetId },
		query: { scope, limit: DECK_LIMIT },
	});
	if (!res.ok) {
		const err = (await res.json()) as { error?: string };
		throw new Error(err.error ?? `API Error: ${res.status}`);
	}
	return res.json();
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
		queryFn: () => fetchCardDeck(wordSetId, scope),
		enabled: enabled && !!wordSetId,
		staleTime: CACHE_STALE_TIME,
	});

// 編集後に1枚分の最新内容を取り直すためのフック。
// 学習中のデッキは画面側の state に固定しているため、編集した単語だけを差し替える。
// 対象がデッキから消えていた場合（削除など）は null を返す。
export const useRefetchCard = (wordSetId: string, scope: CardScope) => {
	const queryClient = useQueryClient();
	return async (wordId: string) => {
		const fresh = await queryClient.fetchQuery({
			queryKey: cardKeys.deck(wordSetId, scope),
			queryFn: () => fetchCardDeck(wordSetId, scope),
			staleTime: 0,
		});
		return fresh.cards.find((card) => card.wordId === wordId) ?? null;
	};
};

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
			// 進行中の再取得が楽観更新のあとに解決して上書きするのを防ぐ
			await queryClient.cancelQueries({ queryKey });

			const previous = queryClient.getQueryData<CardsResponse>(queryKey);
			// ロールバック用に、この単語1件分の状態だけを控える。
			// スワイプは連続で投げられるため、スナップショット全体を書き戻すと
			// 後続の別カードの楽観更新まで巻き戻してしまう。
			const previousCard = previous?.cards.find(
				(card) => card.wordId === data.wordId,
			);
			if (!previous) return { previousCard };

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
			return { previousCard };
		},
		onError: (_error, _data, context) => {
			const previousCard = context?.previousCard;
			if (!previousCard) return;

			// 失敗した単語だけを元に戻す（他のカードの楽観更新はそのまま残す）
			queryClient.setQueryData<CardsResponse>(
				cardKeys.deck(wordSetId, scope),
				(current) =>
					current
						? {
								...current,
								cards: current.cards.map((card) =>
									card.wordId === previousCard.wordId ? previousCard : card,
								),
							}
						: current,
			);
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
