interface RecentWordItemProps {
  word: string
  meaning: string
  note: string
}

export function RecentWordItem({ word, meaning, note }: RecentWordItemProps) {
  return (
    <article className="rounded-3xl border border-black/5 bg-white/45 backdrop-blur-xl px-5 py-4">
      <div className="text-[1.65rem] leading-tight font-medium text-black/85">{word}</div>
      <p className="text-black/45 text-sm mt-1">{meaning}</p>
      <p className="text-black/35 text-xs mt-2">{note}</p>
    </article>
  )
}
