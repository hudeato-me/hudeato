import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { BsX } from 'react-icons/bs'
import { useCardGesture, type CardGestureAction } from '~/hooks/cards/useCardGesture'
import { useTtsPlayer, useVoiceEnabled } from '~/hooks/use-tts'
import { haptic } from '~/lib/haptic'
import type { Card } from '~/types'
import { FlashCard } from './FlashCard'

// 送り出し（確定後に画面外へ抜ける）時間と、次カードの入場時間。
const EXIT_DURATION_MS = 260
const ENTER_DURATION = 0.3

interface CardDeckScreenProps {
    cards: Card[]
    currentIndex: number
    // 評価（右=覚えた / 左=もう一度）。カードを進めるのは親の責務。
    onEvaluate: (remembered: boolean) => void
    onEdit: (wordId: string) => void
    onQuit: () => void
}

// カード学習画面。表=言葉、タップで裏返して意味を見る。
// 右へスワイプ=覚えた / 左へスワイプ=もう一度 / 上へスワイプ=編集。
// 次のカードを1枚だけ奥に重ねて見せ、送り出しに奥行きを与える。
export function CardDeckScreen({
    cards,
    currentIndex,
    onEvaluate,
    onEdit,
    onQuit,
}: CardDeckScreenProps) {
    const { enabled: voiceEnabled } = useVoiceEnabled()
    const { play, stop } = useTtsPlayer()

    const card = cards[currentIndex]
    const nextCard = cards[currentIndex + 1]
    if (!card) return null

    const handleEvaluate = (remembered: boolean) => {
        stop()
        onEvaluate(remembered)
    }

    return (
        // 没入モードで消えた縦幅をこのコンテナ自体の高さで埋める（QuizPlayingScreen と同じ計算）。
        // 値を変える場合は _content.tsx の immersive 時 padding と同期させること。
        <div className="flex flex-col gap-5 min-h-[calc(100dvh_-_1.25rem_-_1rem)]">
            {/* ヘッダー: 閉じる + 進捗 */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            haptic('light')
                            stop()
                            onQuit()
                        }}
                        aria-label="単語帳をやめる"
                        className="h-12 w-12 rounded-full flex items-center justify-center bg-white/60 backdrop-blur-xl border border-black/[0.06] shadow-sm text-black/70 active:scale-90 transition"
                    >
                        <BsX className="h-6 w-6" />
                    </button>
                    <span className="text-[13px] text-black/40 tabular-nums">
                        {currentIndex + 1} / {cards.length}
                    </span>
                </div>
                <div className="h-1 w-full bg-black/[0.06] rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-black rounded-full"
                        initial={false}
                        animate={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    />
                </div>
            </div>

            {/* カード領域: 次のカードを奥に重ねる */}
            <div className="relative flex-1 min-h-[380px]">
                {nextCard && (
                    <div className="absolute inset-0 scale-[0.97] opacity-60">
                        <div className="h-full w-full rounded-[26px] border border-black/[0.06] bg-white shadow-[0_1px_10px_rgba(0,0,0,0.03)]" />
                    </div>
                )}
                <SwipeableCard
                    key={card.wordId}
                    card={card}
                    isFirstCard={currentIndex === 0}
                    voiceEnabled={voiceEnabled}
                    play={play}
                    onEvaluate={handleEvaluate}
                    onEdit={() => onEdit(card.wordId)}
                />
            </div>

            {/* 評価ボタン: スワイプが使えない環境（PC・キーボード操作）のための同等手段 */}
            <div className="flex items-center gap-3 pb-2">
                <button
                    type="button"
                    onClick={() => {
                        haptic('medium')
                        handleEvaluate(false)
                    }}
                    className="flex-1 h-13 rounded-full border border-black/10 bg-white text-[15px] text-black/70 active:scale-[0.98] transition-transform"
                >
                    ↺ もう一度
                </button>
                <button
                    type="button"
                    onClick={() => {
                        haptic('medium')
                        handleEvaluate(true)
                    }}
                    className="flex-1 h-13 rounded-full bg-black text-white text-[15px] font-medium active:scale-[0.98] transition-transform"
                >
                    ✓ 覚えた
                </button>
            </div>
        </div>
    )
}

// 1枚のカード。ジェスチャ（左右=評価 / 上=編集 / タップ=反転）と表示時の自動再生を担う。
// card ごとに key を付け替えて remount するため、反転状態も自動再生も自然にリセットされる。
function SwipeableCard({
    card,
    isFirstCard,
    voiceEnabled,
    play,
    onEvaluate,
    onEdit,
}: {
    card: Card
    isFirstCard: boolean
    voiceEnabled: boolean
    play: (text: string, lang: 'en' | 'ja') => Promise<void>
    onEvaluate: (remembered: boolean) => void
    onEdit: () => void
}) {
    const [flipped, setFlipped] = useState(false)
    // 入場アニメーションが済んだか（ドラッグ追従の transition と混ざらないよう分ける）
    const [entered, setEntered] = useState(false)

    const gesture = useCardGesture({
        exitDurationMs: EXIT_DURATION_MS,
        onCommit: (action) => haptic(action === 'edit' ? 'light' : 'medium'),
        onAction: (action: CardGestureAction) => {
            if (action === 'edit') {
                onEdit()
                return
            }
            onEvaluate(action === 'known')
        },
        onTap: () => {
            haptic('light')
            setFlipped((value) => !value)
        },
    })

    // 入場アニメーション完了後にドラッグ追従へ切り替える
    useEffect(() => {
        const timer = setTimeout(() => setEntered(true), ENTER_DURATION * 1000)
        return () => clearTimeout(timer)
    }, [])

    // 確定後の退出タイマーはアンマウント時に必ず破棄する
    useEffect(() => {
        return () => gesture.dispose()
        // dispose は ref だけを触るため、マウント時の1回でよい
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useAutoPlay(card.text, voiceEnabled, play)

    const { offset, rotate, exiting } = gesture
    // 確定したらドラッグ方向へ画面外まで抜ける（回転はドラッグ時の向きを維持しつつ少し増やす）
    const exitX = exiting === 'known' ? 520 : exiting === 'again' ? -520 : 0

    return (
        <>
            {/* 評価ラベル: カードの背後・静かな位置に出す（斜めのスタンプにはしない） */}
            <div className="pointer-events-none absolute inset-x-0 top-5 z-10 flex items-center justify-between px-5">
                <span
                    className="text-[13px] font-medium tracking-wide text-black/60"
                    style={{ opacity: gesture.againOpacity }}
                >
                    ↺ もう一度
                </span>
                <span
                    className="text-[13px] font-medium tracking-wide text-black/80"
                    style={{ opacity: gesture.knownOpacity }}
                >
                    ✓ 覚えた
                </span>
            </div>
            <div
                className="pointer-events-none absolute inset-x-0 top-5 z-10 flex justify-center"
                style={{ opacity: gesture.editOpacity }}
            >
                <span className="text-[13px] font-medium tracking-wide text-black/70">✎ 編集</span>
            </div>

            <motion.div
                {...gesture.handlers}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={
                    exiting
                        ? {
                              opacity: 0,
                              x: exitX,
                              y: offset.y,
                              rotate: rotate * 1.25,
                              scale: 1,
                          }
                        : {
                              opacity: 1,
                              x: offset.x,
                              y: offset.y,
                              rotate,
                              scale: 1,
                          }
                }
                transition={
                    !entered
                        ? // 入場: 少し下・奥から静かに立ち上がる
                          { duration: ENTER_DURATION, ease: [0.4, 0, 0.2, 1] }
                        : exiting
                          ? { duration: EXIT_DURATION_MS / 1000, ease: [0.4, 0, 1, 1] }
                          : offset.x === 0 && offset.y === 0
                            ? // 指を離して戻るとき: 重みのあるカードが所定位置に収まる感触（跳ね返りは小さく）
                              { type: 'spring', stiffness: 320, damping: 34 }
                            : // ドラッグ追従中は補間を挟まず指に張り付かせる
                              { duration: 0, ease: 'linear' }
                }
                style={{ touchAction: 'none' }}
                className="absolute inset-0 cursor-pointer"
            >
                <FlashCard
                    card={card}
                    flipped={flipped}
                    play={play}
                    onEdit={onEdit}
                    showHint={isFirstCard}
                />
            </motion.div>
        </>
    )
}

// 表示時に1回だけ自動再生する。カードごとに SwipeableCard が remount されるため、
// マウント時の1回だけでよい（学習中にトグルを切り替えても、いま見ているカードは再生し直さない）。
function useAutoPlay(
    text: string,
    voiceEnabled: boolean,
    play: (text: string, lang: 'en' | 'ja') => Promise<void>,
) {
    useEffect(() => {
        if (!voiceEnabled) return
        void play(text, 'en')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
}
