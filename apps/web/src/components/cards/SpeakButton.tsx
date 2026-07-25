import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { BsVolumeUp } from 'react-icons/bs'
import type { TtsLang } from '~/hooks/use-tts'
import { haptic } from '~/lib/haptic'

interface SpeakButtonProps {
    text: string
    lang: TtsLang
    play: (text: string, lang: TtsLang) => Promise<void>
    // 表面の単語用(md)と裏面の例文用(sm)でサイズを切り替える
    size?: 'sm' | 'md'
    label?: string
}

// 単語・例文の読み上げボタン。薄いグレーの面 + 黒いスピーカーアイコンを基本とし、
// 再生中だけ濃いグレーへ控えめに変化させる（塗りつぶし黒にはしない）。
// カード上に置くため、タップがカードの反転・スワイプへ伝播しないよう必ず止める。
export function SpeakButton({ text, lang, play, size = 'md', label }: SpeakButtonProps) {
    const [isPlaying, setIsPlaying] = useState(false)
    // アンマウント後に setState しないためのガード（再生完了は非同期に返ってくる）
    const mountedRef = useRef(true)
    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const sizeClass = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11'
    const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-[1.15rem] w-[1.15rem]'

    return (
        <motion.button
            type="button"
            aria-label={label ?? `${text} を読み上げる`}
            // カード側のジェスチャ・タップ反転から独立させる
            onPointerDown={(event) => event.stopPropagation()}
            onClick={async (event) => {
                event.stopPropagation()
                haptic('light')
                setIsPlaying(true)
                await play(text, lang)
                if (mountedRef.current) setIsPlaying(false)
            }}
            animate={isPlaying ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={isPlaying ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
            className={`${sizeClass} shrink-0 rounded-full flex items-center justify-center transition-colors ${
                isPlaying ? 'bg-black/[0.11] text-black/80' : 'bg-black/[0.05] text-black/65'
            } active:scale-90`}
        >
            <BsVolumeUp className={iconClass} />
        </motion.button>
    )
}
