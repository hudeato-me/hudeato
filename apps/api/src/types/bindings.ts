import type { R2Bucket } from "@cloudflare/workers-types";

export type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN: string;
	POLAR_ACCESS_TOKEN: string;
	UPSTASH_REDIS_REST_URL: string;
	UPSTASH_REDIS_REST_TOKEN: string;
	IMAGES_BUCKET: R2Bucket;
};
