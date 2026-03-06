import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Header } from '~/components/Header'
import { Footer } from '~/components/Footer'
import { WordSetDrawer } from '~/components/wordset/WordSetDrawer'
import { authClient } from '~/lib/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { useWordSets } from '~/hooks/use-words'
import { ContentContext } from '~/lib/content-context'
import type { WordSet, Session } from '~/types'

export const Route = createFileRoute('/_content')({
    ssr: false,
    beforeLoad: async () => {
        // ログインしていない場合はログインページにリダイレクト
        const result = await authClient.getSession().catch(() => null)
        if (!result?.data?.user) {
            throw redirect({ to: '/login' })
        }
        return { session: result.data as Session }
    },
    pendingComponent: () => (
        <div className="min-h-screen flex items-center justify-center text-black/30 text-[0.95rem]">
            読み込み中...
        </div>
    ),
    component: ContentLayout,
})

function ContentLayout() {
    const queryClient = useQueryClient()
    const [isWordSetDrawerOpen, setIsWordSetDrawerOpen] = useState(false)
    const [selectedIdState, setSelectedIdState] = useState<string | null>(null)
    const { data: wordSets = [] } = useWordSets(true)
    const selectedWordSetId = selectedIdState ?? wordSets[0]?.id ?? null
    const selectedWordSetName = wordSets.find((s: WordSet) => s.id === selectedWordSetId)?.name ?? ''
    // ルート以下のパスの変更を監視
    const pathname = useRouterState({ select: (s) => s.location.pathname })

    return (
        <ContentContext.Provider value={{ selectedWordSetId, wordSets }}>
            <div className="min-h-screen bg-white text-black/80">
                <div className="max-w-[430px] mx-auto px-4 pt-5 pb-30">
                    <Header
                        currentWordSet={selectedWordSetName}
                        onOpenWordSet={() => setIsWordSetDrawerOpen(true)}
                        onLogout={async () => {
                            await authClient.signOut()
                            queryClient.clear()
                            const { del } = await import('idb-keyval')
                            await del('REACT_QUERY_OFFLINE_CACHE')
                        }}
                    />
                    <AnimatePresence mode="wait">
                        <motion.div
                            // パスが変わったら、新しいコンポーネントをマウントする
                            key={pathname}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>

                <WordSetDrawer
                    open={isWordSetDrawerOpen}
                    selectedSetId={selectedWordSetId ?? ''}
                    sets={wordSets}
                    onClose={() => setIsWordSetDrawerOpen(false)}
                    onSelect={setSelectedIdState}
                />
                {selectedWordSetId && <Footer wordSetId={selectedWordSetId} />}
            </div>
        </ContentContext.Provider>
    )
}
