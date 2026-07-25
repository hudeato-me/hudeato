import { useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// カードのジェスチャ判定。
// 右=覚えた / 左=もう一度 / 上=編集。反転はタップで行う（スワイプには割り当てない）。
// 距離・速度のどちらかが閾値を超えれば確定する。方向は移動量の比で決め、
// 意図がはっきりしない小さなドラッグは元の位置へ戻す。
// ---------------------------------------------------------------------------

// 左右の確定閾値。距離はカード幅に対する比率で、狭い画面でも同じ手応えになるようにする。
const HORIZONTAL_DISTANCE_RATIO = 0.28
const HORIZONTAL_DISTANCE_MIN = 90
const HORIZONTAL_DISTANCE_MAX = 120
const HORIZONTAL_VELOCITY = 800

// 上方向（編集）の確定閾値。
const UP_DISTANCE = 80
const UP_VELOCITY = 580

// この距離より小さい移動はタップとして扱い、方向判定にかけない。
const TAP_SLOP = 8
// 方向の優劣をつけるための比。片方がもう片方の1.2倍を超えたらその軸の意図と見なす。
const AXIS_DOMINANCE = 1.2

// ドラッグ追従の回転量（deg）。文字が読みづらくなるほど傾けない。
const MAX_ROTATE_DEG = 8
const ROTATE_DISTANCE = 160

export type CardGestureAction = 'known' | 'again' | 'edit'

interface UseCardGestureOptions {
    // 確定したとき（退出アニメーションの後）に呼ばれる
    onAction: (action: CardGestureAction) => void
    // タップ（ほぼ動かさずに離した）
    onTap: () => void
    // 確定した瞬間（退出アニメーションの開始時）。Hapticsなどの即時フィードバック用。
    onCommit?: (action: CardGestureAction) => void
    // カードの送り出しにかける時間(ms)。onAction はこの後に呼ばれる。
    exitDurationMs?: number
}

export function useCardGesture({
    onAction,
    onTap,
    onCommit,
    exitDurationMs = 260,
}: UseCardGestureOptions) {
    // 指に追従している移動量
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    // 確定して画面外へ抜けている最中のアクション（null=ドラッグ中または静止）
    const [exiting, setExiting] = useState<CardGestureAction | null>(null)

    const startRef = useRef<{ x: number; y: number; time: number } | null>(null)
    const widthRef = useRef(0)
    const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const horizontalThreshold = () => {
        const byRatio = widthRef.current * HORIZONTAL_DISTANCE_RATIO
        return Math.min(
            HORIZONTAL_DISTANCE_MAX,
            Math.max(HORIZONTAL_DISTANCE_MIN, byRatio),
        )
    }

    const commit = (action: CardGestureAction) => {
        setExiting(action)
        onCommit?.(action)

        if (action === 'edit') {
            // 編集は同じカードに留まるため、退出させずその場で戻す
            setOffset({ x: 0, y: 0 })
            setExiting(null)
            onAction(action)
            return
        }

        // ドラッグ方向へそのまま画面外まで抜けきってから次のカードへ渡す
        exitTimerRef.current = setTimeout(() => {
            setOffset({ x: 0, y: 0 })
            setExiting(null)
            onAction(action)
        }, exitDurationMs)
    }

    const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
        if (exiting) return
        // 要素外まで指がずれても追従させる（useSwipeToClose と同じ流儀）
        event.currentTarget.setPointerCapture(event.pointerId)
        widthRef.current = event.currentTarget.offsetWidth
        startRef.current = { x: event.clientX, y: event.clientY, time: Date.now() }
    }

    const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
        const start = startRef.current
        if (!start || exiting) return

        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        // 縦移動は上方向のみ追従させ、下方向はほとんど動かさない（下スワイプは未使用）
        setOffset({ x: dx, y: dy < 0 ? dy : dy * 0.2 })
    }

    const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
        const start = startRef.current
        if (!start || exiting) return
        event.currentTarget.releasePointerCapture(event.pointerId)
        startRef.current = null

        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        const elapsedSeconds = Math.max(0.001, (Date.now() - start.time) / 1000)
        const absX = Math.abs(dx)
        const absY = Math.abs(dy)

        // ほぼ動いていなければタップ
        if (absX < TAP_SLOP && absY < TAP_SLOP) {
            setOffset({ x: 0, y: 0 })
            onTap()
            return
        }

        const velocityX = absX / elapsedSeconds
        const velocityY = absY / elapsedSeconds

        // 横優位: 左右スワイプの候補
        if (absX > absY * AXIS_DOMINANCE) {
            if (absX >= horizontalThreshold() || velocityX >= HORIZONTAL_VELOCITY) {
                commit(dx > 0 ? 'known' : 'again')
                return
            }
        } else if (absY > absX * AXIS_DOMINANCE && dy < 0) {
            // 縦優位かつ上方向: 編集の候補（下方向は未使用）
            if (absY >= UP_DISTANCE || velocityY >= UP_VELOCITY) {
                commit('edit')
                return
            }
        }

        // 閾値未満・意図が曖昧な場合は元の位置へ戻す
        setOffset({ x: 0, y: 0 })
    }

    const cancel = () => {
        startRef.current = null
        setOffset({ x: 0, y: 0 })
    }

    const dispose = () => {
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    }

    // 追従回転（右=時計回り / 左=反時計回り）。最大 MAX_ROTATE_DEG で頭打ちにする。
    const rotate =
        Math.max(-1, Math.min(1, offset.x / ROTATE_DISTANCE)) * MAX_ROTATE_DEG

    // 評価ラベルの濃さ。閾値の手前で濃くなりきるようにして、確定の予感を伝える。
    const knownOpacity = Math.max(0, Math.min(1, offset.x / horizontalThreshold()))
    const againOpacity = Math.max(0, Math.min(1, -offset.x / horizontalThreshold()))
    const editOpacity = Math.max(0, Math.min(1, -offset.y / UP_DISTANCE))

    return {
        offset,
        rotate,
        exiting,
        knownOpacity,
        againOpacity,
        editOpacity,
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: cancel,
        },
        dispose,
    }
}
