import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Bindings, WordsRouteVariables } from "../types";
import { getWordById, getWords, searchWordList, createWord, updateWord, removeWord } from "../modules/word/service";
import { deleteImage } from "../modules/upload/service";
import { handleZodError } from "../utils/error-validator";

// 単語の意味 (WordMeaning) スキーマ
const wordMeaningSchema = z.object({
	meaning: z.string().min(1),
	partOfSpeech: z.string().nullable().optional(),
	phonetic: z.string().nullable().optional(),
	example: z.string().nullable().optional(),
	collocation: z.string().nullable().optional(),
	synonym: z.string().nullable().optional(),
	etymology: z.string().nullable().optional(),
	source: z.string().nullable().optional(),
	slot: z.number().int().min(1).max(5),
});

// 単語の作成/更新用スキーマ
const wordMutationSchema = z.object({
	text: z.string().min(1),
	locationLabel: z.string().nullable().optional(),
	imageKey: z.string().nullable().optional(),
	meanings: z.array(wordMeaningSchema).min(1),
});

const words = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()

	// セット内の単語一覧を取得
	.get(
		"/",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("query", z.object({ limit: z.coerce.number().optional().default(50), offset: z.coerce.number().optional().default(0) }), handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const { limit, offset } = c.req.valid("query");
			const result = await getWords(c.get("db"), c.get("userId"), { wordSetId: setId, limit, offset });
			return c.json(result);
		}
	)
	// 単語検索 (/:wordId の上に定義する)
	.get(
		"/search",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("query", z.object({
			q: z.string(),
			limit: z.coerce.number().optional().default(10)
		}), handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const { q, limit } = c.req.valid("query");

			const results = await searchWordList(c.get("db"), c.get("userId"), setId, q, limit);
			return c.json(results);
		}
	)
	// 単語詳細情報の取得 
	.get(
		"/:wordId",
		// パスパラメータの検証
		zValidator("param", z.object({ setId: z.string(), wordId: z.string() }), handleZodError),
		async (c) => {
			const { setId, wordId } = c.req.valid("param");
			const result = await getWordById(c.get("db"), c.get("userId"), setId, wordId);
			if (!result) {
				return c.json({ error: "Not Found", data: null } as const, 404);
			}
			return c.json({ error: null, data: result } as const);
		}
	)
	// 単語作成
	.post(
		"/",
		zValidator("param", z.object({ setId: z.string() }), handleZodError),
		zValidator("json", wordMutationSchema, handleZodError),
		async (c) => {
			const { setId } = c.req.valid("param");
			const { text, locationLabel, imageKey, meanings } = c.req.valid("json");
			const result = await createWord(c.get("db"), c.get("userId"), setId, { text, locationLabel, imageKey }, meanings);
			return c.json({ error: null, data: result } as const, 201);
		}
	)
	// 単語更新
	.put(
		"/:wordId",
		zValidator("param", z.object({ setId: z.string(), wordId: z.string() }), handleZodError),
		zValidator("json", wordMutationSchema, handleZodError),
		async (c) => {
			const { setId, wordId } = c.req.valid("param");
			const { text, locationLabel, imageKey, meanings } = c.req.valid("json");
			await updateWord(c.get("db"), c.get("userId"), setId, wordId, { text, locationLabel, imageKey }, meanings);
			return c.json({ error: null, data: { success: true } } as const);
		}
	)
	// 単語削除
	.delete(
		"/:wordId",
		zValidator("param", z.object({ setId: z.string(), wordId: z.string() }), handleZodError),
		async (c) => {
			const { setId, wordId } = c.req.valid("param");
			const db = c.get("db");
			const userId = c.get("userId");

			const target = await getWordById(db, userId, setId, wordId);

			await removeWord(db, userId, setId, wordId);

			if (target?.imageKey) {
				deleteImage(c.env.IMAGES_BUCKET, target.imageKey).catch((err) =>
					console.error("Failed to delete image from R2", target.imageKey, err),
				);
			}

			return c.json({ error: null, data: { success: true } } as const);
		}
	);

export default words;