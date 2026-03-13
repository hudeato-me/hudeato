interface RecentWordItemProps {
  word: string
  meaning: string
}

export function RecentWordItem({ word, meaning }: RecentWordItemProps) {
  // 大きい文字数は「...」だけで打ち切る
  const displayMeaning = meaning.length > 20 ? meaning.slice(0, 20) + '...' : meaning;

  return (
    <article className="rounded-3xl border border-black/5 bg-black/2 backdrop-blur-xl px-5 py-4">
      <div className="text-[1.25rem] leading-tight font-medium text-black/85">{word}</div>
      <p className="text-black/65 text-sm mt-1">{displayMeaning}</p>
    </article>
  )
}
