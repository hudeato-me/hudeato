import { createFileRoute, redirect } from '@tanstack/react-router'
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
    const { data: wordSets = [] } = useWordSets(true)
    const selectedWordSetId = selectedIdState ?? wordSets[0]?.id ?? null
    const selectedWordSetName = wordSets.find((s: WordSet) => s.id === selectedWordSetId)?.name ?? ''
    const settingsWordSet = wordSets.find((s: WordSet) => s.id === settingsSetId)


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
                {selectedWordSetId && <Footer wordSetId={selectedWordSetId} />}
            </div>
        </ContentContext.Provider>
    )
}
