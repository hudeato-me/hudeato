import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { BsSearch, BsHouseDoor, BsListUl, BsBook, BsX, BsArrowRight } from 'react-icons/bs'
import { useSearchWords } from '~/hooks/use-words'
import { WordEntryDrawer } from './WordEntryDrawer'

export function Footer({ wordSetId }: { wordSetId?: string }) {
  interface SuggestionItem {
    word: string
    meaning: string
    partOfSpeech?: string
    mastered?: boolean
  }

  const location = useLocation()
  const currentPath = location.pathname

  const [searchMode, setSearchMode] = useState(false)
  const [isWordEntryOpen, setWordEntryOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollYRef = useRef(0)

  // クエリのデバウンス処理（短くしてレスポンスを早くする）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 150) // 300ms -> 150ms に短縮
    return () => clearTimeout(timer)
  }, [query])

  // リアルタイム検索フックの呼び出し
  const { data: searchResults } = useSearchWords(
    wordSetId ?? '',
    debouncedQuery,
    !!wordSetId && debouncedQuery.trim().length > 0
  )

  useEffect(() => {
    if (!searchMode) {
      return
    }

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 90)

    scrollYRef.current = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollYRef.current}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchMode(false)
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeydown)
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollYRef.current)
    }
  }, [searchMode])

  const closeSearch = () => {
    setSearchMode(false)
    setQuery('')
  }

  // 検索結果をUI用のSuggestionItem形式にマッピング
  const filteredSuggestions: SuggestionItem[] = (searchResults ?? []).map((item: any) => ({
    word: item.text,
    meaning: item.meanings?.[0]?.meaning ?? '意味未登録',
    partOfSpeech: item.meanings?.[0]?.partOfSpeech ?? undefined,
    mastered: item.isMastered,
  }))

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-200 ${searchMode ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        inert={!searchMode}
      >
        <button
          type="button"
          className="absolute inset-0 bg-white/30 backdrop-blur-2xl"
          onClick={closeSearch}
          aria-label="検索を閉じる"
        />

        <div className="relative h-full max-w-[430px] mx-auto px-4 pt-6 pb-24">
          <div className="h-full overflow-y-auto">
            {query.trim() === '' ? (
              <div className="h-full flex items-center justify-center text-black/45 text-sm">
                単語を入力して検索
              </div>
            ) : filteredSuggestions.length > 0 ? (
              <div className="space-y-2 pb-8">
                <button
                  type="button"
                  className="w-full px-5 py-4 rounded-2xl border border-white/50 bg-white/60 backdrop-blur-xl text-left flex items-center justify-between"
                >
                  <p className="text-sm font-semibold text-black/85">「{query.trim()}」を登録</p>
                  <span className="text-black/30">
                    <BsArrowRight className="h-5 w-5" />
                  </span>
                </button>

                {filteredSuggestions.map((item) => (
                  <button
                    key={item.word}
                    type="button"
                    className="w-full px-5 py-4 rounded-2xl border border-white/50 bg-white/60 backdrop-blur-xl text-left flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-black/85">{item.word}</p>
                        {item.partOfSpeech && (
                          <span className="text-[11px] text-black/35">{item.partOfSpeech}</span>
                        )}
                        {item.mastered && (
                          <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-black/45">{item.meaning}</p>
                    </div>
                    <span className="text-black/30 shrink-0">
                      <BsArrowRight className="h-5 w-5" />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2 pb-8">
                <button
                  type="button"
                  className="w-full px-5 py-4 rounded-2xl border border-white/50 bg-white/60 backdrop-blur-xl text-left flex items-center justify-between"
                >
                  <p className="text-sm font-semibold text-black/85">「{query.trim()}」を登録</p>
                  <span className="text-black/30">
                    <BsArrowRight className="h-5 w-5" />
                  </span>
                </button>
                <div className="pt-8 text-center text-black/45 text-sm">該当する単語が見つかりません</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`fixed left-1/2 -translate-x-1/2 bottom-4 w-[430px] max-w-[calc(100vw-16px)] px-3 z-[70] transition-all duration-200 ${searchMode ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-5 pointer-events-none'
          }`}
        inert={!searchMode}
      >
        <div className="flex items-center gap-2">
          <div className="h-13 flex-1 rounded-full border border-white/40 bg-white/35 backdrop-blur-2xl px-5 flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="検索"
              className="w-full bg-transparent text-sm text-black/80 placeholder:text-black/40 outline-none"
            />
          </div>
          <button
            type="button"
            className="h-13 w-13 rounded-full border border-white/40 bg-white/35 backdrop-blur-2xl flex items-center justify-center text-black/70"
            onClick={closeSearch}
            aria-label="閉じる"
          >
            <BsX className="h-5 w-5" />
          </button>
        </div>
      </div>

      <footer
        className={`fixed left-1/2 -translate-x-1/2 bottom-4 w-[430px] max-w-[calc(100vw-16px)] px-3 z-50 transition-all duration-200 ${searchMode ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0 pointer-events-auto'
          }`}
      >
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setSearchMode(true)}
            className="h-13 w-13 rounded-full border border-black/10 bg-white/55 backdrop-blur-xl flex items-center justify-center text-black/70"
            aria-label="検索"
          >
            <BsSearch className="h-5 w-5" />
          </button>
          <nav className="h-13 flex-1 rounded-full border border-black/10 bg-white/55 backdrop-blur-xl px-5 flex items-center justify-between text-black/65">
            <Link
              to="/dashboard"
              className={`h-10 w-10 flex items-center justify-center transition-colors ${currentPath === '/dashboard' || !currentPath ? 'text-black' : ''}`}
            >
              <BsHouseDoor className="h-5 w-5" />
            </Link>
            <Link
              to="/list"
              className={`h-10 w-10 flex items-center justify-center transition-colors ${currentPath === '/list' ? 'text-black' : ''}`}
              aria-label="リスト"
            >
              <BsListUl className="h-5 w-5" />
            </Link>
            <button type="button" className="h-10 w-10 flex items-center justify-center" aria-label="単語帳">
              <BsBook className="h-5 w-5" />
            </button>
          </nav>
          <button
            type="button"
            onClick={() => setWordEntryOpen(true)}
            className="h-13 w-13 rounded-full bg-black text-white flex items-center justify-center text-3xl leading-none"
            aria-label="追加"
          >
            +
          </button>
        </div>
      </footer>

      {/* 単語追加ドロワー */}
      <WordEntryDrawer
        isOpen={isWordEntryOpen}
        onClose={() => setWordEntryOpen(false)}
        wordSetId={wordSetId}
      />
    </>
  )
}
