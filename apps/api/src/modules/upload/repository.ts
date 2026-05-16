import type { R2Bucket } from "@cloudflare/workers-types";

// R2への純粋なアクセス層 (DBレイヤと同じ立ち位置)

export const putObject = async (
	bucket: R2Bucket,
	key: string,
	file: File,
): Promise<void> => {
	await bucket.put(key, await file.arrayBuffer(), {
		httpMetadata: { contentType: file.type },
	});
};

export const getObject = async (bucket: R2Bucket, key: string) => {
	return await bucket.get(key);
};

export const deleteObject = async (bucket: R2Bucket, key: string): Promise<void> => {
	await bucket.delete(key);
};
