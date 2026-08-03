import { useCallback, useSyncExternalStore } from 'react'
import type { TtsLang } from '~/hooks/use-tts'
import type { CardDirection } from '~/types'

// ---------------------------------------------------------------------------
// 単語帳の音声設定。
// 表裏で共通の1つのON/OFFを持ち、localStorage に永続化する。
// 開始画面のスイッチとカード上の音量ボタンのどちらから変更しても同期する
// （クイズの useVoiceEnabled と同じ流儀。状態はクイズとは独立させる）。
// 読み上げ自体はクイズと同じ Google Cloud TTS（useTtsPlayer）を使う。
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'flashcard-audio'

export type CardFace = 'front' | 'back'

const readStored = (): boolean => {
    if (typeof window === 'undefined') return true
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        // 未設定時は自動再生ONを既定にする（まず機能の価値を体験してもらう）
        return raw === null ? true : raw === 'true'
    } catch {
        return true
    }
}

let audioEnabled = readStored()
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

const getSnapshot = () => audioEnabled

const setAudioEnabled = (next: boolean) => {
    audioEnabled = next
    try {
        window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
        // localStorage不可（プライベートモード等）でもメモリ内で状態は維持する
    }
    for (const listener of listeners) listener()
}

export function useCardAudioEnabled() {
    const enabled = useSyncExternalStore(
        subscribe,
        getSnapshot,
        // SSR時は既定ON（クライアントで localStorage の値に落ち着く）
        () => true,
    )
    const toggle = useCallback(() => setAudioEnabled(!audioEnabled), [])
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
