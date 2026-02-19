import { createFileRoute, Link } from '@tanstack/react-router'
import { DrawingCanvas } from '~/components/lp/DrawingCanvas'
import { CustomCursor } from '~/components/lp/CustomCursor'
import { AccordionItem } from '~/components/lp/AccordionItem'

function Home() {
  return (
    <div className="relative min-h-screen bg-white font-sans text-slate-700 selection:bg-slate-100 overflow-hidden">
      {/* --- 筆跡のエフェクト*/}
      <DrawingCanvas />

      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-white/20 backdrop-blur-2xl border-b border-white/40 transition-all duration-300 ring-1 ring-white/20">
        <img src="/logo.png" alt="hudeato.me logo" className="h-16 object-contain" />
        <div className="flex gap-3">
          <Link
            to="/login"
            className="pointer-events-auto px-5 py-2 rounded-full text-sm font-medium border border-white/30 bg-white/10 text-slate-700 hover:bg-white/20 transition-colors"
          >
            ログイン
          </Link>
          <Link
            to="/login"
            className="pointer-events-auto px-5 py-2 rounded-full text-sm font-medium bg-slate-800/90 text-white hover:bg-slate-700/90 transition-colors"
          >
            登録
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 pt-32 pb-24 md:pt-40">
        
        <h1 className="text-5xl md:text-6xl font-bold text-slate-800 tracking-tight mb-12" style={{ fontFamily: 'Comfortaa, sans-serif' }}>
          hudeato.me
        </h1>

        <Link
          to="/login"
          className="pointer-events-auto relative rounded-full border border-slate-300 bg-white/60 backdrop-blur-sm px-10 py-3 text-sm font-medium transition-all hover:bg-white/80 hover:border-slate-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2"
        >
          はじめる
        </Link>

        
        <div className="mt-24 flex flex-col gap-10 text-center leading-loose text-slate-600 md:text-lg">
          <p>
            hudeato(ふであと)は、日常で出会った「言葉」を集めるための
            <br className="hidden md:inline" />
            シンプルな言葉収集アプリです。
          </p>

          <p>
            単語の意味を暗記するだけではありません。
            <br />
            その言葉に出会った場所、その時の写真、空気感。
            <br />
            「記憶」ごと保存することで、
            <br className="md:hidden" />
            あなたの言葉たちを色鮮やかに残します。
          </p>

          <p>
            あなたはただ、琴線に触れた言葉を入力するだけ。
            <br />
            あとのことは、AIが静かに補完します。
          </p>
        </div>

        {/* --- Q&A Section --- */}
        <div className="mt-32 w-full flex flex-col items-center">
          <h2 className="mb-8 text-xl tracking-widest text-slate-800 opacity-80">Q&A</h2>
          <div className="flex w-full flex-col gap-4">
            <AccordionItem
              question="サービス名「筆跡」の読みは、なぜ「ひっせき」ではなく「ふであと」なのですか？"
              answer={
                <>
                  「ひっせき」は学術的・専門的な用語としての読みであり、やや硬い印象を与えます。本サービスでは、文字を単なる分析対象としてではなく、「書いた人の痕跡」や「人となりが残るもの」として捉えています。
                  <br className="my-3 block" />
                  そのため、「筆（ふで）」と「跡（あと）」という日本語本来の語感を活かした「ふであと」という読みを採用しました。より直感的で親しみやすく、感性的な価値を伝えられる表現だと考えています。
                </>
              }
            />
            <AccordionItem
              question="ローマ字表記は、なぜ「fudeato」ではなく「hudeato」なのですか？"
              answer={
                <>
                  日本語の「ふ」は発音上 /h/ 音に近い性質を持ち、ローマ字表記としても hudeato の方が、日本語話者の感覚に自然に近いと考えています。
                  <br className="my-3 block" />
                  また、/h/ 音は音声学的に柔らかく、開放的で軽やかな印象を与えやすい音であり、サービスの持つ雰囲気とも調和します。
                  <br className="my-3 block" />
                  視覚的にも hudeato は文字の並びが滑らかで、全体として明るくやさしい印象になるため、この表記を採用しています。
                </>
              }
            />
          </div>
        </div>

        <div className="mt-32 w-full overflow-hidden rounded-3xl border border-white/40 bg-white/30 p-8 shadow-xl backdrop-blur-xl md:p-12 ring-1 ring-black/5">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex-1 text-center md:text-left">
              <p className="mb-3 text-lg font-medium leading-relaxed text-slate-800">
                集めた言葉たちが
                <br />
                あなたの「ふであと」になる
              </p>
              <p className="text-sm text-slate-500">
                あなたの言葉であなただけの筆跡を残しましょう。
              </p>
              <div className="mt-8">
                <Link
                  to="/login"
                  className="pointer-events-auto inline-block rounded-full bg-slate-800/90 px-8 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-slate-700"
                >
                  はじめる
                </Link>
              </div>
            </div>

            {/* Illustration Area */}
            <div className="flex h-40 w-40 items-center justify-center opacity-90 md:h-48 md:w-48">
              <img src="/card-img2.png" alt="hudeato card" className="h-full w-full object-contain" />
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-12 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} hudeato.me
      </footer>

      {/* カーソルエフェクト */}
      <CustomCursor />
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
})