import { createContext, useContext } from 'react'
import type { WordSet } from '~/types'

export interface ContentContextValue {
    selectedWordSetId: string | null
    wordSets: WordSet[]
    // 没入モード（クイズ出題中など）のON/OFFをレイアウト側(_content.tsx)へ伝える。
    // stateはレイアウト側が保持し、ここではセッターのみ公開する。
    setImmersive: (on: boolean) => void
}

export const ContentContext = createContext<ContentContextValue>({
    selectedWordSetId: null,
    wordSets: [],
    setImmersive: () => {},
})
// useContextを使用して、コンテキストを他のコンポーネントで使えるようにする
export const useContentContext = () => useContext(ContentContext)
