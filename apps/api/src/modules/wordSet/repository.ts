import { desc, eq } from "drizzle-orm";
import { createDb, wordSet } from "../../db";

type Db = ReturnType<typeof createDb>;

// ユーザーのwordSet一覧を取得
export const findWordSets = async (db: Db, userId: string) => {
	return db.query.wordSet.findMany({
		where: eq(wordSet.userId, userId),
		orderBy: [desc(wordSet.createdAt)],
		columns: {
			id: true,
			name: true,
			createdAt: true,
			updatedAt: true,
		},
	});
};
