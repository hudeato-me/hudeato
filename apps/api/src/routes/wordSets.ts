import { Hono } from "hono";
import { Bindings, WordsRouteVariables } from "../types";
import { getWordSets } from "../modules/wordSet/service";

const wordSets = new Hono<{ Bindings: Bindings; Variables: WordsRouteVariables }>()

	// ユーザーのwordSet一覧を取得
	.get("/", async (c) => {
		const result = await getWordSets(
			c.get("db"),
			c.get("userId"),
		);
		return c.json(result);
	});

export default wordSets;
