import { FilterTabs } from '~/components/FilterTabs'
import { QuizHistorySection } from './QuizHistorySection'
import { QuizSpinner } from './QuizSpinner'
import type { QuizDirection, QuizScope, QuizTimeLimit } from '~/types'

interface QuizConfigScreenProps {
    wordSetId: string
    scope: QuizScope
    direction: QuizDirection
    count: number
    timeLimit: QuizTimeLimit
    onScopeChange: (scope: QuizScope) => void
    onDirectionChange: (direction: QuizDirection) => void
    onCountChange: (count: number) => void
    onTimeLimitChange: (timeLimit: QuizTimeLimit) => void
    onStart: () => void
    isGenerating: boolean
    // 直前の生成結果が0件だった場合の丁寧な空状態（scopeごとに文言を出し分ける）
    emptyState: QuizScope | null
    onSwitchToAll: () => void
    // クイズ生成APIがエラーだった場合の丁寧なフィードバック
    hasError: boolean
    // 履歴カードタップ時（過去の結果画面を再表示する）
    onSelectHistorySession: (sessionId: string) => void
}

// クイズ開始画面。出題範囲・出題形式・問題数・制限時間を選び、大きな開始ボタンで生成をキックする。
export function QuizConfigScreen({
    wordSetId,
    scope,
    direction,
    count,
    timeLimit,
    onScopeChange,
    onDirectionChange,
    onCountChange,
    onTimeLimitChange,
    onStart,
    isGenerating,
    emptyState,
    onSwitchToAll,
    hasError,
    onSelectHistorySession,
}: QuizConfigScreenProps) {
    return (
        <div className="space-y-8">
            <section className="space-y-3">
                <div className="text-sm text-black/50 px-1">出題範囲</div>
                <FilterTabs
                    options={[
                        { value: 'all' as const, label: 'すべて' },
                        { value: 'unanswered' as const, label: '未正解' },
                    ]}
                    value={scope}
                    onChange={onScopeChange}
                />
            </section>

            <section className="space-y-3">
                <div className="text-sm text-black/50 px-1">出題形式</div>
                <FilterTabs
                    options={[
                        { value: 'wordToMeaning' as const, label: '単語 → 意味' },
                        { value: 'meaningToWord' as const, label: '意味 → 単語' },
                    ]}
                    value={direction}
                    onChange={onDirectionChange}
                />
            </section>

            <section className="space-y-3">
                <div className="text-sm text-black/50 px-1">問題数</div>
                <FilterTabs
                    options={[
                        { value: '5', label: '5問' },
                        { value: '10', label: '10問' },
                        { value: '20', label: '20問' },
                    ]}
                    value={String(count)}
                    onChange={(value) => onCountChange(Number(value))}
                />
            </section>

            <section className="space-y-3">
                <div className="text-sm text-black/50 px-1">制限時間</div>
                <FilterTabs
                    options={[
                        { value: '10', label: '10秒' },
                        { value: '20', label: '20秒' },
                        { value: '30', label: '30秒' },
                    ]}
                    value={String(timeLimit)}
                    onChange={(value) => onTimeLimitChange(Number(value) as QuizTimeLimit)}
                />
            </section>

            {emptyState === 'unanswered' && (
                <div className="rounded-[14px] bg-green-500/5 border border-green-500/20 p-4 text-center space-y-2">
                    <p className="text-[14px] text-green-700 leading-snug">
                        未正解の言葉はありません。ぜんぶ覚えています 🎉
                    </p>
                    <button
                        type="button"
                        onClick={onSwitchToAll}
                        className="text-[13px] font-medium text-blue-500 active:opacity-60 transition-opacity"
                    >
                        すべてから出題する
                    </button>
                </div>
            )}
            {emptyState === 'all' && (
                <div className="rounded-[14px] bg-black/[0.03] border border-black/5 p-4 text-center">
                    <p className="text-[14px] text-black/50 leading-snug">
                        クイズには言葉が4つ以上（意味入力済み）必要です
                    </p>
                </div>
            )}
            {hasError && (
                <div className="rounded-[14px] bg-red-400/5 border border-red-400/20 p-4 text-center">
                    <p className="text-[14px] text-red-500 leading-snug">
                        クイズの取得に失敗しました。もう一度お試しください
                    </p>
                </div>
            )}

            <button
                type="button"
                disabled={isGenerating}
                onClick={onStart}
                className="w-full h-14 rounded-full bg-black text-white text-[1rem] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
            >
                {isGenerating ? (
                    <>
                        <QuizSpinner />
                        <span>問題を作成中...</span>
                    </>
                ) : (
                    'クイズを始める'
                )}
            </button>

            <QuizHistorySection wordSetId={wordSetId} onSelect={onSelectHistorySession} />
        </div>
    )
}
