import { motion } from 'motion/react'
import { BsCheck } from 'react-icons/bs'

interface CardResultScreenProps {
    totalCount: number
    masteredCount: number
    onRestart: () => void
    isLoading: boolean
}

// 全カードを評価し終えたときの完了画面。
export function CardResultScreen({
    totalCount,
    masteredCount,
    onRestart,
    isLoading,
}: CardResultScreenProps) {
    return (
        <div className="min-h-[calc(100dvh_-_1.25rem_-_1rem)] flex flex-col items-center justify-center gap-6 px-6 text-center">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="h-20 w-20 rounded-full bg-green-500/10 border-4 border-green-500 flex items-center justify-center text-green-500"
            >
                <BsCheck className="h-10 w-10" />
            </motion.div>

            <div className="space-y-2">
                <p className="text-xl font-medium text-black/85">完了しました！</p>
                <p className="text-sm text-black/50">{totalCount}枚のカードを学習しました</p>
                <p className="text-sm text-black/50">覚えた: {masteredCount}枚</p>
            </div>

            <button
                type="button"
                disabled={isLoading}
                onClick={onRestart}
                className="h-13 px-8 rounded-full bg-black text-white text-[15px] font-medium active:scale-[0.98] transition-transform disabled:opacity-60"
            >
                {isLoading ? '準備中...' : 'もう一度'}
            </button>
        </div>
    )
}
