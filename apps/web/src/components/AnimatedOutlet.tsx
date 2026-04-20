import { Outlet, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useRef } from 'react'

/**
 * ページ遷移アニメーション付きの Outlet コンポーネント
 *
 * TanStack Router の <Outlet /> は常に現在のルートをレンダリングするため、
 * AnimatePresence の exit 中も新しいページの内容が表示されてしまう。
 *
 * 解決策: useIsPresent + DOM スナップショット
 * - AnimatePresence が exit を開始すると useIsPresent() が false を返す
 * - exit 中は dangerouslySetInnerHTML で保存済みの HTML を表示
 * - これにより Outlet の再レンダリングを完全に回避
 */

/**
 * Outlet をラップし、exit 中は frozen HTML を表示するコンポーネント
 */
function OutletWithFreeze() {
    const isPresent = useIsPresent()
    const containerRef = useRef<HTMLDivElement>(null)
    const frozenHtmlRef = useRef<string | null>(null)

    // isPresent が false になった瞬間に DOM をフリーズ
    if (!isPresent && frozenHtmlRef.current === null && containerRef.current) {
        frozenHtmlRef.current = containerRef.current.innerHTML
    }

    // exit 中（isPresent = false）→ frozen HTML を表示
    if (frozenHtmlRef.current !== null) {
        return <div dangerouslySetInnerHTML={{ __html: frozenHtmlRef.current }} />
    }

    // 通常（isPresent = true）→ ライブの Outlet
    return (
        <div ref={containerRef}>
            <Outlet />
        </div>
    )
}

export function AnimatedOutlet() {
    const pathname = useRouterState({ select: (s) => s.location.pathname })

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
                <OutletWithFreeze />
            </motion.div>
        </AnimatePresence>
    )
}
