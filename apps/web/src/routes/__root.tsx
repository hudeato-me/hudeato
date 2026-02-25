/// <reference types="vite/client" />
import {
    HeadContent,
    Scripts,
    createRootRoute,
} from '@tanstack/react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import * as React from 'react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import appCss from '~/styles/app.css?url'
import { seo } from '~/utils/seo'
import { queryClient, asyncPersister } from '~/lib/query-client'

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
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: asyncPersister,
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
            buster: 'v1',
          }}
        >
          {children}
        </PersistQueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
