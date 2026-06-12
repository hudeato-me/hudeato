import { Hono } from "hono";
import { Bindings, WordsRouteVariables } from "../types";
import { getWordSets, createWordSet, updateWordSet, removeWordSet } from "../modules/word/service";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { handleZodError } from "../utils/error-validator";

const wordSetSettingsItemSchema = z.object({
	key: z.string(),
	label: z.string(),
	type: z.enum(["text", "textarea"]),
	visible: z.boolean(),
	order: z.number(),
});

const wordSetMutationSchema = z.object({
	name: z.string().min(1, "セット名は1文字以上必要です").max(100),
	settings: z.array(wordSetSettingsItemSchema).optional(),
});

const wordSets = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()

	// ユーザーのwordSet一覧を取得
	.get("/", async (c) => {
		const result = await getWordSets(
			c.get("db"),
			c.get("userId"),
		);
		return c.json(result);
	})
	// wordSet作成
	.post(
		"/",
		zValidator("json", wordSetMutationSchema, handleZodError),
		async (c) => {
			const { name } = c.req.valid("json");
			const result = await createWordSet(c.get("db"), c.get("userId"), name);
			return c.json({ error: null, data: result } as const, 201);
		}
	)
	// wordSet更新 (名前と設定)
	.put(
		"/:setId",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("json", wordSetMutationSchema, handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const { name, settings } = c.req.valid("json");
			await updateWordSet(
				c.get("db"),
				c.get("userId"),
				setId,
				name,
				settings ? JSON.stringify(settings) : undefined
			);
			return c.json({ error: null, data: { success: true } } as const);
		}
	)
	// wordSet削除
	.delete(
		"/:setId",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			await removeWordSet(c.get("db"), c.get("userId"), setId);
			return c.json({ error: null, data: { success: true } } as const);
		}
	);

export default wordSets;
