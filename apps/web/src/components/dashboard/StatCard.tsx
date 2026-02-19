interface StatCardProps {
  label: string
  value: number
  cardClass: string
}

export function StatCard({ label, value, cardClass }: StatCardProps) {
  return (
    <div className={`rounded-3xl border border-black/5 backdrop-blur-xl p-5 ${cardClass}`}>
      <div className="text-sm text-black/40 mb-1">{label}</div>
      <div className="text-[2.05rem] leading-none font-semibold text-black/85">{value}</div>
    </div>
  )
}
