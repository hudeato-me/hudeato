import { motion } from 'motion/react'

interface CardResultScreenProps {
    // 「覚えた」と評価した枚数 / 全枚数
    rememberedCount: number
    totalCount: number
    // もう一度（同じ範囲で取り直す）
    onRestart: () => void
    // 「もう一度」と評価したカードだけをやり直す
    onReviewAgain: (() => void) | null
    onQuit: () => void
    isLoading: boolean
}

// カード学習の結果画面。数を淡々と見せ、次の一手だけを提示する。
export function CardResultScreen({
    rememberedCount,
    totalCount,
    onRestart,
    onReviewAgain,
    onQuit,
    isLoading,
}: CardResultScreenProps) {
    const againCount = totalCount - rememberedCount

    return (
        <div className="space-y-8 pt-6">
            <section className="text-center space-y-2">
                <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="text-[2.4rem] font-medium text-black/85 tabular-nums leading-none"
                >
                    {rememberedCount}
                    <span className="text-[1.2rem] text-black/30"> / {totalCount}</span>
                </motion.p>
                <p className="text-[14px] text-black/45">覚えたカード</p>
            </section>

            <section className="rounded-[14px] border border-black/5 bg-white divide-y divide-black/5">
                <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[15px] text-black/70">✓ 覚えた</span>
                    <span className="text-[15px] text-black/85 tabular-nums">{rememberedCount}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[15px] text-black/70">↺ もう一度</span>
                    <span className="text-[15px] text-black/85 tabular-nums">{againCount}</span>
                </div>
            </section>

            <section className="space-y-3">
                {onReviewAgain && (
                    <button
                        type="button"
                        onClick={onReviewAgain}
                        className="w-full h-14 rounded-full bg-black text-white text-[1rem] font-medium active:scale-[0.98] transition-transform"
                    >
                        「もう一度」の{againCount}枚を復習する
                    </button>
                )}
                <button
                    type="button"
                    disabled={isLoading}
                    onClick={onRestart}
                    className={`w-full h-14 rounded-full text-[1rem] font-medium active:scale-[0.98] transition-transform disabled:opacity-60 ${
                        onReviewAgain
                            ? 'border border-black/10 bg-white text-black/70'
                            : 'bg-black text-white'
                    }`}
                >
                    {isLoading ? 'カードを準備中...' : 'もう一周する'}
                </button>
                <button
                    type="button"
                    onClick={onQuit}
                    className="w-full h-12 text-[14px] text-black/45 active:opacity-60 transition-opacity"
                >
                    終わる
                </button>
            </section>
        </div>
    )
}
