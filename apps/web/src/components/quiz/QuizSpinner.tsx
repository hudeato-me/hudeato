// ボタン内で使う小さいスピナー。生成中の待ち時間を気持ちよく見せるための演出。
export function QuizSpinner({ className = '' }: { className?: string }) {
    return (
        <span
            className={`inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin ${className}`}
            aria-hidden="true"
        />
    )
}
