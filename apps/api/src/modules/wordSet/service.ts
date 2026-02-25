import { createDb } from "../../db";
import { findWordSets } from "./repository";

type Db = ReturnType<typeof createDb>;

export const getWordSets = async (
	db: Db,
	userId: string,
) => {
	const wordSets = await findWordSets(db, userId);
	return wordSets;
};
