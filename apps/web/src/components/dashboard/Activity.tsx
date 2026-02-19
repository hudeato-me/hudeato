import { ActivityDot } from './ActivityDot'

interface ActivityCell {
  id: number
  seed: number
  level: number
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453123
  return value - Math.floor(value)
}

function createActivityCells(columns = 10, rows = 7): ActivityCell[] {
  return Array.from({ length: columns * rows }, (_, index) => {
    const randomLevel = Math.floor(seededRandom(index * 17 + 9) * 5)
    const hasActivity = seededRandom(index * 13 + 3) > 0.25
    return {
      id: index,
      level: hasActivity ? Math.max(randomLevel, 1) : 0,
      seed: index + 10,
    }
  })
}

export function Activity() {
  const activityCells = createActivityCells()

  return (
    <section className="rounded-3xl border border-black/5 bg-black/2 backdrop-blur-xl p-4">
      <div className="text-black/55 text-[1rem] mb-3">Activity</div>
      <div
        className="grid grid-cols-[40px_1fr] grid-rows-[auto_auto] gap-x-2 gap-y-2 items-start"
        style={{ '--cell-size': 'clamp(21px, 5.4vw, 26px)' } as Record<string, string>}
      >
        <div />
        <div className="grid grid-cols-10 text-[11px] text-black/30 px-[2px]">
          <span className="col-start-1">Oct</span>
          <span className="col-start-5">Nov</span>
          <span className="col-start-9">Dec</span>
        </div>

        <div className="text-[11px] text-black/30 grid grid-rows-[repeat(7,var(--cell-size))] leading-none">
          <p className="row-start-1 flex items-center">Mon</p>
          <p className="row-start-3 flex items-center">Wed</p>
          <p className="row-start-5 flex items-center">Fri</p>
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
