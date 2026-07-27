import { motion, type MotionValue } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { BsVolumeUp, BsVolumeMute } from 'react-icons/bs'
import { BottomSheet } from '~/components/BottomSheet'
import { haptic } from '~/lib/haptic'
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
    // 音声のON/OFFは表裏共通の1つの状態
    audioEnabled: boolean
    onToggleAudio: () => void
    // 全文シートの開閉を親へ伝える（開いている間はカードのジェスチャを止める）
    onFullTextOpenChange?: (open: boolean) => void
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
    audioEnabled,
    onToggleAudio,
    onFullTextOpenChange,
}: FlashCardProps) {
    // 品詞は先頭の意味から拾う（無ければ行ごと省略する）
    const partOfSpeech = card.meanings[0]?.partOfSpeech?.trim() || null
    const frontTexts = frontTextsOf(card, direction)
    const backTexts = backTextsOf(card, direction)

    // 全文シート。開いている面のテキストを渡す（null=閉じている）
    const [fullTexts, setFullTexts] = useState<string[] | null>(null)
    useEffect(() => {
        onFullTextOpenChange?.(fullTexts !== null)
    }, [fullTexts, onFullTextOpenChange])

    return (
        <>
            <motion.div
                onClick={onFlip}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={FLIP_TRANSITION}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative h-full w-full cursor-pointer"
            >
                {/* 表: 白 */}
                <CardFace tone="light" hidden={flipped}>
                    <AudioToggle enabled={audioEnabled} onToggle={onToggleAudio} tone="light" />
                    <motion.div
                        style={{ opacity: contentOpacity }}
                        className="flex flex-col items-center justify-center gap-3 w-full h-full min-h-0"
                    >
                        {partOfSpeech && (
                            <p className="shrink-0 text-xs md:text-sm text-black/40">{partOfSpeech}</p>
                        )}
                        <ClampedTexts
                            texts={frontTexts}
                            tone="light"
                            emphasizeFirst
                            onMore={() => setFullTexts(frontTexts)}
                        />
                        <p className="shrink-0 text-xs md:text-sm text-black/30">タップして裏返す</p>
                    </motion.div>
                </CardFace>

                {/* 裏: 黒 */}
                <CardFace tone="dark" hidden={!flipped}>
                    <AudioToggle enabled={audioEnabled} onToggle={onToggleAudio} tone="dark" />
                    <motion.div
                        style={{ opacity: contentOpacity }}
                        className="flex flex-col items-center justify-center gap-3 w-full h-full min-h-0"
                    >
                        {partOfSpeech && (
                            <p className="shrink-0 text-xs md:text-sm text-white/60">{partOfSpeech}</p>
                        )}
                        <ClampedTexts
                            texts={backTexts}
                            tone="dark"
                            onMore={() => setFullTexts(backTexts)}
                        />
                        <p className="shrink-0 text-xs md:text-sm text-white/50">タップして裏返す</p>
                    </motion.div>
                </CardFace>
            </motion.div>

            <FullTextSheet
                texts={fullTexts}
                partOfSpeech={partOfSpeech}
                onClose={() => setFullTexts(null)}
            />
        </>
    )
}

// カードの面。表裏で色だけが違う。
function CardFace({
    tone,
    hidden,
    children,
}: {
    tone: 'light' | 'dark'
    hidden: boolean
    children: ReactNode
}) {
    return (
        <div
            style={{
                backfaceVisibility: 'hidden',
                ...(tone === 'dark' ? { transform: 'rotateY(180deg)' } : {}),
            }}
            aria-hidden={hidden}
            className={`absolute inset-0 rounded-3xl shadow-2xl shadow-black/10 p-6 md:p-8 flex flex-col items-center justify-center overflow-hidden ${
                tone === 'light' ? 'bg-white border border-black/10' : 'bg-black text-white'
            }`}
        >
            {children}
        </div>
    )
}

// カード内に収まらない長文は、下部をグラデーションでフェードさせて「もっと見る」を出す。
// カード内スクロールにしないのは、スワイプ・タップのジェスチャと競合させないため。
function ClampedTexts({
    texts,
    tone,
    emphasizeFirst = false,
    onMore,
}: {
    texts: string[]
    tone: 'light' | 'dark'
    // 1件だけのとき（表の単語など）はさらに大きく見せる
    emphasizeFirst?: boolean
    onMore: () => void
}) {
    const isSingleLargeText = emphasizeFirst && texts.length === 1
    const containerRef = useRef<HTMLDivElement>(null)
    const [isOverflowing, setIsOverflowing] = useState(false)

    // 実際に溢れているかを測って初めてボタンを出す（短文では出さない）
    useLayoutEffect(() => {
        const element = containerRef.current
        if (!element) return

        const check = () => {
            setIsOverflowing(element.scrollHeight > element.clientHeight + 1)
        }
        check()

        const observer = new ResizeObserver(check)
        observer.observe(element)
        window.addEventListener('resize', check)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', check)
        }
    }, [texts])

    return (
        <div className="relative flex-1 min-h-0 w-full">
            <div
                ref={containerRef}
                className={`h-full w-full overflow-hidden space-y-2 flex flex-col ${
                    isOverflowing ? 'justify-start' : 'justify-center'
                }`}
            >
                {texts.map((text, index) => (
                    // 意味が複数あっても大きさ・濃さは揃える（どれも等しく覚える対象のため）
                    <p
                        key={index}
                        className={`text-center break-words max-w-full px-2 ${
                            tone === 'light' ? 'text-black' : 'text-white'
                        } ${isSingleLargeText ? 'text-2xl md:text-3xl lg:text-4xl' : 'text-2xl md:text-3xl'}`}
                    >
                        {text}
                    </p>
                ))}
            </div>

            {isOverflowing && (
                <>
                    {/* 下端をカード色へフェードさせ、続きがあることを示す */}
                    <div
                        aria-hidden
                        className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent ${
                            tone === 'light' ? 'from-white' : 'from-black'
                        }`}
                    />
                    <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.stopPropagation()
                            haptic('light')
                            onMore()
                        }}
                        className={`absolute inset-x-0 bottom-0 mx-auto w-fit px-4 py-1.5 text-[13px] font-medium active:opacity-60 transition-opacity ${
                            tone === 'light' ? 'text-blue-500' : 'text-blue-300'
                        }`}
                    >
                        もっと見る
                    </button>
                </>
            )}
        </div>
    )
}

// 全文を読むためのボトムシート。共通の BottomSheet（つまみ・下スワイプで閉じる）を使う。
function FullTextSheet({
    texts,
    partOfSpeech,
    onClose,
}: {
    texts: string[] | null
    partOfSpeech: string | null
    onClose: () => void
}) {
    const isOpen = texts !== null
    // 閉じるアニメーションの間も中身を保つ
    const [shownTexts, setShownTexts] = useState<string[]>([])
    useEffect(() => {
        if (texts) setShownTexts(texts)
    }, [texts])

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose}>
            <div className="px-6 pb-10 pt-2 space-y-4">
                {partOfSpeech && <p className="text-[13px] text-black/40">{partOfSpeech}</p>}
                {shownTexts.map((text, index) => (
                    <p key={index} className="text-[1.15rem] leading-relaxed text-black/85 break-words">
                        {text}
                    </p>
                ))}
            </div>
        </BottomSheet>
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
            className={`absolute top-4 right-4 z-10 h-10 w-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors active:scale-90 ${
                tone === 'light'
                    ? 'bg-black/[0.04] text-black/60'
                    : 'bg-white/15 text-white/80'
            }`}
        >
            {enabled ? <BsVolumeUp className="h-5 w-5" /> : <BsVolumeMute className="h-5 w-5" />}
        </button>
    )
}
