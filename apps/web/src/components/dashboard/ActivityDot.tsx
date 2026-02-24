interface ActivityDotProps {
  seed: number
  level: number
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453123
  return value - Math.floor(value)
}

function createBrushBlobPath(seed: number, cx: number, cy: number, radius: number) {
  const pointCount = 14
  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / pointCount
    const primaryNoise = seededRandom(seed * 17 + index) * 0.42 - 0.2
    const secondaryNoise = seededRandom(seed * 31 + index) * 0.24 - 0.12
    const localRadius = radius * (1 + primaryNoise + secondaryNoise)
    const x = cx + Math.cos(angle) * localRadius
    const y = cy + Math.sin(angle) * localRadius
    return { x, y }
  })

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    }
    return `${path} L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }, '') + ' Z'
}

export function ActivityDot({ seed, level }: ActivityDotProps) {
  const opacityMap = [0.08, 0.22, 0.38, 0.55, 0.72]
  const normalizedLevel = Math.min(Math.max(level, 0), opacityMap.length - 1)
  const opacity = opacityMap[normalizedLevel]

  const cx = 10 + (seededRandom(seed * 5) - 0.5) * 1
  const cy = 10 + (seededRandom(seed * 7) - 0.5) * 1
  const dotFillScale = 1.2
  const baseRadius = (5 + seededRandom(seed * 11) * 1.2) * dotFillScale
  const corePath = createBrushBlobPath(seed, cx, cy, baseRadius)

  const washPathA = createBrushBlobPath(
    seed + 100,
    cx - 0.8 + seededRandom(seed * 13) * 0.8,
    cy - 0.4 + seededRandom(seed * 19) * 0.7,
    baseRadius * (0.9 + seededRandom(seed * 23) * 0.1),
  )

  const washPathB = createBrushBlobPath(
    seed + 200,
    cx + 0.5 - seededRandom(seed * 29) * 1,
    cy + 0.25 - seededRandom(seed * 31) * 0.9,
    baseRadius * (0.78 + seededRandom(seed * 37) * 0.12),
  )

  const blurId = `brush-dot-blur-${seed}`

  return (
    <svg viewBox="0 0 20 20" className="h-[var(--cell-size)] w-[var(--cell-size)] text-black">
      <defs>
        <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.45" />
        </filter>
      </defs>

      <g filter={`url(#${blurId})`}>
        <path d={corePath} fill="currentColor" opacity={Math.max(opacity - 0.1, 0.08)} />
        <path d={washPathA} fill="currentColor" opacity={Math.max(opacity - 0.16, 0.06)} />
        <path d={washPathB} fill="currentColor" opacity={Math.max(opacity - 0.24, 0.05)} />
      </g>
    </svg>
  )
}
