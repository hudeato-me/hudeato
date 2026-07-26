import { useCallback, useSyncExternalStore } from 'react'
import type { TtsLang } from '~/hooks/use-tts'
import type { CardDirection } from '~/types'

// ---------------------------------------------------------------------------
// 単語帳の音声設定。
// 表面・裏面で別々のON/OFFを持ち、localStorage に永続化する。
// 読み上げ自体はクイズと同じ Google Cloud TTS（useTtsPlayer）を使う。
// ---------------------------------------------------------------------------

const STORAGE_KEYS = {
    front: 'flashcard-front-audio',
    back: 'flashcard-back-audio',
} as const

export type CardFace = keyof typeof STORAGE_KEYS

const readStored = (face: CardFace): boolean => {
    if (typeof window === 'undefined') return true
    try {
        const raw = window.localStorage.getItem(STORAGE_KEYS[face])
        // 未設定時は自動再生ONを既定にする
        return raw === null ? true : raw === 'true'
    } catch {
        return true
    }
}

// 複数コンポーネント（表・裏のボタン）から同じ状態を参照・更新できるよう、
// モジュールスコープのストア + useSyncExternalStore で同期する（use-tts.ts と同じ流儀）。
const state: Record<CardFace, boolean> = {
    front: readStored('front'),
    back: readStored('back'),
}
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

const setEnabled = (face: CardFace, next: boolean) => {
    state[face] = next
    try {
        window.localStorage.setItem(STORAGE_KEYS[face], String(next))
    } catch {
        // localStorage不可（プライベートモード等）でもメモリ内で状態は維持する
    }
    for (const listener of listeners) listener()
}

export function useCardAudioEnabled(face: CardFace) {
    const enabled = useSyncExternalStore(
        subscribe,
        () => state[face],
        // SSR時は既定ON（クライアントで localStorage の値に落ち着く）
        () => true,
    )
    const toggle = useCallback(() => setEnabled(face, !state[face]), [face])
    return { enabled, toggle }
}

// 出題方向と面から読み上げ言語を決める。
// wordToMeaning: 表=単語(en) / 裏=意味(ja)
// meaningToWord: 表=意味(ja) / 裏=単語(en)
export const ttsLangForCardFace = (
    direction: CardDirection,
    face: CardFace,
): TtsLang => {
    const isWordSide =
        direction === 'wordToMeaning' ? face === 'front' : face === 'back'
    return isWordSide ? 'en' : 'ja'
}
