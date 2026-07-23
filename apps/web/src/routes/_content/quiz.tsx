import { createFileRoute } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { QuizConfigScreen } from '~/components/quiz/QuizConfigScreen'
import { QuizPlayingScreen } from '~/components/quiz/QuizPlayingScreen'
import { QuizResultScreen } from '~/components/quiz/QuizResultScreen'
import {
    useAnswerQuiz,
    useGenerateQuiz,
    useInvalidateWordsAfterQuiz,
    useQuizSessionDetail,
    useSaveQuizSession,
} from '~/hooks/use-quiz'
import { useContentContext } from '~/lib/content-context'
import { haptic } from '~/lib/haptic'
import type { QuizDirection, QuizQuestion, QuizScope, QuizSessionItem, QuizTimeLimit } from '~/types'

export const Route = createFileRoute('/_content/quiz')({
    ssr: false,
    component: QuizPage,
})

// 1ルート内ステートマシン（config → playing → result / history）。URLには載せない。
// history は過去セッションの結果を再表示するフェーズ（config画面の履歴カードから遷移）。
type QuizPhase = 'config' | 'playing' | 'result' | 'history'

function QuizPage() {
    const { selectedWordSetId } = useContentContext()
    const invalidateWordsAfterQuiz = useInvalidateWordsAfterQuiz()

    const [phase, setPhase] = useState<QuizPhase>('config')
    // 出題設定
    const [scope, setScope] = useState<QuizScope>('all')
    const [direction, setDirection] = useState<QuizDirection>('wordToMeaning')
    const [count, setCount] = useState(10)
    const [timeLimit, setTimeLimit] = useState<QuizTimeLimit>(20)
    // 直前の生成が0件だった場合の空状態、およびAPIエラー
    const [emptyState, setEmptyState] = useState<QuizScope | null>(null)
    const [hasGenerateError, setHasGenerateError] = useState(false)

    // 進行中のクイズ
    const [questions, setQuestions] = useState<QuizQuestion[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [answers, setAnswers] = useState<QuizSessionItem[]>([])

    // 履歴表示中のセッションID
    const [historySessionId, setHistorySessionId] = useState<string | null>(null)

    const { mutate: generateQuiz, isPending: isGenerating } = useGenerateQuiz()
    const { mutate: submitAnswer } = useAnswerQuiz(selectedWordSetId ?? '')
    const { mutate: saveQuizSession } = useSaveQuizSession(selectedWordSetId ?? '')
    const {
        data: historyDetail,
        isLoading: isHistoryLoading,
        isError: isHistoryError,
    } = useQuizSessionDetail(selectedWordSetId ?? '', historySessionId ?? '', phase === 'history' && !!historySessionId)

    // クイズ生成をキックする。config画面の「開始」・空状態からの「すべてから出題する」・
    // 結果画面の「次の問題に進む」の3箇所から共通で呼ばれる。
    const startQuiz = (targetScope: QuizScope) => {
        if (!selectedWordSetId) return
        haptic('medium')
        setScope(targetScope)
        setEmptyState(null)
        setHasGenerateError(false)
        generateQuiz(
            { wordSetId: selectedWordSetId, scope: targetScope, direction, count },
            {
                onSuccess: (data) => {
                    if (data.questions.length === 0) {
                        // 0件のときは開始画面のまま丁寧な空状態を出す
                        setEmptyState(targetScope)
                        setPhase('config')
                        return
                    }
                    setQuestions(data.questions)
                    setCurrentIndex(0)
                    setAnswers([])
                    setPhase('playing')
                },
                onError: (err) => {
                    console.error('クイズ生成に失敗しました:', err)
                    setHasGenerateError(true)
                    setPhase('config')
                },
            },
        )
    }

    // 結果画面の「同じ問題をやり直す」。APIは呼ばず、同じ questions のまま index/answers だけリセットする。
    const retrySameQuiz = () => {
        haptic('medium')
        setCurrentIndex(0)
        setAnswers([])
        setPhase('playing')
    }

    // 1問回答したときの処理。回答はバックグラウンドで送信し、画面は待たせない。
    const handleAnswer = (item: QuizSessionItem) => {
        submitAnswer(
            { wordId: item.wordId, meaningId: item.meaningId, correct: item.correct },
            { onError: (err) => console.error('クイズ回答の記録に失敗しました:', err) },
        )

        const updatedAnswers = [...answers, item]
        setAnswers(updatedAnswers)

        if (currentIndex + 1 < questions.length) {
            setCurrentIndex((i) => i + 1)
        } else {
            // セッション終了: isMastered/isRemembered が変わるため一覧・ダッシュボードを更新
            if (selectedWordSetId) invalidateWordsAfterQuiz(selectedWordSetId)
            // 結果画面到達時に1回だけセッションを保存する（失敗してもUXは止めない）
            saveQuizSession(
                { scope, direction, timeLimitSeconds: timeLimit, items: updatedAnswers },
                { onError: (err) => console.error('クイズセッションの保存に失敗しました:', err) },
            )
            setPhase('result')
        }
    }

    const handleQuit = () => {
        haptic('light')
        setPhase('config')
    }

    // 履歴カードタップ → 過去の結果画面を表示
    const handleSelectHistorySession = (sessionId: string) => {
        haptic('light')
        setHistorySessionId(sessionId)
        setPhase('history')
    }

    const handleBackFromHistory = () => {
        haptic('light')
        setHistorySessionId(null)
        setPhase('config')
    }

    if (!selectedWordSetId) {
        return (
            <div className="pt-24 text-center">
                <p className="text-sm text-black/45">単語セットを追加してください</p>
            </div>
        )
    }

    const currentQuestion = questions[currentIndex]

    return (
        <AnimatePresence mode="wait">
            {phase === 'config' && (
                <PhaseTransition key="config">
                    <QuizConfigScreen
                        wordSetId={selectedWordSetId}
                        scope={scope}
                        direction={direction}
                        count={count}
                        timeLimit={timeLimit}
                        onScopeChange={(value) => {
                            setScope(value)
                            setEmptyState(null)
                        }}
                        onDirectionChange={(value) => {
                            setDirection(value)
                            setEmptyState(null)
                        }}
                        onCountChange={(value) => {
                            setCount(value)
                            setEmptyState(null)
                        }}
                        onTimeLimitChange={setTimeLimit}
                        onStart={() => startQuiz(scope)}
                        isGenerating={isGenerating}
                        emptyState={emptyState}
                        onSwitchToAll={() => startQuiz('all')}
                        hasError={hasGenerateError}
                        onSelectHistorySession={handleSelectHistorySession}
                    />
                </PhaseTransition>
            )}
            {phase === 'playing' && currentQuestion && (
                <PhaseTransition key="playing">
                    <QuizPlayingScreen
                        question={currentQuestion}
                        currentIndex={currentIndex}
                        total={questions.length}
                        timeLimitSeconds={timeLimit}
                        direction={direction}
                        onAnswer={handleAnswer}
                        onQuit={handleQuit}
                    />
                </PhaseTransition>
            )}
            {phase === 'result' && (
                <PhaseTransition key="result">
                    <QuizResultScreen
                        wordSetId={selectedWordSetId}
                        items={answers}
                        footer={{
                            mode: 'live',
                            isGeneratingNext: isGenerating,
                            onNext: () => startQuiz(scope),
                            onRetrySame: retrySameQuiz,
                            onQuit: handleQuit,
                        }}
                    />
                </PhaseTransition>
            )}
            {phase === 'history' && (
                <PhaseTransition key="history">
                    {isHistoryError ? (
                        <div className="pt-24 text-center space-y-4">
                            <p className="text-sm text-black/45">履歴の読み込みに失敗しました</p>
                            <button
                                type="button"
                                onClick={handleBackFromHistory}
                                className="text-[13px] font-medium text-blue-500 active:opacity-60 transition-opacity"
                            >
                                戻る
                            </button>
                        </div>
                    ) : isHistoryLoading || !historyDetail ? (
                        <div className="pt-24 text-center">
                            <p className="text-sm text-black/45">読み込み中...</p>
                        </div>
                    ) : (
                        <QuizResultScreen
                            wordSetId={selectedWordSetId}
                            items={historyDetail.items}
                            footer={{ mode: 'history', onBack: handleBackFromHistory }}
                        />
                    )}
                </PhaseTransition>
            )}
        </AnimatePresence>
    )
}

// フェーズ切り替え時のトランジション。AnimatedOutlet と同じトーン（y:20→0 / exit y:-20, duration 0.25）
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
