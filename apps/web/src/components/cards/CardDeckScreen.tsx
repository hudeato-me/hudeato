import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { BsX } from 'react-icons/bs'
import { useTtsPlayer, useVoiceEnabled } from '~/hooks/use-tts'
import { haptic } from '~/lib/haptic'
import type { Card } from '~/types'
import { FlashCard } from './FlashCard'

interface CardDeckScreenProps {
    cards: Card[]
    currentIndex: number
    // 評価（右=覚えた / 左=もう一度）。カードを進めるのは親の責務。
    onEvaluate: (remembered: boolean) => void
    onEdit: (wordId: string) => void
    onQuit: () => void
}

// カード学習画面。表=言葉、タップで裏返して意味を見る。
// 次のカードを1枚だけ奥に重ねて見せ、送り出しに奥行きを与える。
export function CardDeckScreen({
    cards,
    currentIndex,
    onEvaluate,
    onEdit,
    onQuit,
}: CardDeckScreenProps) {
    const [flipped, setFlipped] = useState(false)
    const { enabled: voiceEnabled } = useVoiceEnabled()
    const { play, stop } = useTtsPlayer()

    const card = cards[currentIndex]
    const nextCard = cards[currentIndex + 1]
    if (!card) return null

    const handleEvaluate = (remembered: boolean) => {
        haptic('medium')
        stop()
        setFlipped(false)
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
                <CardSurface
                    key={card.wordId}
                    card={card}
                    flipped={flipped}
                    isFirstCard={currentIndex === 0}
                    voiceEnabled={voiceEnabled}
                    play={play}
                    onFlip={() => {
                        haptic('light')
                        setFlipped((value) => !value)
                    }}
                    onEdit={() => onEdit(card.wordId)}
                />
            </div>

            {/* 評価ボタン: スワイプが使えない環境（PC・キーボード操作）のための同等手段 */}
            <div className="flex items-center gap-3 pb-2">
                <button
                    type="button"
                    onClick={() => handleEvaluate(false)}
                    className="flex-1 h-13 rounded-full border border-black/10 bg-white text-[15px] text-black/70 active:scale-[0.98] transition-transform"
                >
                    ↺ もう一度
                </button>
                <button
                    type="button"
                    onClick={() => handleEvaluate(true)}
                    className="flex-1 h-13 rounded-full bg-black text-white text-[15px] font-medium active:scale-[0.98] transition-transform"
                >
                    ✓ 覚えた
                </button>
            </div>
        </div>
    )
}

// 1枚のカード。表示時の自動再生と、タップでの反転を担う。
// card ごとに key を付け替えて remount することで、自動再生を毎カード1回だけ走らせる。
function CardSurface({
    card,
    flipped,
    isFirstCard,
    voiceEnabled,
    play,
    onFlip,
    onEdit,
}: {
    card: Card
    flipped: boolean
    isFirstCard: boolean
    voiceEnabled: boolean
    play: (text: string, lang: 'en' | 'ja') => Promise<void>
    onFlip: () => void
    onEdit: () => void
}) {
    // 表示と同時に表面の単語を読み上げる（トグルONのとき。クイズと同じ挙動）
    useAutoPlay(card.text, voiceEnabled, play)

    return (
        <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            onClick={onFlip}
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
    )
}

// 表示時に1回だけ自動再生する。カードごとに CardSurface が remount されるため、
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
