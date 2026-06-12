import { Hono } from "hono";
import { Bindings, WordsRouteVariables } from "../types";
import {
	deleteImage,
	generateObjectKey,
	getImage,
	isOwnObject,
	uploadImage,
	validateImage,
} from "../modules/upload/service";

const upload = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()

	// 画像アップロード
	.post("/", async (c) => {
		const formData = await c.req.formData();
		const file = formData.get("image");
		if (!(file instanceof File)) {
			return c.json({ error: "image field is required", data: null } as const, 400);
		}

		const validationError = validateImage(file);
		if (validationError === "TOO_LARGE") {
			return c.json({ error: "file too large (max 5MB)", data: null } as const, 400);
		}
		if (validationError === "UNSUPPORTED_TYPE") {
			return c.json({ error: `unsupported type: ${file.type}`, data: null } as const, 400);
		}

		const userId = c.get("userId");
		const objectKey = generateObjectKey(userId, file.type);
		await uploadImage(c.env.IMAGES_BUCKET, objectKey, file);

		return c.json({ error: null, data: { objectKey } } as const, 201);
	})

	// 画像取得 (Workerプロキシ)
	.get("/:key{.+}", async (c) => {
		const key = c.req.param("key");
		const userId = c.get("userId");
		if (!isOwnObject(userId, key)) {
			return c.json({ error: "Forbidden", data: null } as const, 403);
		}

		const obj = await getImage(c.env.IMAGES_BUCKET, key);
		if (!obj) {
			return c.json({ error: "Not Found", data: null } as const, 404);
		}

		// workers-typesとDOMのReadableStream型衝突を回避するためのcast (実体は同じ)
		return new Response(obj.body as unknown as ReadableStream, {
			headers: {
				"Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
				"Cache-Control": "private, max-age=300",
			},
		});
	})

	// 画像削除
	.delete("/:key{.+}", async (c) => {
		const key = c.req.param("key");
		const userId = c.get("userId");
		if (!isOwnObject(userId, key)) {
			return c.json({ error: "Forbidden", data: null } as const, 403);
		}

		await deleteImage(c.env.IMAGES_BUCKET, key);
		return c.json({ error: null, data: { success: true } } as const);
	});

export default upload;
