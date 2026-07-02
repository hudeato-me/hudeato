import type { Queue, R2Bucket } from "@cloudflare/workers-types";
import type { WordCompletionMessage } from "../modules/ai/completion";

export type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN: string;
	POLAR_ACCESS_TOKEN: string;
	UPSTASH_REDIS_REST_URL: string;
	UPSTASH_REDIS_REST_TOKEN: string;
	IMAGES_BUCKET: R2Bucket;
	GEMINI_API_KEY: string;
	// AI補完ジョブのキュー（producer）。consumer は index.ts の queue ハンドラ。
	WORD_COMPLETION_QUEUE: Queue<WordCompletionMessage>;
};
