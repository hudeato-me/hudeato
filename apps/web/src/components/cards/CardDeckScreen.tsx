import {
    AnimatePresence,
    motion,
    useMotionValue,
    useTransform,
    type MotionValue,
} from 'motion/react'
import { useEffect, useState } from 'react'
import { BsX } from 'react-icons/bs'
import { useCardAudioEnabled, ttsLangForCardFace } from '~/hooks/cards/use-card-audio'
import { useTtsPlayer } from '~/hooks/use-tts'
import { haptic } from '~/lib/haptic'
import type { Card, CardDirection } from '~/types'
import { FlashCard, frontTextsOf, speechTextOf } from './FlashCard'

// スワイプ確定の閾値。カード幅の割合ではなく固定px（速度判定はしない）。
const HORIZONTAL_THRESHOLD = 100
const EDIT_THRESHOLD = -200
// 編集オーバーレイが見え始める位置と、左右ラベルを消す位置
const EDIT_LABEL_START = -150
// ドラッグ量がこれを超えたら本文を隠し、方向ラベルに置き換える
const CONTENT_HIDE_DISTANCE = 10
// 表面の自動再生は、カード切替アニメーションを滑らかに見せるため少し遅らせる
const FRONT_AUDIO_DELAY_MS = 300

interface CardDeckScreenProps {
    cards: Card[]
    currentIndex: number
    direction: CardDirection
    onDirectionChange: (direction: CardDirection) => void
    // 評価（右=知っている / 左=まだ学習中）。カードを進めるのは親の責務。
    onEvaluate: (remembered: boolean) => void
    onEdit: (wordId: string) => void
    onQuit: () => void
    masteredCount: number
    unstudiedCount: number
    completedCount: number
    // 編集ドロワー表示中などは操作を止める
    disabled?: boolean
}

// カード学習画面。
// タップ=反転 / 右=知っている / 左=まだ学習中 / 上=編集（上方向の判定を最優先）。
export function CardDeckScreen({
    cards,
    currentIndex,
    direction,
    onDirectionChange,
    onEvaluate,
    onEdit,
    onQuit,
    masteredCount,
    unstudiedCount,
    completedCount,
    disabled = false,
}: CardDeckScreenProps) {
    const { play, stop } = useTtsPlayer()
    const card = cards[currentIndex]
    if (!card) return null

    return (
        // 没入モードで消えた縦幅をこのコンテナ自体の高さで埋める（QuizPlayingScreen と同じ計算）。
        // 値を変える場合は _content.tsx の immersive 時 padding と同期させること。
        <div className="flex flex-col min-h-[calc(100dvh_-_1.25rem_-_1rem)]">
            {/* 進捗バー: 右・左スワイプが確定したときだけ進む */}
            <div className="h-1 w-full bg-black/5 rounded-full overflow-hidden">
                <motion.div
                    className="h-full bg-black"
                    initial={false}
                    animate={{ width: `${(completedCount / cards.length) * 100}%` }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                />
            </div>

            {/* ヘッダー: 閉じる + 出題方向トグル */}
            <div className="flex items-center justify-between pt-4">
                <button
                    type="button"
                    onClick={() => {
                        haptic('light')
                        stop()
                        onQuit()
                    }}
                    aria-label="単語帳を閉じる"
                    className="h-10 w-10 rounded-full bg-white border border-black/10 shadow-sm flex items-center justify-center text-black/60 active:bg-black/5 transition"
                >
                    <BsX className="h-5 w-5" />
                </button>

                <div className="flex items-center rounded-full bg-white border border-black/10 shadow-sm p-1">
                    {(
                        [
                            { value: 'wordToMeaning', label: '語句 → 意味' },
                            { value: 'meaningToWord', label: '意味 → 語句' },
                        ] as const
                    ).map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                haptic('light')
                                stop()
                                onDirectionChange(option.value)
                            }}
                            className={`px-3.5 py-1.5 rounded-full text-[13px] transition-colors ${
                                direction === option.value
                                    ? 'bg-black text-white font-medium'
                                    : 'text-black/60'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* カード領域 */}
            <div className="flex-1 flex items-center justify-center py-6 min-h-0">
                <div className="w-full max-w-md h-[min(60vh,450px)]">
                    <AnimatePresence mode="wait">
                        <SwipeableCard
                            key={`${card.wordId}-${direction}`}
                            card={card}
                            direction={direction}
                            disabled={disabled}
                            play={play}
                            stop={stop}
                            onEvaluate={(remembered) => {
                                stop()
                                onEvaluate(remembered)
                            }}
                            onEdit={() => {
                                // 編集ドロワーの裏で再生が続かないよう、評価・終了と同じく止める
                                stop()
                                onEdit(card.wordId)
                            }}
                        />
                    </AnimatePresence>
                </div>
            </div>

            {/* カウンター: 左=まだ学習中 / 中央=進捗 / 右=知っている */}
            <div className="flex items-center justify-between pb-6">
                <div className="h-12 w-12 rounded-full bg-orange-500/20 border-2 border-orange-500 flex items-center justify-center text-orange-600 tabular-nums">
                    {unstudiedCount}
                </div>
                <span className="text-black/60 font-medium tabular-nums pointer-events-none">
                    {completedCount} / {cards.length}
                </span>
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 tabular-nums">
                    {masteredCount}
                </div>
            </div>
        </div>
    )
}

// 1枚のカード。ドラッグ・オーバーレイ・自動再生を担う。
// card / direction ごとに key を付け替えて remount するため、反転状態も再生も自然にリセットされる。
function SwipeableCard({
    card,
    direction,
    disabled,
    play,
    stop,
    onEvaluate,
    onEdit,
}: {
    card: Card
    direction: CardDirection
    disabled: boolean
    play: (text: string, lang: 'en' | 'ja') => Promise<void>
    stop: () => void
    onEvaluate: (remembered: boolean) => void
    onEdit: () => void
}) {
    const [flipped, setFlipped] = useState(false)
    // 全文シートを開いている間はカードのドラッグ・反転を止める
    const [isFullTextOpen, setIsFullTextOpen] = useState(false)
    const { enabled: audioEnabled, toggle: toggleAudio } = useCardAudioEnabled()

    // OFFにした瞬間は再生中の音声を止め、ONにした瞬間は今見ている面をすぐ読み上げる
    // （ONにしたのに次のカードまで何も鳴らない、という空振りを避ける）
    const handleToggleAudio = () => {
        haptic('light')
        if (audioEnabled) {
            stop()
        } else {
            const face = flipped ? 'back' : 'front'
            void play(speechTextOf(card, direction, face), ttsLangForCardFace(direction, face))
        }
        toggleAudio()
    }

    const x = useMotionValue(0)
    const y = useMotionValue(0)

    // 横ドラッグに応じた平面回転（±200px で ±15deg）
    const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15])
    // 少しでも動かしたら本文を隠し、方向ラベルに置き換える
    const contentOpacity = useTransform([x, y], ([dx, dy]: number[]): number =>
        Math.abs(dx) > CONTENT_HIDE_DISTANCE || Math.abs(dy) > CONTENT_HIDE_DISTANCE ? 0 : 1,
    )
    // 左右ラベルの濃さ（0 → 0.8 で頭打ち）。上方向へ強く引いている間は消す。
    const knownOpacity = useTransform([x, y], ([dx, dy]: number[]): number =>
        dy < EDIT_LABEL_START ? 0 : Math.min(0.8, Math.max(0, dx) / HORIZONTAL_THRESHOLD * 0.8),
    )
    const againOpacity = useTransform([x, y], ([dx, dy]: number[]): number =>
        dy < EDIT_LABEL_START ? 0 : Math.min(0.8, Math.max(0, -dx) / HORIZONTAL_THRESHOLD * 0.8),
    )
    // 編集ラベルは -150px から現れ、-200px（確定位置）で 0.3、-300px で 0.8
    const editOpacity = useTransform(y, [-300, -200, EDIT_LABEL_START, 0], [0.8, 0.3, 0, 0])

    // 表面: カードが変わったら少し遅らせて自動再生する
    useEffect(() => {
        if (!audioEnabled) return
        const timer = setTimeout(() => {
            void play(speechTextOf(card, direction, 'front'), ttsLangForCardFace(direction, 'front'))
        }, FRONT_AUDIO_DELAY_MS)
        return () => clearTimeout(timer)
        // card/direction ごとに remount されるため、マウント時の1回でよい
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // 裏面: 反転した瞬間に再生する（遅延なし）
    useEffect(() => {
        if (!flipped || !audioEnabled) return
        void play(speechTextOf(card, direction, 'back'), ttsLangForCardFace(direction, 'back'))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flipped])

    // 画面を離れるときは再生を止める
    useEffect(() => stop, [stop])

    const handleDragEnd = (_event: unknown, info: { offset: { x: number; y: number } }) => {
        const { offset } = info
        // 上方向の判定を最優先する（斜め上でも編集になる）
        if (offset.y < EDIT_THRESHOLD) {
            haptic('light')
            onEdit()
            return
        }
        if (offset.x > HORIZONTAL_THRESHOLD) {
            haptic('medium')
            onEvaluate(true)
            return
        }
        if (offset.x < -HORIZONTAL_THRESHOLD) {
            haptic('medium')
            onEvaluate(false)
        }
    }

    const frontText = frontTextsOf(card, direction)[0] ?? ''

    return (
        <motion.div
            drag={!disabled && !isFullTextOpen}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            style={{ x, y, rotate }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, x: 0, y: 0, rotate: 0 }}
            exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative h-full w-full"
        >
            <FlashCard
                card={card}
                direction={direction}
                flipped={flipped}
                onFlip={() => {
                    if (isFullTextOpen) return
                    haptic('light')
                    setFlipped((value) => !value)
                }}
                contentOpacity={contentOpacity}
                audioEnabled={audioEnabled}
                onToggleAudio={handleToggleAudio}
                onFullTextOpenChange={setIsFullTextOpen}
            />

            {/* ドラッグ中の方向ラベル。本文と入れ替わりで見える */}
            <SwipeOverlay
                opacity={againOpacity}
                label="まだ学習中です"
                text={frontText}
                tone="orange"
            />
            <SwipeOverlay
                opacity={knownOpacity}
                label="知っている"
                text={frontText}
                tone="emerald"
            />
            {/* 編集は左右より前面に出す */}
            <SwipeOverlay
                opacity={editOpacity}
                label="単語を編集する"
                text={card.text}
                tone="blue"
                front
            />
        </motion.div>
    )
}

const OVERLAY_TONES = {
    orange: 'bg-orange-500/5 border-orange-500 text-orange-600',
    emerald: 'bg-emerald-500/5 border-emerald-500 text-emerald-600',
    blue: 'bg-blue-500/5 border-blue-500 text-blue-600',
} as const

// スワイプ方向を示すオーバーレイ。カード全面に重なり、濃さはドラッグ量に連動する。
function SwipeOverlay({
    opacity,
    label,
    text,
    tone,
    front = false,
}: {
    opacity: MotionValue<number>
    label: string
    text: string
    tone: keyof typeof OVERLAY_TONES
    front?: boolean
}) {
    return (
        <motion.div
            style={{ opacity }}
            aria-hidden
            className={`pointer-events-none absolute inset-0 rounded-3xl border-4 flex flex-col items-center justify-center gap-3 px-6 text-center ${
                OVERLAY_TONES[tone]
            } ${front ? 'z-20' : 'z-10'}`}
        >
            <p className="text-xl md:text-2xl font-medium">{label}</p>
            <p className="text-2xl md:text-3xl break-words max-w-full">{text}</p>
        </motion.div>
    )
}
