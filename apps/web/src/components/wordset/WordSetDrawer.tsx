import { useEffect, useRef, useState } from 'react'
const DRAWER_CLOSE_THRESHOLD = 72;

interface WordSetDrawerProps {
  open: boolean
  selectedSetId: string
  sets: { id: string; name: string }[]
  onClose: () => void
  onSelect: (setId: string) => void
}

export function WordSetDrawer({
  open,
  selectedSetId,
  sets,
  onClose,
  onSelect,
}: WordSetDrawerProps) {
  const closeThreshold = DRAWER_CLOSE_THRESHOLD
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartYRef = useRef(0)
  const activePointerIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) {
      setIsDragging(false)
      setDragOffsetY(0)
      activePointerIdRef.current = null
    }
  }, [open])

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!open) {
      return
    }
    activePointerIdRef.current = event.pointerId
    dragStartYRef.current = event.clientY
    setIsDragging(true)
    setDragOffsetY(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || activePointerIdRef.current !== event.pointerId) {
      return
    }
    const delta = Math.max(event.clientY - dragStartYRef.current, 0)
    setDragOffsetY(delta)
  }

  const finishDrag = (shouldClose: boolean) => {
    setIsDragging(false)
    setDragOffsetY(0)
    activePointerIdRef.current = null
    if (shouldClose) {
      onClose()
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || activePointerIdRef.current !== event.pointerId) {
      return
    }
    finishDrag(dragOffsetY > closeThreshold)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || activePointerIdRef.current !== event.pointerId) {
      return
    }
    finishDrag(false)
  }

  return (
    <div
      className={`fixed inset-0 z-[70] transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/22"
        onClick={onClose}
        aria-label="ドロワーを閉じる"
      />

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px]">
        <section
          className={`rounded-t-[30px] bg-white px-6 pb-7 transition-transform ${isDragging ? 'duration-0' : 'duration-220'
            } ${open ? 'translate-y-0' : 'translate-y-full'}`}
          style={open && dragOffsetY > 0 ? { transform: `translateY(${dragOffsetY}px)` } : undefined}
          role="dialog"
          aria-modal="true"
          aria-label="単語セット"
        >
          <button
            type="button"
            className="w-full pt-3 pb-1.5 flex justify-center touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            aria-label="ドロワーをドラッグして閉じる"
          >
            <span className="h-1.5 w-14 rounded-full bg-black/14" />
          </button>
          <h2 className="text-[1.2rem] font-semibold text-black/90 mb-4">単語セット</h2>

          <ul className="space-y-1">
            {sets.map((set) => {
              const active = set.id === selectedSetId
              return (
                <li key={set.id}>
                  <button
                    type="button"
                    className="w-full h-14 px-2 rounded-xl flex items-center justify-between text-left"
                    onClick={() => {
                      onSelect(set.id)
                      onClose()
                    }}
                  >
                    <span className="text-sm text-black/80">{set.name}</span>
                    <span className="text-base text-black/75">{active ? '✓' : '⋯'}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            className="mt-6 w-full h-14 rounded-xl border border-dashed border-black/20 text-black/55 text-sm"
          >
            ＋ 新しいセットを追加
          </button>
        </section>
      </div>
    </div>
  )
}
