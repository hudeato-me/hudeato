import { motion } from 'motion/react'
import { FilterTabs } from '~/components/FilterTabs'
import { QuizSpinner } from '~/components/quiz/QuizSpinner'
import { useVoiceEnabled } from '~/hooks/use-tts'
import { haptic } from '~/lib/haptic'
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
    // 音声トグルはクイズと共有（学習機能全体で1つの状態）
    const { enabled: voiceEnabled, toggle: toggleVoice } = useVoiceEnabled()

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

            <section className="space-y-3">
                <div className="text-sm text-black/50 px-1">音声</div>
                <div className="w-full rounded-[14px] border border-black/5 bg-white px-4 py-3.5 flex items-center justify-between">
                    <span className="text-[15px] text-black/80">発音を自動再生</span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={voiceEnabled}
                        aria-label="発音を自動再生"
                        onClick={() => {
                            haptic('light')
                            toggleVoice()
                        }}
                        className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
                            voiceEnabled ? 'bg-black' : 'bg-black/15'
                        }`}
                    >
                        <motion.span
                            layout
                            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                            className="w-5 h-5 rounded-full bg-white shadow-sm"
                            style={{ marginLeft: voiceEnabled ? 'auto' : 0 }}
                        />
                    </button>
                </div>
            </section>

            {/* 操作の説明。初見でも迷わないよう、3方向のスワイプを静かに伝える */}
            <section className="rounded-[14px] bg-black/[0.02] border border-black/5 px-5 py-4 space-y-2">
                <p className="text-[13px] text-black/50">タップで意味を表示</p>
                <p className="text-[13px] text-black/50">右へスワイプ → 覚えた</p>
                <p className="text-[13px] text-black/50">左へスワイプ → もう一度</p>
                <p className="text-[13px] text-black/50">上へスワイプ → 編集</p>
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
