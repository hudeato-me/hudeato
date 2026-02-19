import { useState, useEffect } from 'react'

export function CustomCursor() {
  // 筆跡の位置と可視・不可視を管理
  const [position, setPosition] = useState({ x: -100, y: -100 })
  const [isVisible, setIsVisible] = useState(false)
  // クリック時の波紋
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([])

  useEffect(() => {
    // マウス位置を更新する関数
    const updatePosition = (e: MouseEvent) => {
      requestAnimationFrame(() => {
        setPosition({ x: e.clientX, y: e.clientY })
        if (!isVisible) setIsVisible(true)
      })
    }

    // 波紋生成の関数
    const handleMouseDown = (e: MouseEvent) => {
        // クリック時に座標とIDを記録
      const newRipple = { x: e.clientX, y: e.clientY, id: Date.now() }
      // リストに座標とIDの組み合わせを追加
      setRipples((prev) => [...prev, newRipple])
      // 1000ミリ秒後に、リストから削除
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id))
      }, 1000)
    }
    
    // マウスが動いたら、位置を更新
    window.addEventListener('mousemove', updatePosition)
    // クリックしたら、波紋を生成
    window.addEventListener('mousedown', handleMouseDown)

    return () => {
      window.removeEventListener('mousemove', updatePosition)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [isVisible])

  return (
    <>
      <style>{`
        @keyframes ripple-effect {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
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
    {/* 追従する円 */}
      <div
        className="fixed top-0 left-0 pointer-events-none z-50 mix-blend-multiply transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
          opacity: isVisible ? 1 : 0,
        }}
      >
        <div className="h-8 w-8 rounded-full border border-slate-300/30 bg-slate-200/20 backdrop-blur-[1px]" />
      </div>
    </>
  )
}
