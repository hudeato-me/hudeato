import { deleteObject, getObject, putObject } from "./repository";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/heic",
	"image/heif",
]);

export type ValidationError = "TOO_LARGE" | "UNSUPPORTED_TYPE";

export const validateImage = (file: File): ValidationError | null => {
	if (file.size > MAX_SIZE_BYTES) return "TOO_LARGE";
	if (!ALLOWED_TYPES.has(file.type)) return "UNSUPPORTED_TYPE";
	return null;
};

export const generateObjectKey = (userId: string, contentType: string): string => {
	const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
	const uuid = crypto.randomUUID();
	return `users/${userId}/${uuid}.${ext}`;
};

// 自分のオブジェクトかどうかを prefix で判定 (他人のobjectKeyを叩かれても403で守る)
export const isOwnObject = (userId: string, key: string): boolean => {
	return key.startsWith(`users/${userId}/`);
};

export const uploadImage = async (
	bucket: R2Bucket,
	key: string,
	file: File,
): Promise<void> => {
	await putObject(bucket, key, file);
};

export const getImage = async (bucket: R2Bucket, key: string) => {
	return await getObject(bucket, key);
};

export const deleteImage = async (bucket: R2Bucket, key: string): Promise<void> => {
	await deleteObject(bucket, key);
};
