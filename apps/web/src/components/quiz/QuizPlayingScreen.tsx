import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BsVolumeUp } from 'react-icons/bs'
import { useSpeech } from '~/hooks/use-speech'
import { haptic } from '~/lib/haptic'
import type { QuizDirection, QuizQuestion, QuizSessionItem, QuizTimeLimit } from '~/types'

interface QuizPlayingScreenProps {
    question: QuizQuestion
    currentIndex: number
    total: number
    timeLimitSeconds: QuizTimeLimit
    // プロンプトの読み上げ言語切り替えに使う（wordToMeaning=英単語→en-US / meaningToWord=日本語の意味→ja-JP）
    direction: QuizDirection
    // 表示用レコード(QuizSessionItem)をそのまま親に渡す。時間切れは selectedText: null。
    onAnswer: (item: QuizSessionItem) => void
    onQuit: () => void
}

// 出題画面。選択肢タップで即時フィードバック（正解=green/不正解=red+シェイク）を出し、
// 約1秒後に次問へ進む。問題ごとに key を切り替えて AnimatePresence でカードを差し替える。
export function QuizPlayingScreen({
    question,
    currentIndex,
    total,
    timeLimitSeconds,
    direction,
    onAnswer,
    onQuit,
}: QuizPlayingScreenProps) {
    return (
        <div className="space-y-6">
            {/* ヘッダー: やめる導線 + プログレス */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            haptic('light')
                            onQuit()
                        }}
                        className="text-[13px] text-black/35 px-2 py-1 -ml-2 active:opacity-50 transition-opacity"
                    >
                        やめる
                    </button>
                    <span className="text-[13px] text-black/40 tabular-nums">
                        {currentIndex + 1} / {total}
                    </span>
                </div>
                <div className="h-1 w-full bg-black/[0.06] rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-black rounded-full"
                        initial={false}
                        animate={{ width: `${((currentIndex + 1) / total) * 100}%` }}
                        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    />
                </div>
            </div>

            <AnimatePresence mode="wait">
                <QuizQuestionCard
                    key={`${question.wordId}-${question.meaningId}`}
                    question={question}
                    timeLimitSeconds={timeLimitSeconds}
                    direction={direction}
                    onAnswer={onAnswer}
                />
            </AnimatePresence>
        </div>
    )
}

// 残り時間がこの割合を切ったらシークバーの色を赤系へ遷移させる（緊張感の演出）
const TIMER_DANGER_RATIO = 0.3

function QuizQuestionCard({
    question,
    timeLimitSeconds,
    direction,
    onAnswer,
}: {
    question: QuizQuestion
    timeLimitSeconds: QuizTimeLimit
    direction: QuizDirection
    onAnswer: (item: QuizSessionItem) => void
}) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [locked, setLocked] = useState(false)
    const [scope, animate] = useAnimate<HTMLDivElement>()
    // プロンプト読み上げ。unmount(次の問題への遷移)時はフック内部で必ずcancelされる
    const { speak, isSpeaking, isSupported: isSpeechSupported } = useSpeech()
    const speechLang = direction === 'wordToMeaning' ? 'en-US' : 'ja-JP'

    // タイムアウト判定はアニメーション(表示)に依存させず、マウント時に一度だけ張る
    // setTimeout（deadline方式）で行う。二重発火防止は ref で行い、state の再レンダリングを待たない。
    const answeredRef = useRef(false)
    const deadlineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const barControlsRef = useRef<ReturnType<typeof animate> | null>(null)

    // 正誤フィードバックを一拍(600ms)見せたあと、表示用レコードを組み立てて親に渡す
    // （テンポ優先で静止時間は最小限。アニメーション自体は速めない）。
    // タイマーは ref に保持し、フィードバック中に「やめる」等でアンマウントされた場合は
    // クリーンアップで破棄する（config に戻った後に回答記録が誤発火するのを防ぐ）
    const FEEDBACK_DELAY_MS = 600
    const submitAfterDelay = (selectedText: string | null, correct: boolean) => {
        feedbackTimeoutRef.current = setTimeout(() => {
            onAnswer({
                wordId: question.wordId,
                meaningId: question.meaningId,
                prompt: question.prompt,
                selectedText,
                correctText: question.choices[question.correctIndex],
                correct,
            })
        }, FEEDBACK_DELAY_MS)
    }

    const handleTimeout = () => {
        if (answeredRef.current) return
        answeredRef.current = true
        barControlsRef.current?.stop()
        setLocked(true)
        haptic('error')
        submitAfterDelay(null, false)
    }

    const handleSelect = (idx: number) => {
        if (answeredRef.current) return
        answeredRef.current = true
        if (deadlineTimeoutRef.current) clearTimeout(deadlineTimeoutRef.current)
        // 回答した瞬間にシークバーをその位置で止める（フィードバック表示中は進まない）
        barControlsRef.current?.stop()
        setLocked(true)
        setSelectedIndex(idx)
        const correct = idx === question.correctIndex
        haptic(correct ? 'success' : 'error')
        submitAfterDelay(question.choices[idx], correct)
    }

    useEffect(() => {
        if (scope.current) {
            // width は制限時間いっぱいをかけて100%→0%に一定速度で減らす。
            // backgroundColor だけ times を上書きし、残り30%(times: 0.7〜1)の間だけ
            // black/20→red に遷移させる（width と times を共有すると、backgroundColor に
            // 合わせて width の減少も残り30%まで足止めされてしまうため個別に指定する）。
            barControlsRef.current = animate(
                scope.current,
                {
                    width: ['100%', '0%'],
                    backgroundColor: ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.2)', '#ef4444'],
                },
                {
                    duration: timeLimitSeconds,
                    ease: 'linear',
                    backgroundColor: { times: [0, 1 - TIMER_DANGER_RATIO, 1] },
                },
            )
        }

        const deadline = Date.now() + timeLimitSeconds * 1000
        deadlineTimeoutRef.current = setTimeout(handleTimeout, Math.max(0, deadline - Date.now()))

        return () => {
            barControlsRef.current?.stop()
            if (deadlineTimeoutRef.current) clearTimeout(deadlineTimeoutRef.current)
            if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
        }
        // question(=key) ごとに QuizQuestionCard 自体が remount されるため、マウント時の1回だけでよい
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6"
        >
            {/* プロンプトカード: 長文の意味でも崩れないよう中央寄せ・可変高さ */}
            <div className="relative rounded-3xl border border-black/5 bg-black/[0.02] backdrop-blur-xl px-6 py-10 flex items-center justify-center text-center min-h-[140px]">
                {isSpeechSupported && (
                    <button
                        type="button"
                        onClick={() => {
                            haptic('light')
                            speak(question.prompt, speechLang)
                        }}
                        aria-label="発音を再生"
                        className={`absolute top-3 right-3 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                            isSpeaking ? 'text-blue-500' : 'text-black/30'
                        }`}
                    >
                        <BsVolumeUp className="h-5 w-5" />
                    </button>
                )}
                <p className="text-[1.35rem] leading-snug font-medium text-black/85 break-words">
                    {question.prompt}
                </p>
            </div>

            {/* 選択肢 */}
            <div className="space-y-3">
                {question.choices.map((choice, idx) => {
                    const isSelected = selectedIndex === idx
                    const isCorrectChoice = idx === question.correctIndex

                    let stateClass = 'bg-white border-black/5 text-black/80'
                    if (locked) {
                        if (isCorrectChoice) {
                            stateClass = 'bg-green-500/10 border-green-500/40 text-green-700'
                        } else if (isSelected) {
                            stateClass = 'bg-red-400/10 border-red-400/40 text-red-500'
                        } else {
                            stateClass = 'bg-white border-black/5 text-black/25'
                        }
                    }

                    const shouldShake = locked && isSelected && !isCorrectChoice

                    return (
                        <motion.button
                            key={idx}
                            type="button"
                            disabled={locked}
                            onClick={() => handleSelect(idx)}
                            animate={shouldShake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
                            transition={{ duration: 0.4 }}
                            className={`w-full rounded-[14px] border px-5 py-4 text-left text-[15px] leading-snug transition-colors ${stateClass} ${
                                locked ? '' : 'active:scale-[0.98]'
                            }`}
                        >
                            {choice}
                        </motion.button>
                    )
                })}
            </div>

            {/* 各問の制限時間シークバー。祖先(PhaseTransition/AnimatedOutlet)がtransformを持つため
                position:fixed が viewport ではなくその祖先に束縛されてしまう。
                ImagePicker のライトボックスと同じ理由で body 直下に Portal する。 */}
            {typeof document !== 'undefined' &&
                createPortal(
                    <div className="fixed left-1/2 -translate-x-1/2 bottom-[76px] w-[430px] max-w-[calc(100vw-16px)] px-3 z-40 pointer-events-none">
                        <div className="h-1.5 w-full bg-black/[0.06] rounded-full overflow-hidden">
                            <div
                                ref={scope}
                                className="h-full rounded-full"
                                style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)' }}
                            />
                        </div>
                    </div>,
                    document.body,
                )}
        </motion.div>
    )
}
