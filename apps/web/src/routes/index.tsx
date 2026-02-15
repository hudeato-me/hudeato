import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')(  {
  component: LandingPage,
})

function LandingPage() {
  return (
    <div>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-white/85 backdrop-blur-xl border-b border-black/[0.06] transition-all duration-300">
        <Link
          to="/login"
          className="px-5 py-2 rounded-full text-sm font-semibold border-[1.5px] border-[#1a1a2e] bg-transparent text-[#1a1a2e] no-underline transition-all duration-200 hover:bg-[#1a1a2e] hover:text-white hover:-translate-y-0.5 hover:shadow-lg"
        >
          ログイン
        </Link>
      </header>

    </div>
  )
}
