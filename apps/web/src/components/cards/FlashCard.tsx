import { motion, type MotionValue } from 'motion/react'
import { BsVolumeUp, BsVolumeMute } from 'react-icons/bs'
import type { Card, CardDirection } from '~/types'

// 反転アニメーション。タップ後に自動で180度回転する（ドラッグ追従はしない）。
// 直線的すぎない、少し慣性のあるSpring。大きくバウンドはさせない。
const FLIP_TRANSITION = {
    duration: 0.6,
    type: 'spring',
    stiffness: 260,
    damping: 20,
} as const

interface FlashCardProps {
    card: Card
    direction: CardDirection
    flipped: boolean
    onFlip: () => void
    // ドラッグ中は本文を隠し、方向ラベル（オーバーレイ）に置き換える
    contentOpacity: MotionValue<number>
    frontAudioEnabled: boolean
    backAudioEnabled: boolean
    onToggleFrontAudio: () => void
    onToggleBackAudio: () => void
}

// 表に出すテキスト。出題方向で単語と意味が入れ替わる。
// 意味が複数ある場合は全て並べる（登録済みの語義をカードで取りこぼさないため）。
export const frontTextsOf = (card: Card, direction: CardDirection): string[] =>
    direction === 'wordToMeaning'
        ? [card.text]
        : card.meanings.map((meaning) => meaning.meaning)

export const backTextsOf = (card: Card, direction: CardDirection): string[] =>
    direction === 'wordToMeaning'
        ? card.meanings.map((meaning) => meaning.meaning)
        : [card.text]

// 読み上げ対象。複数意味のときは先頭の意味だけを読む（全部読むと長すぎるため）。
export const speechTextOf = (
    card: Card,
    direction: CardDirection,
    face: 'front' | 'back',
) => (face === 'front' ? frontTextsOf : backTextsOf)(card, direction)[0] ?? ''

// カード1枚（表=言葉 / 裏=意味）。3D回転で反転し、表裏は同じ中心軸を共有する。
// 反転状態は親（デッキ）が持ち、このコンポーネントは見た目だけを担う。
export function FlashCard({
    card,
    direction,
    flipped,
    onFlip,
    contentOpacity,
    frontAudioEnabled,
    backAudioEnabled,
    onToggleFrontAudio,
    onToggleBackAudio,
}: FlashCardProps) {
    // 品詞は先頭の意味から拾う（無ければ行ごと省略する）
    const partOfSpeech = card.meanings[0]?.partOfSpeech?.trim() || null
    const frontTexts = frontTextsOf(card, direction)
    const backTexts = backTextsOf(card, direction)

    return (
        <motion.div
            onClick={onFlip}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={FLIP_TRANSITION}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative h-full w-full cursor-pointer"
        >
            {/* 表: 白 */}
            <div
                style={{ backfaceVisibility: 'hidden' }}
                aria-hidden={flipped}
                className="absolute inset-0 rounded-3xl bg-white border border-black/10 shadow-2xl shadow-black/10 p-6 md:p-8 flex flex-col items-center justify-center overflow-hidden"
            >
                <AudioToggle
                    enabled={frontAudioEnabled}
                    onToggle={onToggleFrontAudio}
                    tone="light"
                />
                <motion.div
                    style={{ opacity: contentOpacity }}
                    className="flex flex-col items-center justify-center gap-3 w-full min-h-0"
                >
                    {partOfSpeech && (
                        <p className="text-xs md:text-sm text-black/40">{partOfSpeech}</p>
                    )}
                    <div className="w-full max-w-full space-y-2 overflow-y-auto">
                        {frontTexts.map((text, index) => (
                            <p
                                key={index}
                                className={`text-center break-words max-w-full px-2 text-black ${
                                    index === 0
                                        ? 'text-2xl md:text-3xl lg:text-4xl'
                                        : 'text-xl md:text-2xl text-black/75'
                                }`}
                            >
                                {text}
                            </p>
                        ))}
                    </div>
                    <p className="text-xs md:text-sm text-black/30">タップして裏返す</p>
                </motion.div>
            </div>

            {/* 裏: 黒 */}
            <div
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                aria-hidden={!flipped}
                className="absolute inset-0 rounded-3xl bg-black text-white shadow-2xl shadow-black/10 p-6 md:p-8 flex flex-col items-center justify-center overflow-hidden"
            >
                <AudioToggle
                    enabled={backAudioEnabled}
                    onToggle={onToggleBackAudio}
                    tone="dark"
                />
                <motion.div
                    style={{ opacity: contentOpacity }}
                    className="flex flex-col items-center justify-center gap-3 w-full min-h-0"
                >
                    {partOfSpeech && (
                        <p className="text-xs md:text-sm text-white/60">{partOfSpeech}</p>
                    )}
                    <div className="w-full max-w-full space-y-3 overflow-y-auto">
                        {backTexts.map((text, index) => (
                            <p
                                key={index}
                                className={`text-center break-words max-w-full px-2 ${
                                    index === 0
                                        ? 'text-2xl md:text-3xl'
                                        : 'text-xl md:text-2xl text-white/75'
                                }`}
                            >
                                {text}
                            </p>
                        ))}
                    </div>
                    <p className="text-xs md:text-sm text-white/50">タップして裏返す</p>
                </motion.div>
            </div>
        </motion.div>
    )
}

// 音量ボタン。自動再生のON/OFFだけを担い、押してもカードの反転・ドラッグへ伝播させない。
function AudioToggle({
    enabled,
    onToggle,
    tone,
}: {
    enabled: boolean
    onToggle: () => void
    tone: 'light' | 'dark'
}) {
    return (
        <button
            type="button"
            aria-label={enabled ? '音声をオフにする' : '音声をオンにする'}
            aria-pressed={enabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
                event.stopPropagation()
                onToggle()
            }}
            className={`absolute top-4 right-4 h-10 w-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors active:scale-90 ${
                tone === 'light'
                    ? 'bg-black/[0.04] text-black/60'
                    : 'bg-white/15 text-white/80'
            }`}
        >
            {enabled ? <BsVolumeUp className="h-5 w-5" /> : <BsVolumeMute className="h-5 w-5" />}
        </button>
    )
}
