import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSwipeToClose } from '~/hooks/word-entry/useSwipeToClose'

interface BottomSheetProps {
    isOpen: boolean
    onClose: () => void
    children: ReactNode
    // 中身に合わせて高さの上限を変えたいときに指定する
    maxHeightClass?: string
    // 背景オーバーレイの読み上げ用ラベル
    closeLabel?: string
}

// アプリ共通のボトムシート。
// つまみのドラッグと、中身を一番上までスクロールした状態からの下スワイプで閉じられる
// （WordEntryDrawer と同じ useSwipeToClose を共有する）。
// カードは3D変換の中にあり position:fixed が効かないため、body 直下へ Portal する。
export function BottomSheet({
    isOpen,
    onClose,
    children,
    maxHeightClass = 'max-h-[85vh]',
    closeLabel = '閉じる',
}: BottomSheetProps) {
    const {
        dragY,
        setDragY,
        isSwipingDown,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleContentSwipeStart,
        handleContentSwipeMove,
        handleContentSwipeEnd,
    } = useSwipeToClose({ handleClose: onClose })

    // 開き直したときに、前回のドラッグ量を持ち越さない
    useEffect(() => {
        if (isOpen) setDragY(0)
    }, [isOpen, setDragY])

    if (typeof document === 'undefined') return null

    // ドラッグ中は指に追従させ、離した後はアニメーションで戻す/閉じる
    const isDragging = dragY > 0
    const sheetStyle = isOpen
        ? {
              transform: `translateY(${dragY}px)`,
              transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }
        : { transform: 'translateY(100%)', transition: 'transform 0.3s ease-out' }

    return createPortal(
        <div
            className={`fixed inset-0 z-[100] transition-opacity duration-300 ${
                isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/40 w-full cursor-default"
                onClick={onClose}
                aria-label={closeLabel}
            />

            <div
                style={sheetStyle}
                className={`absolute bottom-0 w-full bg-white rounded-t-3xl shadow-xl flex flex-col ${maxHeightClass}`}
            >
                {/* つまみ: ここを掴んで下へ引くと閉じる */}
                <div
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className="w-full shrink-0 flex justify-center pt-3 pb-2 cursor-grab touch-none"
                >
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                </div>

                {/* 中身: 一番上までスクロールした状態からの下スワイプでも閉じる */}
                <div
                    onTouchStart={handleContentSwipeStart}
                    onTouchMove={handleContentSwipeMove}
                    onTouchEnd={handleContentSwipeEnd}
                    className={`overflow-y-auto ${isSwipingDown ? 'overscroll-none' : ''}`}
                >
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    )
}
