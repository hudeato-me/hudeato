import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useRef, useEffect} from 'react'
export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="relative min-h-screen bg-white font-sans text-slate-700 selection:bg-slate-100 overflow-hidden">
      
      {/* --- 背景：筆跡エフェクト (最背面) --- */}
      <DrawingCanvas />

      {/* --- Main Content --- */}
      <main className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 py-24 md:py-32 pointer-events-none">
        
        {/* --- Header Section (Logo) --- */}
        <div className="mb-12">
          <img 
            src="/logo.png" 
            alt="hudeato.me logo" 
            className="h-16 md:h-32 object-contain"
          />
        </div>

        {/* Start Button */}
        {/* ボタンも少し透明にして、裏に筆跡が見えるようにしました。
          pointer-events-auto でクリックは可能ですが、
          裏側のDrawingCanvasのグローバルイベントで描画も継続されます。
        */}
        <Link
          to="/login"
          className="pointer-events-auto relative rounded-full border border-slate-300 bg-white/60 backdrop-blur-sm px-10 py-3 text-sm font-medium transition-all hover:bg-white/80 hover:border-slate-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2"
        >
          はじめる
        </Link>

        {/* --- Main Copy Section --- */}
        <div className="mt-24 flex flex-col gap-10 text-center leading-loose text-slate-600 md:text-lg">
          <p>
            hudeato（ふであと）は、日常で出会った「言葉」を集めるための
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

        {/* --- Link to Features --- */}
        {/* <div className="mt-16">
          <Link
            to="/about"
            className="pointer-events-auto group inline-flex items-center border-b border-dotted border-slate-400 pb-0.5 text-sm text-slate-500 transition-colors hover:border-slate-800 hover:text-slate-800"
          >
            できることを見る
            <ArrowRightIcon className="ml-1 transition-transform group-hover:translate-x-1" />
          </Link>
        </div> */}

        <QASection />

        {/* --- Bottom Card Section (Glassmorphism) --- */}
        {/* bg-slate-50 -> bg-white/30 backdrop-blur-xl に変更
           borderも半透明にして、影(shadow-xl)で浮き上がらせています。
        */}
        <div className="mt-32 w-full overflow-hidden rounded-3xl border border-white/40 bg-white/30 p-8 shadow-xl backdrop-blur-xl md:p-12 ring-1 ring-black/5">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex-1 text-center md:text-left">
              <p className="mb-3 text-lg font-medium leading-relaxed text-slate-800">
                あなたの筆あとを、
                <br />
                地図に残すように。
              </p>
              <p className="text-sm text-slate-500">
                集めた言葉が、あなただけの世界を作ります。
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
            <div className="flex h-40 w-40 items-center justify-center opacity-80 md:h-48 md:w-48">
              <IllustrationPlaceholder />
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-12 text-center text-xs text-slate-400 pointer-events-none">
        © {new Date().getFullYear()} hudeato.me
      </footer>
      
      {/* カーソルエフェクト (お好みで追加してください) */}
      <CustomCursor />
    </div>
  )
}

// --- 【Canvas版】筆跡エフェクト (Global Event対応版) ---
function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // ストロークデータ
  const strokes = useRef<{ points: {x: number, y: number}[]; life: number; isDrawing: boolean }[]>([])
  const requestRef = useRef<number>()
  const currentStroke = useRef<{ points: {x: number, y: number}[]; life: number; isDrawing: boolean } | null>(null)

  // 補間関数
  const addInterpolatedPoints = (stroke: typeof currentStroke.current, start: { x: number; y: number }, end: { x: number; y: number }) => {
    if (!stroke) return
    const dx = end.x - start.x
    const dy = end.y - start.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const step = 6 
    
    for (let i = 0; i <= distance; i += step) {
      const t = distance === 0 ? 0 : i / distance
      const x = start.x + dx * t
      const y = start.y + dy * t
      stroke.points.push({ x, y })
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // キャンバスのリサイズ設定
    const resizeCanvas = () => {
      // 画面全体をカバーするように修正
      canvas.width = window.innerWidth
      canvas.height = Math.max(window.innerHeight, document.body.scrollHeight)
    }
    resizeCanvas()
    
    // スクロールやリサイズに対応
    window.addEventListener('resize', resizeCanvas)

    // --- アニメーションループ ---
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 32

      const aliveStrokes: typeof strokes.current = []

      strokes.current.forEach((stroke) => {
        if (!stroke.isDrawing) {
          stroke.life -= 0.01
        }

        if (stroke.life > 0) {
          aliveStrokes.push(stroke)
          const opacity = stroke.life * 0.3
          ctx.strokeStyle = `rgba(148, 163, 184, ${opacity})`

          ctx.beginPath()
          if (stroke.points.length < 2) {
             if (stroke.points[0]) {
               ctx.fillStyle = ctx.strokeStyle
               ctx.arc(stroke.points[0].x, stroke.points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
               ctx.fill()
             }
          } else {
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
            for (let i = 1; i < stroke.points.length; i++) {
              ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
            }
            ctx.stroke()
          }
        }
      })

      strokes.current = aliveStrokes
      requestRef.current = requestAnimationFrame(animate)
    }
    requestRef.current = requestAnimationFrame(animate)

    // --- イベントリスナー設定 (Windowレベル) ---
    // ボタンの上でも描画を継続させるため、move/upはwindowにアタッチします
    
    const getPos = (e: MouseEvent | TouchEvent) => {
       const rect = canvas.getBoundingClientRect()
       let clientX, clientY
       
       if ('touches' in e) {
         clientX = e.touches[0].clientX
         clientY = e.touches[0].clientY
       } else {
         clientX = (e as MouseEvent).clientX
         clientY = (e as MouseEvent).clientY
       }
       
       return {
         x: clientX - rect.left,
         y: clientY - rect.top
       }
    }

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      // 左クリックのみ
      if ('button' in e && (e as MouseEvent).button !== 0) return

      const { x, y } = getPos(e)
      const newStroke = { points: [{ x, y }], life: 1.0, isDrawing: true }
      strokes.current.push(newStroke)
      currentStroke.current = newStroke
    }

    const draw = (e: MouseEvent | TouchEvent) => {
       if (!currentStroke.current) return
       const { x, y } = getPos(e)
       const lastPoint = currentStroke.current.points[currentStroke.current.points.length - 1]
       addInterpolatedPoints(currentStroke.current, lastPoint, { x, y })
    }

    const stopDrawing = () => {
      if (currentStroke.current) {
        currentStroke.current.isDrawing = false
        currentStroke.current = null
      }
    }

    // Canvasでのみ開始（ボタンクリックで描画開始しないように）
    canvas.addEventListener('mousedown', startDrawing)
    canvas.addEventListener('touchstart', startDrawing, { passive: false })
    
    // 移動と終了はWindow全体で監視（ボタン上を通過しても描画するため）
    window.addEventListener('mousemove', draw)
    window.addEventListener('touchmove', draw, { passive: false })
    window.addEventListener('mouseup', stopDrawing)
    window.addEventListener('touchend', stopDrawing)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      
      canvas.removeEventListener('mousedown', startDrawing)
      canvas.removeEventListener('touchstart', startDrawing)
      window.removeEventListener('mousemove', draw)
      window.removeEventListener('touchmove', draw)
      window.removeEventListener('mouseup', stopDrawing)
      window.removeEventListener('touchend', stopDrawing)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full z-0 touch-none"
    />
  )
}
// --- Icons / Components ---

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  )
}

function IllustrationPlaceholder() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="h-full w-full fill-none stroke-slate-800 stroke-[1.2]"
    >
      <path d="M40 160 Q 100 190 160 160" />
      <path d="M40 160 L 40 60 Q 100 90 160 60 L 160 160" />
      <line x1="100" y1="75" x2="100" y2="175" />
      <circle cx="60" cy="40" r="4" fill="currentColor" className="opacity-20"/>
      <circle cx="140" cy="30" r="6" fill="currentColor" className="opacity-30"/>
      <path d="M160 60 L 180 40" strokeDasharray="4 4" />
    </svg>
  )
}

// --- カスタムカーソル＆波紋エフェクトコンポーネント ---
function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 })
  const [isVisible, setIsVisible] = useState(false)
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([])

  useEffect(() => {
    const updatePosition = (e: MouseEvent) => {
      requestAnimationFrame(() => {
        setPosition({ x: e.clientX, y: e.clientY })
        if (!isVisible) setIsVisible(true)
      })
    }

    const handleMouseDown = (e: MouseEvent) => {
      const newRipple = { x: e.clientX, y: e.clientY, id: Date.now() }
      setRipples((prev) => [...prev, newRipple])
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id))
      }, 1000)
    }

    const handleMouseEnter = () => setIsVisible(true)
    const handleMouseLeave = () => setIsVisible(false)

    window.addEventListener('mousemove', updatePosition)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseenter', handleMouseEnter)
    window.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', updatePosition)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseenter', handleMouseEnter)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [isVisible])

  return (
    <>
      <style>{`
        @keyframes ripple-effect {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
          /* --- 変更点 --- */
          /* scale(4.0): 波紋の広がりを1.6倍(2.5→4.0)に大きくしました */
          100% { transform: translate(-50%, -50%) scale(4.0); opacity: 0; }
        }
        .animate-ripple {
          animation: ripple-effect 1s ease-out forwards;
        }
      `}</style>

      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="fixed pointer-events-none z-40 rounded-full border border-slate-400/40 bg-slate-300/10 animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: '32px',
            height: '32px',
          }}
        />
      ))}

      <div
        className="fixed top-0 left-0 pointer-events-none z-50 mix-blend-multiply transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* カーソル本体 (w-8 h-8 = 32px) */}
        <div className="h-8 w-8 rounded-full border border-slate-300/30 bg-slate-200/20 backdrop-blur-[1px]" />
      </div>
    </>
  )
}

function QASection() {
  return (
    <div className="mt-32 w-full flex flex-col items-center">
      
      {/* タイトル */}
      <h2 className="mb-8 text-xl tracking-widest text-slate-800 opacity-80">
        Q&A
      </h2>

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
  )
}

// --- アコーディオンアイテムコンポーネント ---
function AccordionItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-white/40 bg-white/30 shadow-sm backdrop-blur-md transition-all hover:bg-white/40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors focus:outline-none"
      >
        <span className="flex items-start text-sm font-bold leading-relaxed text-slate-800">
          <span className="mr-3 text-slate-400">Q.</span>
          {question}
        </span>
        {/* アイコン: 開閉に合わせて回転 */}
        <ChevronDownIcon
          className={`ml-4 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 開閉アニメーション (Grid trick) */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/20 px-6 pb-6 pt-2 text-sm leading-loose text-slate-600">
            <div className="flex">
              <span className="mr-3 font-bold text-slate-400">A.</span>
              <div>{answer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- アイコン (既存のIconsエリアに追加) ---
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  )
}