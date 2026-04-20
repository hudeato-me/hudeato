import { createContext, useContext } from 'react'
import type { WordSet } from '~/types'

export interface ContentContextValue {
    selectedWordSetId: string | null
    wordSets: WordSet[]
}

export const ContentContext = createContext<ContentContextValue>({
    selectedWordSetId: null,
    wordSets: [],
})
// useContextを使用して、コンテキストを他のコンポーネントで使えるようにする
export const useContentContext = () => useContext(ContentContext)
