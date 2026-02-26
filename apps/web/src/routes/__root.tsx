/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import * as React from 'react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import appCss from '~/styles/app.css?url'
import { seo } from '~/utils/seo'
import { createQueryClient, asyncPersister } from '~/lib/query-client'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title: 'Hudeato - 英語学習をもっとスマートに',
        description:
          'Hudeatoは、AIを活用して英単語を効率的に学習できるプラットフォームです。',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700&display=swap',
      },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // SSR環境でのリクエスト間状態汚染を防ぐため、コンポーネント内で初期化する
  const [queryClient] = React.useState(() => createQueryClient())

  React.useEffect(() => {
    persistQueryClient({
      queryClient,
      persister: asyncPersister,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      buster: 'v1',
    })

    // 開発用: コンソールから window.__checkCache() でキャッシュ状態を確認できる
    if (import.meta.env.DEV) {
      (window as any).__checkCache = async () => {
        const { get } = await import('idb-keyval')
        const persisted = await get('REACT_QUERY_OFFLINE_CACHE')
        console.group('[IndexedDB] 永続化キャッシュ')
        if (!persisted) {
          console.log('キャッシュなし')
        } else {
          const queries = (persisted as any)?.clientState?.queries ?? []
          queries.forEach((q: any) => {
            console.group(`🔑 ${q.queryHash}`)
            console.log('status         :', q.state.status)
            console.log('data           :', q.state.data)
            console.log('dataUpdatedAt  :', new Date(q.state.dataUpdatedAt).toLocaleString())
            console.log('isInvalidated  :', q.state.isInvalidated)
            console.groupEnd()
          })
        }
        console.groupEnd()

        console.group('[In-Memory] React Query キャッシュ')
        const inMemory = queryClient.getQueryCache().getAll()
        inMemory.forEach((q) => {
          const s = q.state
          console.group(`🔑 ${JSON.stringify(q.queryKey)}`)
          console.log('status         :', s.status)
          console.log('data           :', s.data)
          console.log('dataUpdatedAt  :', new Date(s.dataUpdatedAt).toLocaleString())
          console.log('fetchStatus    :', s.fetchStatus)
          console.groupEnd()
        })
        console.groupEnd()
      }
      console.log('[dev] window.__checkCache() でキャッシュを確認できます')
    }
  }, [])

  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
