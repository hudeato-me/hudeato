import type { KVNamespace, Queue, R2Bucket } from "@cloudflare/workers-types";
import type { WordCompletionMessage } from "../modules/ai/completion";
import type { AiClient } from "../modules/ai/workers-ai";

export type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN: string;
	POLAR_ACCESS_TOKEN: string;
	UPSTASH_REDIS_REST_URL: string;
	UPSTASH_REDIS_REST_TOKEN: string;
	IMAGES_BUCKET: R2Bucket;
	// Workers AI（意味生成 + 埋め込み）。workers-types の Ai はモデルIDの型マップに
	// 縛られるため、run を緩く受ける AiClient で持つ。
	AI: AiClient;
	// AI生成の意味の共有キャッシュ（Workers KV）。
	MEANING_CACHE: KVNamespace;
	// AI補完ジョブのキュー（producer）。consumer は index.ts の queue ハンドラ。
	WORD_COMPLETION_QUEUE: Queue<WordCompletionMessage>;
	// Google Cloud Text-to-Speech の APIキー。未設定時はTTSを503で無効化する
	// （本番はsecretとして別途設定するためwrangler.tomlには書かない）。
	GOOGLE_TTS_API_KEY?: string;
};
