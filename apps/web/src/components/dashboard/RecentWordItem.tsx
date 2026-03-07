import { haptic } from '~/lib/haptic'

interface RecentWordItemProps {
  word: string
  meaning: string
  onClick?: () => void
}

export function RecentWordItem({ word, meaning, onClick }: RecentWordItemProps) {
  // 大きい文字数は「...」だけで打ち切る
  const displayMeaning = meaning.length > 20 ? meaning.slice(0, 20) + '...' : meaning;

  return (
    <button
      onClick={() => {
        haptic('medium')
        onClick?.()
      }}
      className="w-full text-left block rounded-3xl border border-black/5 bg-black/2 backdrop-blur-xl px-5 py-4 transition-colors hover:bg-black/5 active:bg-black/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
    >
      <div className="text-[1.25rem] leading-tight font-medium text-black/85">{word}</div>
      <p className="text-black/65 text-sm mt-1">{displayMeaning}</p>
    </button>
  )
}
