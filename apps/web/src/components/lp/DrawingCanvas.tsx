import { useRef, useEffect } from 'react'

// 筆跡を残す関数
export function DrawingCanvas() {
  // canvas elementを使用
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 筆跡のデータ
  const strokes = useRef<{ points: { x: number; y: number }[]; life: number; isDrawing: boolean }[]>([])
  const requestRef = useRef<number>(0)
  const currentStroke = useRef<{ points: { x: number; y: number }[]; life: number; isDrawing: boolean } | null>(null)

  // 打った点同士の中間を埋めて滑らかな線にする関数
  const addInterpolatedPoints = (
    stroke: typeof currentStroke.current,
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    if (!stroke) return
    // 差を計算
    const dx = end.x - start.x
    const dy = end.y - start.y
    // 距離を計算
    const distance = Math.sqrt(dx * dx + dy * dy)
    const step = 6

    for (let i = 0; i <= distance; i += step) {
      const t = distance === 0 ? 0 : i / distance
      const x = start.x + dx * t
      const y = start.y + dy * t
      // 点を打つ
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
      canvas.width = window.innerWidth
      canvas.height = Math.max(window.innerHeight, document.body.scrollHeight)
    }
    resizeCanvas()

    // スクロールやリサイズに対応
    window.addEventListener('resize', resizeCanvas)

    // 毎秒60回画面を書き換える関数
    const animate = () => {
      // 画面をクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // canvasの筆の設定
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 32
      // 
      const aliveStrokes: typeof strokes.current = []
      // 筆のストロークのアニメーション
      strokes.current.forEach((stroke) => {
        // もし書き終わっていれば
        if (!stroke.isDrawing) {
          // lifeを小さくする
          stroke.life -= 0.01
        }
        // lifeが0でなければ
        if (stroke.life > 0) {
          // 筆のストロークをリストに残す
          aliveStrokes.push(stroke)
          // 透明度を計算
          const opacity = stroke.life * 0.3
          ctx.strokeStyle = `rgba(148, 163, 184, ${opacity})`
          // 描画
          ctx.beginPath()
          // 点であれば
          if (stroke.points.length < 2) {
            if (stroke.points[0]) {
              ctx.fillStyle = ctx.strokeStyle
              ctx.arc(stroke.points[0].x, stroke.points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
              ctx.fill()
            }
          } else {
            // 点でなく線であれば
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
            for (let i = 1; i < stroke.points.length; i++) {
              ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
            }
            // 線を引く
            ctx.stroke()
          }
        }
      })
      // リストを更新する
      strokes.current = aliveStrokes
      // また関数を呼ぶことをリクエスト
      requestRef.current = requestAnimationFrame(animate)
    }
    requestRef.current = requestAnimationFrame(animate)

    // --- イベントリスナー設定 (Windowレベル) ---
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
        y: clientY - rect.top,
      }
    }

    // マウス操作時に実行される関数
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

    // マウス操作に応じて、関数を実行
    window.addEventListener('mousedown', startDrawing)
    window.addEventListener('touchstart', startDrawing, { passive: false })

    // 移動と終了はWindow全体で監視
    window.addEventListener('mousemove', draw)
    window.addEventListener('touchmove', draw, { passive: false })
    window.addEventListener('mouseup', stopDrawing)
    window.addEventListener('touchend', stopDrawing)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (requestRef.current) cancelAnimationFrame(requestRef.current)

      window.removeEventListener('mousedown', startDrawing)
      window.removeEventListener('touchstart', startDrawing)
      window.removeEventListener('mousemove', draw)
      window.removeEventListener('touchmove', draw)
      window.removeEventListener('mouseup', stopDrawing)
      window.removeEventListener('touchend', stopDrawing)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-0 touch-none" />
}
