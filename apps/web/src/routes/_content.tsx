import { createFileRoute, redirect } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Header } from '~/components/Header'
import { Footer } from '~/components/Footer'
import { AnimatedOutlet } from '~/components/AnimatedOutlet'
import { WordSetDrawer } from '~/components/wordset/WordSetDrawer'
import { WordSetSettingsModal } from '~/components/wordset/WordSetSettingsModal'
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
    const [settingsSetId, setSettingsSetId] = useState<string | null>(null)
    // 没入モード（クイズ出題中）。ONの間はHeader/Footerを退場させる。
    const [immersive, setImmersive] = useState(false)
    const { data: wordSets = [] } = useWordSets(true)
    const selectedWordSetId = selectedIdState ?? wordSets[0]?.id ?? null
    const selectedWordSetName = wordSets.find((s: WordSet) => s.id === selectedWordSetId)?.name ?? ''
    const settingsWordSet = wordSets.find((s: WordSet) => s.id === settingsSetId)


    return (
        <ContentContext.Provider value={{ selectedWordSetId, wordSets, setImmersive }}>
            <div className="min-h-screen bg-white text-black/80">
                {/* immersive時(クイズ出題中)はFooterのクリアランスが不要なため下余白を最小化する。
                    QuizPlayingScreen側のmin-height計算(100dvh - pt-5 - この下余白)と値を揃えて
                    いるため、変更する場合は両方を同期させること。 */}
                <div className={`max-w-[430px] mx-auto px-4 pt-5 ${immersive ? 'pb-4' : 'pb-30'}`}>
                    <AnimatePresence initial={false}>
                        {!immersive && (
                            <motion.div
                                key="header"
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                            >
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
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <AnimatedOutlet />
                </div>

                <WordSetDrawer
                    open={isWordSetDrawerOpen}
                    selectedSetId={selectedWordSetId ?? ''}
                    sets={wordSets}
                    onClose={() => setIsWordSetDrawerOpen(false)}
                    onSelect={setSelectedIdState}
                    onOpenSettings={(setId) => {
                        setIsWordSetDrawerOpen(false)
                        setSettingsSetId(setId)
                    }}
                />
                <WordSetSettingsModal
                    open={!!settingsSetId}
                    wordSetId={settingsSetId ?? ''}
                    wordSetName={settingsWordSet?.name ?? ''}
                    currentSettings={settingsWordSet?.settings ?? null}
                    onClose={() => setSettingsSetId(null)}
                />
                {selectedWordSetId && <Footer wordSetId={selectedWordSetId} immersive={immersive} />}
            </div>
        </ContentContext.Provider>
    )
}
