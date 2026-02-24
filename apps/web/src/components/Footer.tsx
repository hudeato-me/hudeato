import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
      <circle cx="11" cy="11" r="6" />
      <line x1="16" y1="16" x2="21" y2="21" strokeLinecap="round" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 10.5L12 4l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 10v8h11v-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <line x1="7" y1="7" x2="20" y2="7" strokeLinecap="round" />
      <line x1="7" y1="12" x2="20" y2="12" strokeLinecap="round" />
      <line x1="7" y1="17" x2="20" y2="17" strokeLinecap="round" />
      <circle cx="4" cy="7" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 6.5A2.5 2.5 0 016.5 4H20v14.5H7a3 3 0 100 6h13" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="8" y1="8" x2="16" y2="8" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
      <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
      <polyline points="12 5 19 12 12 19" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Footer() {
    interface SuggestionItem {
      word: string
      meaning: string
      partOfSpeech?: string
      mastered?: boolean
    }

  const [searchMode, setSearchMode] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollYRef = useRef(0)

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

  const quickSuggestions: SuggestionItem[] = [
    { word: 'ephemeral', meaning: '一時的な、はかない', partOfSpeech: '形容詞', mastered: true },
    { word: 'paradigm', meaning: '典型、模範、パラダイム', partOfSpeech: '名詞' },
    { word: 'ameliorate', meaning: '改善する、良くする', partOfSpeech: '動詞', mastered: true },
    { word: 'lucid', meaning: '明快な、分かりやすい', partOfSpeech: '形容詞' },
  ]

  const filteredSuggestions = query.trim()
    ? quickSuggestions.filter(
        (item) =>
          item.word.toLowerCase().includes(query.toLowerCase()) ||
          item.meaning.includes(query),
      )
    : []

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-200 ${
          searchMode ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!searchMode}
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
                    <ArrowRightIcon />
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
                      <ArrowRightIcon />
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
                    <ArrowRightIcon />
                  </span>
                </button>
                <div className="pt-8 text-center text-black/45 text-sm">該当する単語が見つかりません</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`fixed left-1/2 -translate-x-1/2 bottom-4 w-[430px] max-w-[calc(100vw-16px)] px-3 z-[70] transition-all duration-200 ${
          searchMode ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-5 pointer-events-none'
        }`}
        aria-hidden={!searchMode}
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
            <CloseIcon />
          </button>
        </div>
      </div>

      <footer
        className={`fixed left-1/2 -translate-x-1/2 bottom-4 w-[430px] max-w-[calc(100vw-16px)] px-3 z-50 transition-all duration-200 ${
          searchMode ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0 pointer-events-auto'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setSearchMode(true)}
            className="h-13 w-13 rounded-full border border-black/10 bg-white/55 backdrop-blur-xl flex items-center justify-center text-black/70"
            aria-label="検索"
          >
            <SearchIcon />
          </button>
          <nav className="h-13 flex-1 rounded-full border border-black/10 bg-white/55 backdrop-blur-xl px-5 flex items-center justify-between text-black/65">
            <Link to="/dashboard" className="h-10 w-10 flex items-center justify-center">
              <HomeIcon />
            </Link>
            <button type="button" className="h-10 w-10 flex items-center justify-center" aria-label="リスト">
              <ListIcon />
            </button>
            <button type="button" className="h-10 w-10 flex items-center justify-center" aria-label="単語帳">
              <BookIcon />
            </button>
          </nav>
          <button
            type="button"
            className="h-13 w-13 rounded-full bg-black text-white flex items-center justify-center text-3xl leading-none"
            aria-label="追加"
          >
            +
          </button>
        </div>
      </footer>
    </>
  )
}
