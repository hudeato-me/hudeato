import { useMemo } from 'react'
import { ActivityDot } from './ActivityDot'

interface ActivityCell {
  id: number
  seed: number
  level: number
  date: Date
}

export function Activity({ timestamps }: { timestamps: number[] }) {
  const activityCells = useMemo(() => {
    const columns = 10
    const rows = 7
    const totalCells = columns * rows

    // 今日の日付の0時0分0秒を取得
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 今日の曜日 (0: 日, 1: 月, ..., 6: 土)
    const todayIndex = today.getDay()

    // 今日のセルのインデックス (右端の列の該当する行)
    const todayCellIndex = (columns - 1) * rows + todayIndex

    // タイムスタンプを日付文字列(YYYY-MM-DD)に変換してカウント
    const countsByDate = new Map<string, number>()
    timestamps.forEach((ts) => {
      const d = new Date(ts)
      const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      countsByDate.set(dateStr, (countsByDate.get(dateStr) || 0) + 1)
    })

    // 最大カウントを求めてレベルを計算する基準にする
    let maxCount = 0
    countsByDate.forEach((count) => {
      if (count > maxCount) maxCount = count
    })

    const cells: ActivityCell[] = []
    for (let i = 0; i < totalCells; i++) {
      // i番目のセルが今日から何日前か
      const daysDiff = todayCellIndex - i

      const cellDate = new Date(today)
      cellDate.setDate(today.getDate() - daysDiff)

      // 未来の日付はレベル0
      if (daysDiff < 0) {
        cells.push({
          id: i,
          seed: i + 10,
          level: 0,
          date: cellDate,
        })
        continue
      }

      const dateStr = `${cellDate.getFullYear()}-${cellDate.getMonth() + 1}-${cellDate.getDate()}`
      const count = countsByDate.get(dateStr) || 0

      // countからlevel(0~4)を計算
      let level = 0
      if (count > 0) {
        if (maxCount <= 4) {
          level = count
        } else {
          level = Math.ceil((count / maxCount) * 4)
        }
        level = Math.min(Math.max(level, 1), 4) // 1~4に収める
      }

      cells.push({
        id: i,
        seed: i + 10,
        level,
        date: cellDate,
      })
    }

    return cells
  }, [timestamps])

  // 月のラベルを計算 (1列目、5列目、9列目など、適度に間引いて表示)
  const monthLabels = useMemo(() => {
    const labels = []
    for (let col = 0; col < 10; col += 4) {
      // その列の最初のセル(日曜日)の日付を取得
      const cell = activityCells[col * 7]
      if (cell) {
        const monthStr = cell.date.toLocaleString('en-US', { month: 'short' })
        labels.push({ col: col + 1, label: monthStr })
      }
    }
    return labels
  }, [activityCells])

  return (
    <section className="rounded-3xl border border-black/5 bg-black/2 backdrop-blur-xl p-4">
      <div className="text-black/55 text-[1rem] mb-3">Activity</div>
      <div
        className="grid grid-cols-[40px_1fr] grid-rows-[auto_auto] gap-x-2 gap-y-2 items-start"
        style={{ '--cell-size': 'clamp(21px, 5.4vw, 26px)' } as Record<string, string>}
      >
        <div />
        <div className="grid grid-cols-10 text-[11px] text-black/30 px-[2px]">
          {monthLabels.map(({ col, label }, i) => (
            <span key={i} className={`col-start-${col}`}>
              {label}
            </span>
          ))}
        </div>

        <div className="text-[11px] text-black/30 grid grid-rows-[repeat(7,var(--cell-size))] leading-none">
          <p className="row-start-2 flex items-center">Mon</p>
          <p className="row-start-4 flex items-center">Wed</p>
          <p className="row-start-6 flex items-center">Fri</p>
        </div>
        <div className="grid grid-flow-col grid-rows-[repeat(7,var(--cell-size))] gap-0">
          {activityCells.map((cell) => (
            <ActivityDot key={cell.id} seed={cell.seed} level={cell.level} />
          ))}
        </div>
      </div>
    </section>
  )
}
