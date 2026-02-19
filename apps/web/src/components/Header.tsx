interface HeaderProps {
  onLogout: () => void | Promise<void>
  currentWordSet: string
  onOpenWordSet: () => void
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M5.8 18.2l1.6-1.6M16.6 7.4l1.6-1.6" strokeLinecap="round" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 19a6.5 6.5 0 0113 0" strokeLinecap="round" />
    </svg>
  )
}

export function Header({ onLogout, currentWordSet, onOpenWordSet }: HeaderProps) {
  return (
    <header className="sticky top-3 z-40 rounded-4xl border border-black/5 bg-white/50 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
      <button
        type="button"
        onClick={onOpenWordSet}
        className="h-10 px-4 rounded-full border border-black/10 bg-white/55 backdrop-blur-xl text-sm text-black/85 outline-none flex items-center gap-2"
        aria-label="単語セットを開く"
      >
        {currentWordSet}
        <span className="text-black/55">⌄</span>
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-10 w-10 rounded-full border border-black/10 bg-white/55 backdrop-blur-xl flex items-center justify-center text-black/65"
          onClick={onLogout}
          aria-label="ログアウト"
          title="ログアウト"
        >
          <UserIcon />
        </button>
      </div>
    </header>
  )
}
