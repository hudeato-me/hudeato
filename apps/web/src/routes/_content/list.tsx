import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { BsSearch } from 'react-icons/bs'
import { FilterTabs } from '~/components/FilterTabs'
import { WordEntryDrawer } from '~/components/WordEntryDrawer'
import { useWords, useCompleteWord } from '~/hooks/use-words'
import { useContentContext } from '~/lib/content-context'
import { haptic } from '~/lib/haptic'
import type { Word } from '~/types'

export const Route = createFileRoute('/_content/list')({
    ssr: false,
    component: WordsPage,
})

function WordsPage() {
    // コンテキストから単語セットIDを取得
    const { selectedWordSetId } = useContentContext()
    // 編集中の単語IDを管理するState
    const [editingWordId, setEditingWordId] = useState<string | null>(null)

    const { data: words = [], isLoading: isWordsLoading } = useWords(selectedWordSetId ?? '', !!selectedWordSetId)
    // AI補完失敗時の再試行（空欄のみ補完）
    const { mutate: retryCompletion } = useCompleteWord(selectedWordSetId ?? '')

    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'mastered' | 'unmastered'>('all')

    // filteredWordsはドロワーが開いても(editingWordIdのStateが変わっても)再描画されない
    const filteredWords = useMemo(() => {
        // 検索クエリを小文字に変換
        const normalizedQuery = searchQuery ? searchQuery.toLowerCase() : ''
        return words.filter((word: Word) => {
            // allだったらそのまま
            // masterdだったら未習得の単語を除外
            if (filterType === 'mastered' && !word.isMastered) return false
            // unmasterdだったら習得済みの単語を除外
            if (filterType === 'unmastered' && word.isMastered) return false

            // 検索欄に文字が入っていたら
            if (normalizedQuery) {
                // 単語、意味、複数の意味を小文字に変換
                const searchTarget = `${word.text} ${word.meanings?.map((m) => m.meaning).join(' ') ?? ''}`.toLowerCase()
                // 検索欄の文字が含まれていなかったら除外
                if (!searchTarget.includes(normalizedQuery)) {
                    return false
                }
            }

            return true
        })
    }, [words, searchQuery, filterType])

    return (
        <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40">
                    <BsSearch className="h-4 w-4" />
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
            <FilterTabs
                options={[
                    { value: 'all', label: 'すべて' },
                    { value: 'mastered', label: '覚えた' },
                    { value: 'unmastered', label: '未習得' },
                ]}
                value={filterType}
                onChange={setFilterType}
            />

            {/* Word List */}
            <section className="space-y-3 pt-2">
                {isWordsLoading ? (
                    <div className="text-sm text-black/45 px-1">読み込み中...</div>
                ) : filteredWords.length === 0 ? (
                    <div className="text-sm text-black/45 px-1">該当する単語がありません</div>
                ) : (
                    filteredWords.map((word: Word) => {
                        const mainMeaning = word.meanings?.[0]?.meaning || '意味未登録'
                        const partOfSpeech = word.meanings?.[0]?.partOfSpeech
                        const isCompleting = word.completionStatus === 'pending'
                        const isCompletionFailed = word.completionStatus === 'failed'

                        return (
                            <button
                                key={word.id}
                                type="button"
                                onClick={() => {
                                    haptic('medium')
                                    setEditingWordId(word.id)
                                }}
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
                                    {isCompleting ? (
                                        // AI補完中: パルスするスパークルで進行中を気持ちよく見せる
                                        <span className="flex items-center gap-1.5 text-[14px] text-blue-500/90 leading-snug animate-pulse">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 shrink-0">
                                                <path d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            AI補完中...
                                        </span>
                                    ) : isCompletionFailed ? (
                                        <span className="flex items-center gap-2 text-[14px] leading-snug">
                                            <span className="text-red-400">補完に失敗しました</span>
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    haptic('medium')
                                                    retryCompletion({ wordId: word.id, data: { prompt: null } })
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.stopPropagation()
                                                        retryCompletion({ wordId: word.id, data: { prompt: null } })
                                                    }
                                                }}
                                                className="text-blue-500 font-medium shrink-0"
                                            >
                                                再試行
                                            </span>
                                        </span>
                                    ) : (
                                        <span className="text-[14px] text-black/40 truncate leading-snug">
                                            {mainMeaning}
                                        </span>
                                    )}
                                </div>

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

            <WordEntryDrawer
                isOpen={editingWordId !== null}
                onClose={() => setEditingWordId(null)}
                wordSetId={selectedWordSetId ?? undefined}
                existingWordId={editingWordId}
            />
        </div>
    )
}
