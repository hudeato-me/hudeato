import { createFileRoute } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { CardConfigScreen } from '~/components/cards/CardConfigScreen'
import { CardDeckScreen } from '~/components/cards/CardDeckScreen'
import { CardResultScreen } from '~/components/cards/CardResultScreen'
import { WordEntryDrawer } from '~/components/WordEntryDrawer'
import { useCardDeck, useInvalidateAfterCards, useSwipeCard } from '~/hooks/use-cards'
import { useContentContext } from '~/lib/content-context'
import { haptic } from '~/lib/haptic'
import type { Card, CardScope } from '~/types'

export const Route = createFileRoute('/_content/cards')({
    ssr: false,
    component: CardsPage,
})

// 1ルート内ステートマシン（config → playing → result）。URLには載せない（quiz.tsx と同じ流儀）。
type CardPhase = 'config' | 'playing' | 'result'

function CardsPage() {
    const { selectedWordSetId, setImmersive } = useContentContext()
    const invalidateAfterCards = useInvalidateAfterCards()

    const [phase, setPhase] = useState<CardPhase>('config')
    const [scope, setScope] = useState<CardScope>('all')
    // 「始める」を押してからデッキを取りに行く（開始画面を開いただけでは取得しない）
    const [isDeckRequested, setIsDeckRequested] = useState(false)

    // 学習中のデッキ。取得結果をこのstateに固定し、楽観更新やキャッシュの
    // 無効化で手元のカードが入れ替わらないようにする。
    const [deck, setDeck] = useState<Card[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    // 「もう一度」と評価したカード（結果画面からの復習に使う）
    const [againCards, setAgainCards] = useState<Card[]>([])
    const [rememberedCount, setRememberedCount] = useState(0)
    const [emptyState, setEmptyState] = useState<CardScope | null>(null)

    // 裏面から開く編集ドロワー
    const [editingWordId, setEditingWordId] = useState<string | null>(null)

    const {
        data: deckData,
        isFetching,
        isError,
    } = useCardDeck(selectedWordSetId ?? '', scope, isDeckRequested && !!selectedWordSetId)
    const { mutate: swipeCard } = useSwipeCard(selectedWordSetId ?? '', scope)

    // playingフェーズの間だけHeader/Footerを退場させる（没入モード）。
    // フェーズが変わった瞬間・アンマウント時には必ずOFFに戻す（クリーンアップ漏れ厳禁）。
    useEffect(() => {
        setImmersive(phase === 'playing')
        return () => setImmersive(false)
    }, [phase, setImmersive])

    // デッキが届いたら学習を開始する。0件なら開始画面のまま丁寧な空状態を出す。
    useEffect(() => {
        if (!isDeckRequested || !deckData) return
        setIsDeckRequested(false)

        if (deckData.cards.length === 0) {
            setEmptyState(deckData.scope)
            setPhase('config')
            return
        }
        startSession(deckData.cards)
        // deckData の到着だけをトリガーにする
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deckData, isDeckRequested])

    const startSession = (cards: Card[]) => {
        setDeck(cards)
        setCurrentIndex(0)
        setAgainCards([])
        setRememberedCount(0)
        setPhase('playing')
    }

    // デッキ取得をキックする。開始画面の「始める」・空状態からの切り替え・
    // 結果画面の「もう一周する」から共通で呼ばれる。
    const requestDeck = (targetScope: CardScope) => {
        if (!selectedWordSetId) return
        haptic('medium')
        setScope(targetScope)
        setEmptyState(null)
        setIsDeckRequested(true)
    }

    // 1枚評価したときの処理。記録はバックグラウンドに投げ、画面は待たせない。
    const handleEvaluate = (remembered: boolean) => {
        const card = deck[currentIndex]
        if (!card) return

        swipeCard({ wordId: card.wordId, remembered })

        if (remembered) {
            setRememberedCount((count) => count + 1)
        } else {
            setAgainCards((cards) => [...cards, card])
        }

        if (currentIndex + 1 < deck.length) {
            setCurrentIndex((index) => index + 1)
            return
        }

        // セッション終了: isRemembered/isMastered が変わるため一覧・ダッシュボードを更新
        if (selectedWordSetId) invalidateAfterCards(selectedWordSetId)
        setPhase('result')
    }

    const handleQuit = () => {
        haptic('light')
        if (selectedWordSetId) invalidateAfterCards(selectedWordSetId)
        setPhase('config')
    }

    // 結果画面から「もう一度」のカードだけを再学習する（APIは呼ばず手元のカードを使う）
    const handleReviewAgain = () => {
        haptic('medium')
        startSession(againCards)
    }

    if (!selectedWordSetId) {
        return (
            <div className="pt-24 text-center">
                <p className="text-sm text-black/45">単語セットを追加してください</p>
            </div>
        )
    }

    return (
        <>
            <AnimatePresence mode="wait">
                {phase === 'config' && (
                    <PhaseTransition key="config">
                        <CardConfigScreen
                            scope={scope}
                            onScopeChange={(value) => {
                                setScope(value)
                                setEmptyState(null)
                            }}
                            onStart={() => requestDeck(scope)}
                            isLoading={isFetching}
                            emptyState={emptyState}
                            onSwitchToAll={() => requestDeck('all')}
                            hasError={isError}
                        />
                    </PhaseTransition>
                )}
                {phase === 'playing' && (
                    <PhaseTransition key="playing">
                        <CardDeckScreen
                            cards={deck}
                            currentIndex={currentIndex}
                            onEvaluate={handleEvaluate}
                            onEdit={setEditingWordId}
                            onQuit={handleQuit}
                        />
                    </PhaseTransition>
                )}
                {phase === 'result' && (
                    <PhaseTransition key="result">
                        <CardResultScreen
                            rememberedCount={rememberedCount}
                            totalCount={deck.length}
                            onRestart={() => requestDeck(scope)}
                            onReviewAgain={againCards.length > 0 ? handleReviewAgain : null}
                            onQuit={() => {
                                haptic('light')
                                setPhase('config')
                            }}
                            isLoading={isFetching}
                        />
                    </PhaseTransition>
                )}
            </AnimatePresence>

            <WordEntryDrawer
                isOpen={editingWordId !== null}
                onClose={() => {
                    setEditingWordId(null)
                    // 編集内容をカードに反映するためデッキを取り直す（同じカードに留まる）
                    if (selectedWordSetId) invalidateAfterCards(selectedWordSetId)
                }}
                wordSetId={selectedWordSetId}
                existingWordId={editingWordId}
            />
        </>
    )
}

// フェーズ切り替え時のトランジション（quiz.tsx と同じトーン）
function PhaseTransition({ children }: { children: ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
            {children}
        </motion.div>
    )
}
