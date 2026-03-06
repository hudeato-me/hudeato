import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { Header } from '~/components/Header'
import { Footer } from '~/components/Footer'
import { WordSetDrawer } from '~/components/wordset/WordSetDrawer'
import { WordEntryDrawer } from '~/components/WordEntryDrawer'
import { authClient } from '~/lib/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { useWordSets, useWords } from '~/hooks/use-words'
import type { WordSet, Word, Session } from '~/types'

export const Route = createFileRoute('/list')({
    ssr: false,
    beforeLoad: async () => {
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
    component: WordsPage,
})

function SearchIconSmall() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <circle cx="11" cy="11" r="6" />
            <line x1="16" y1="16" x2="21" y2="21" strokeLinecap="round" />
        </svg>
    )
}

function WordsPage() {
    const queryClient = useQueryClient()
    const [isWordSetDrawerOpen, setIsWordSetDrawerOpen] = useState(false)
    const [editingWordId, setEditingWordId] = useState<string | null>(null)

    const { data: wordSets = [] } = useWordSets(true)
    const [selectedIdState, setSelectedIdState] = useState<string | null>(null)
    const selectedWordSetId = selectedIdState ?? wordSets[0]?.id ?? null

    const { data: words = [], isLoading: isWordsLoading } = useWords(selectedWordSetId ?? '', !!selectedWordSetId)

    const selectedWordSetName = wordSets.find((s: WordSet) => s.id === selectedWordSetId)?.name ?? ''

    // Filters State
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'mastered' | 'unmastered'>('all')

    const filteredWords = useMemo(() => {
        return words.filter((word: Word) => {
            // Search filter
            const searchTarget = `${word.text} ${word.meaning || ``} ${word.meanings?.[0]?.meaning || ``}`.toLowerCase()
            if (searchQuery && !searchTarget.includes(searchQuery.toLowerCase())) {
                return false
            }

            // Mastery filter
            if (filterType === 'mastered' && !word.isMastered) return false
            if (filterType === 'unmastered' && word.isMastered) return false

            return true
        })
    }, [words, searchQuery, filterType])

    return (
        <div className="min-h-screen bg-white text-black/80">
            <main className="max-w-[430px] mx-auto px-4 pt-5 pb-30 space-y-4">
                <Header
                    currentWordSet={selectedWordSetName}
                    onOpenWordSet={() => setIsWordSetDrawerOpen(true)}
                    onLogout={async () => {
                        await authClient.signOut();
                        queryClient.clear();
                        const { del } = await import('idb-keyval');
                        await del('REACT_QUERY_OFFLINE_CACHE');
                    }}
                />

                {/* Search Input */}
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40">
                        <SearchIconSmall />
                    </div>
                    <input
                        type="text"
                        placeholder="単語を検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-[45px] bg-white/50 border border-black/10 rounded-[14px] pl-11 pr-4 text-sm text-black placeholder:text-black/40 outline-none focus:border-black/20 transition-colors"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setFilterType('all')}
                        className={`h-9 px-5 rounded-[10px] text-sm transition-colors ${filterType === 'all'
                                ? 'bg-black text-white font-medium'
                                : 'bg-black/[0.05] text-black/60'
                            }`}
                    >
                        すべて
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterType('mastered')}
                        className={`h-9 px-5 rounded-[10px] text-sm transition-colors ${filterType === 'mastered'
                                ? 'bg-black text-white font-medium'
                                : 'bg-black/[0.05] text-black/60'
                            }`}
                    >
                        覚えた
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterType('unmastered')}
                        className={`h-9 px-5 rounded-[10px] text-sm transition-colors ${filterType === 'unmastered'
                                ? 'bg-black text-white font-medium'
                                : 'bg-black/[0.05] text-black/60'
                            }`}
                    >
                        未習得
                    </button>
                </div>

                {/* Word List */}
                <section className="space-y-3 pt-2">
                    {isWordsLoading ? (
                        <div className="text-sm text-black/45 px-1">読み込み中...</div>
                    ) : filteredWords.length === 0 ? (
                        <div className="text-sm text-black/45 px-1">該当する単語がありません</div>
                    ) : (
                        filteredWords.map((word: Word) => {
                            const mainMeaning = word.meanings?.[0]?.meaning || word.meaning || '意味未登録'
                            const partOfSpeech = word.meanings?.[0]?.partOfSpeech

                            return (
                                <button
                                    key={word.id}
                                    type="button"
                                    onClick={() => setEditingWordId(word.id)}
                                    className="w-full bg-white border border-black/5 rounded-[14px] p-4 flex items-center justify-between text-left shadow-[0_1px_3px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-transform"
                                >
                                    <div className="flex flex-col gap-1 pr-3 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[16px] text-[#0a0a0a] font-medium truncate leading-tight">
                                                {word.text}
                                            </span>
                                            {partOfSpeech && (
                                                <span className="text-[12px] text-black/30 shrink-0 leading-tight">
                                                    {partOfSpeech}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[14px] text-black/40 truncate leading-snug">
                                            {mainMeaning}
                                        </span>
                                    </div>

                                    {/* Mastery Icon */}
                                    {word.isMastered && (
                                        <div className="w-6 h-6 shrink-0 rounded-full bg-[#00c950]/10 border border-[#00c950]/30 flex items-center justify-center">
                                            <div className="w-2 h-2 rounded-full bg-[#00c950]" />
                                        </div>
                                    )}
                                </button>
                            )
                        })
                    )}
                </section>
            </main>

            <WordSetDrawer
                open={isWordSetDrawerOpen}
                selectedSetId={selectedWordSetId ?? ''}
                sets={wordSets}
                onClose={() => setIsWordSetDrawerOpen(false)}
                onSelect={setSelectedIdState}
            />

            <WordEntryDrawer
                isOpen={editingWordId !== null}
                onClose={() => setEditingWordId(null)}
                wordSetId={selectedWordSetId ?? undefined}
                existingWordId={editingWordId}
            />

            {selectedWordSetId && <Footer wordSetId={selectedWordSetId} />}
        </div>
    )
}
