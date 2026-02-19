import { Link } from '@tanstack/react-router'

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

export function Footer() {
  return (
    <footer className="fixed left-1/2 -translate-x-1/2 bottom-4 w-[430px] max-w-[calc(100vw-16px)] px-3 z-50">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          className="h-13 w-13 rounded-full border border-black/10 bg-white/55 backdrop-blur-xl flex items-center justify-center text-black/70"
          aria-label="検索"
        >
          <SearchIcon />
        </button>
        <nav className="h-13 flex-1 rounded-full border border-black/10 bg-white/55 backdrop-blur-xl px-5 flex items-center justify-between text-black/65">
          <Link to="/" className="h-10 w-10 flex items-center justify-center">
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
  )
}
