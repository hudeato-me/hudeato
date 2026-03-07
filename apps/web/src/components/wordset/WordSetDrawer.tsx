import { useEffect, useRef, useState } from 'react'
import { useCreateWordSet, useUpdateWordSet, useDeleteWordSet } from '~/hooks/use-words'

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

  // メニュー・編集・追加・削除確認の状態
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const editInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  const createWordSet = useCreateWordSet()
  const updateWordSet = useUpdateWordSet()
  const deleteWordSet = useDeleteWordSet()

  useEffect(() => {
    if (!open) {
      setIsDragging(false)
      setDragOffsetY(0)
      activePointerIdRef.current = null
      setMenuOpenId(null)
      setEditingId(null)
      setIsAdding(false)
      setDeletingId(null)
    }
  }, [open])

  // 編集モード開始時にフォーカス
  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus()
  }, [isAdding])

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!open) return
    activePointerIdRef.current = event.pointerId
    dragStartYRef.current = event.clientY
    setIsDragging(true)
    setDragOffsetY(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || activePointerIdRef.current !== event.pointerId) return
    const delta = Math.max(event.clientY - dragStartYRef.current, 0)
    setDragOffsetY(delta)
  }

  const finishDrag = (shouldClose: boolean) => {
    setIsDragging(false)
    setDragOffsetY(0)
    activePointerIdRef.current = null
    if (shouldClose) onClose()
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || activePointerIdRef.current !== event.pointerId) return
    finishDrag(dragOffsetY > closeThreshold)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || activePointerIdRef.current !== event.pointerId) return
    finishDrag(false)
  }

  const resetStates = () => {
    setMenuOpenId(null)
    setEditingId(null)
    setIsAdding(false)
    setDeletingId(null)
  }

  const handleCreate = () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      setIsAdding(false)
      setNewName('')
      return
    }
    createWordSet.mutate({ name: trimmed }, {
      onSuccess: () => {
        setIsAdding(false)
        setNewName('')
      },
    })
  }

  const handleUpdate = (setId: string) => {
    const trimmed = editingName.trim()
    if (!trimmed) {
      setEditingId(null)
      return
    }
    updateWordSet.mutate({ setId, data: { name: trimmed } }, {
      onSuccess: () => setEditingId(null),
    })
  }

  const handleDelete = (setId: string) => {
    deleteWordSet.mutate(setId, {
      onSuccess: () => {
        setDeletingId(null)
        // 削除されたのが選択中のセットなら、最初のセットを選択
        if (setId === selectedSetId) {
          const remaining = sets.filter(s => s.id !== setId)
          if (remaining.length > 0) onSelect(remaining[0].id)
        }
      },
    })
  }

  return (
    <div
      className={`fixed inset-0 z-[70] transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      inert={!open}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/22"
        onClick={() => {
          resetStates()
          onClose()
        }}
        aria-label="ドロワーを閉じる"
      />

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px]">
        <section
          className={`rounded-t-[30px] bg-white px-6 pb-7 transition-transform ${isDragging ? 'duration-0' : 'duration-220'} ${open ? 'translate-y-0' : 'translate-y-full'}`}
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
              const isEditing = editingId === set.id
              const isDeleting = deletingId === set.id

              // 削除確認モード
              if (isDeleting) {
                return (
                  <li key={set.id}>
                    <div className="w-full h-14 px-2 rounded-xl flex items-center justify-between bg-red-50">
                      <span className="text-sm text-red-600">「{set.name}」を削除？</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white active:scale-95 transition-transform"
                          onClick={() => handleDelete(set.id)}
                        >
                          削除
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs rounded-lg bg-black/5 text-black/60 active:scale-95 transition-transform"
                          onClick={() => setDeletingId(null)}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </li>
                )
              }

              // 編集モード
              if (isEditing) {
                return (
                  <li key={set.id}>
                    <div className="w-full h-14 px-2 rounded-xl flex items-center gap-2">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUpdate(set.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onBlur={() => handleUpdate(set.id)}
                        className="flex-1 text-sm text-black/80 bg-black/5 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-black/20"
                      />
                    </div>
                  </li>
                )
              }

              // 通常表示
              return (
                <li key={set.id} className="relative">
                  <div className="w-full h-14 px-2 rounded-xl flex items-center justify-between">
                    <button
                      type="button"
                      className="flex-1 h-full flex items-center text-left"
                      onClick={() => {
                        resetStates()
                        onSelect(set.id)
                        onClose()
                      }}
                    >
                      <span className="text-sm text-black/80">{set.name}</span>
                      {active && <span className="ml-2 text-base text-black/75">✓</span>}
                    </button>
                    <button
                      type="button"
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-black/40 hover:bg-black/5 active:scale-95 transition-all"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpenId(menuOpenId === set.id ? null : set.id)
                      }}
                      aria-label="メニューを開く"
                    >
                      ⋯
                    </button>
                  </div>

                  {/* コンテキストメニュー */}
                  {menuOpenId === set.id && (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-[71]"
                        onClick={() => setMenuOpenId(null)}
                        aria-label="メニューを閉じる"
                      />
                      <div className="absolute right-2 top-12 z-[72] bg-white rounded-xl shadow-lg border border-black/8 py-1 min-w-[120px]">
                        <button
                          type="button"
                          className="w-full px-4 py-2.5 text-left text-sm text-black/70 hover:bg-black/5 transition-colors"
                          onClick={() => {
                            setMenuOpenId(null)
                            setEditingId(set.id)
                            setEditingName(set.name)
                          }}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
                          onClick={() => {
                            setMenuOpenId(null)
                            setDeletingId(set.id)
                          }}
                        >
                          削除
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>

          {/* 新規追加 */}
          {isAdding ? (
            <div className="mt-6 w-full h-14 rounded-xl border border-dashed border-black/20 flex items-center px-4">
              <input
                ref={addInputRef}
                type="text"
                placeholder="セット名を入力"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') {
                    setIsAdding(false)
                    setNewName('')
                  }
                }}
                onBlur={handleCreate}
                className="flex-1 text-sm text-black/80 bg-transparent outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              className="mt-6 w-full h-14 rounded-xl border border-dashed border-black/20 text-black/55 text-sm active:scale-[0.98] transition-transform"
              onClick={() => setIsAdding(true)}
            >
              ＋ 新しいセットを追加
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
