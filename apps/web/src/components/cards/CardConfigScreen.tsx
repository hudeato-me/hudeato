import { FilterTabs } from '~/components/FilterTabs'
import { QuizSpinner } from '~/components/quiz/QuizSpinner'
import type { CardScope } from '~/types'

interface CardConfigScreenProps {
    scope: CardScope
    onScopeChange: (scope: CardScope) => void
    onStart: () => void
    isLoading: boolean
    // デッキが0件だったときの丁寧な空状態（scopeごとに文言を出し分ける）
    emptyState: CardScope | null
    onSwitchToAll: () => void
    hasError: boolean
}

// 単語帳の開始画面。範囲を選んで大きなボタンで始める（設定は最小限に保つ）。
export function CardConfigScreen({
    scope,
    onScopeChange,
    onStart,
    isLoading,
    emptyState,
    onSwitchToAll,
    hasError,
}: CardConfigScreenProps) {
    return (
        <div className="space-y-8">
            <section className="space-y-3">
                <div className="text-sm text-black/50 px-1">出題範囲</div>
                <FilterTabs
                    options={[
                        { value: 'all' as const, label: 'すべて' },
                        { value: 'unmastered' as const, label: '未習得' },
                    ]}
                    value={scope}
                    onChange={onScopeChange}
                />
            </section>

            {emptyState === 'unmastered' && (
                <div className="rounded-[14px] bg-green-500/5 border border-green-500/20 p-4 text-center space-y-2">
                    <p className="text-[14px] text-green-700 leading-snug">
                        未習得の言葉はありません。ぜんぶ覚えています 🎉
                    </p>
                    <button
                        type="button"
                        onClick={onSwitchToAll}
                        className="text-[13px] font-medium text-blue-500 active:opacity-60 transition-opacity"
                    >
                        すべてのカードで復習する
                    </button>
                </div>
            )}
            {emptyState === 'all' && (
                <div className="rounded-[14px] bg-black/[0.03] border border-black/5 p-4 text-center">
                    <p className="text-[14px] text-black/50 leading-snug">
                        カードにする言葉がまだありません。まず言葉を登録してください
                    </p>
                </div>
            )}
            {hasError && (
                <div className="rounded-[14px] bg-red-400/5 border border-red-400/20 p-4 text-center">
                    <p className="text-[14px] text-red-500 leading-snug">
                        カードの取得に失敗しました。もう一度お試しください
                    </p>
                </div>
            )}

            <button
                type="button"
                disabled={isLoading}
                onClick={onStart}
                className="w-full h-14 rounded-full bg-black text-white text-[1rem] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
            >
                {isLoading ? (
                    <>
                        <QuizSpinner />
                        <span>カードを準備中...</span>
                    </>
                ) : (
                    '単語帳を始める'
                )}
            </button>
        </div>
    )
}
