import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5,    // 5 minutes
    },
  },
});

// Tanstack Queryが呼び出すメソッドをidb-keyvalのメソッドを使って実装する
export const asyncPersister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => await get(key),
    setItem: async (key, value) => await set(key, value),
    removeItem: async (key) => await del(key),
  },
  // idb-keyvalはオブジェクトを直接保存できるため、JSON文字列化のオーバーヘッドをバイパスする
  serialize: (client) => client as unknown as string,
  deserialize: (cachedString) => cachedString as unknown as any,
});
