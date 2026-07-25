import { motion } from 'motion/react'
import type { TtsLang } from '~/hooks/use-tts'
import { getImageUrl } from '~/hooks/use-image-upload'
import type { Card } from '~/types'
import { SpeakButton } from './SpeakButton'

// 反転アニメーション。派手なバネ挙動を避け、滑らかに減速する慣性のあるカーブにする。
export const FLIP_DURATION = 0.47
export const FLIP_EASE = [0.22, 0.61, 0.36, 1] as const

interface FlashCardProps {
    card: Card
    flipped: boolean
    play: (text: string, lang: TtsLang) => Promise<void>
    // 裏面から編集画面を開く（P3-5）。未指定なら編集ボタンを出さない。
    onEdit?: () => void
    // 初回だけスワイプヒントを濃く出す
    showHint: boolean
}

// カード1枚（表=言葉 / 裏=意味）。3D回転で反転し、表裏は同じ中心軸を共有する。
// 反転の状態は親（デッキ）が持ち、このコンポーネントは見た目だけを担う。
export function FlashCard({ card, flipped, play, onEdit, showHint }: FlashCardProps) {
    // 表面の補助情報は最初の意味（slot昇順の先頭）から拾う。無ければ行ごと省略する。
    const primary = card.meanings[0]
    const phonetic = primary?.phonetic?.trim() || null
    const partOfSpeech = primary?.partOfSpeech?.trim() || null

    return (
        <div className="h-full w-full [perspective:1400px]">
            <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: FLIP_DURATION, ease: FLIP_EASE }}
                className="relative h-full w-full [transform-style:preserve-3d]"
            >
                {/* 表: 言葉 */}
                <div
                    className="absolute inset-0 rounded-[26px] border border-black/[0.06] bg-white shadow-[0_2px_20px_rgba(0,0,0,0.05)] px-6 py-8 flex flex-col items-center justify-center [backface-visibility:hidden]"
                    aria-hidden={flipped}
                >
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0 w-full">
                        <p className="font-serif text-[2.1rem] leading-[1.25] font-medium text-black/90 text-center break-words max-w-full">
                            {card.text}
                        </p>
                        {(phonetic || partOfSpeech) && (
                            <p className="text-[13px] text-black/35 text-center">
                                {[phonetic, partOfSpeech].filter(Boolean).join('  ·  ')}
                            </p>
                        )}
                        <SpeakButton text={card.text} lang="en" play={play} />
                    </div>
                    <p
                        className={`text-[12px] text-center transition-opacity ${
                            showHint ? 'text-black/35' : 'text-black/20'
                        }`}
                    >
                        タップして意味を見る
                    </p>
                </div>

                {/* 裏: 意味（複数ある場合は並列に並べる） */}
                <div
                    className="absolute inset-0 rounded-[26px] border border-black/[0.06] bg-white shadow-[0_2px_20px_rgba(0,0,0,0.05)] flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)]"
                    aria-hidden={!flipped}
                >
                    {/* 上部: 単語（表より小さく。意味を主役にする） */}
                    <div className="px-6 pt-6 pb-4 flex items-center gap-3 border-b border-black/[0.05]">
                        <div className="min-w-0 flex-1">
                            <p className="font-serif text-[1.2rem] font-medium text-black/85 break-words">
                                {card.text}
                            </p>
                            {(phonetic || partOfSpeech) && (
                                <p className="text-[12px] text-black/35 mt-0.5">
                                    {[phonetic, partOfSpeech].filter(Boolean).join('  ·  ')}
                                </p>
                            )}
                        </div>
                        <SpeakButton text={card.text} lang="en" play={play} size="sm" />
                    </div>

                    {/* 中央: 意味・例文。情報が多い場合はカード内でスクロールさせる */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
                        {card.meanings.map((meaning, index) => (
                            <div key={meaning.id} className="space-y-2">
                                <div className="flex items-baseline gap-2">
                                    {card.meanings.length > 1 && (
                                        <span className="text-[11px] text-black/25 tabular-nums shrink-0 mt-1">
                                            {index + 1}
                                        </span>
                                    )}
                                    <p
                                        className={`leading-snug text-black/85 break-words ${
                                            index === 0 ? 'text-[1.3rem] font-medium' : 'text-[1.05rem]'
                                        }`}
                                    >
                                        {meaning.meaning}
                                    </p>
                                </div>
                                {meaning.example?.trim() && (
                                    <div className="flex items-start gap-2 pl-0.5">
                                        <p className="text-[13px] leading-relaxed text-black/45 break-words flex-1">
                                            {meaning.example}
                                        </p>
                                        <SpeakButton
                                            text={meaning.example}
                                            lang="ja"
                                            play={play}
                                            size="sm"
                                            label="例文を読み上げる"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* 補助情報: 覚えた場所・写真（あるときだけ） */}
                        {(card.locationLabel || card.imageKey) && (
                            <div className="pt-1 space-y-2">
                                {card.imageKey && (
                                    <img
                                        src={getImageUrl(card.imageKey)}
                                        alt=""
                                        loading="lazy"
                                        className="w-full max-h-36 object-cover rounded-[14px] border border-black/5"
                                    />
                                )}
                                {card.locationLabel && (
                                    <p className="text-[12px] text-black/35">{card.locationLabel}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 下部: 編集導線 */}
                    {onEdit && (
                        <div className="px-6 pb-5 pt-1">
                            <button
                                type="button"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onEdit()
                                }}
                                className="text-[13px] font-medium text-blue-500 active:opacity-60 transition-opacity"
                            >
                                編集する
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}
