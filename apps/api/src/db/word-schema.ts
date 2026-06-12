import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export const wordSet = sqliteTable(
  "word_set",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // フィールド設定をJSON文字列で保存 (表示/非表示、並び順)
    settings: text("settings"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("word_set_user_id_idx").on(table.userId)],
);

export const word = sqliteTable(
  "word",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    wordSetId: text("word_set_id")
      .notNull()
      .references(() => wordSet.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    locationLabel: text("location_label"),
    imageKey: text("image_key"),
    isMastered: integer("is_mastered", { mode: "boolean" })
      .default(false)
      .notNull(),
    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("word_user_id_idx").on(table.userId),
    index("word_word_set_id_idx").on(table.wordSetId),
  ],
);

export const wordMeaning = sqliteTable(
  "word_meaning",
  {
    id: text("id").primaryKey(),
    wordId: text("word_id")
      .notNull()
      .references(() => word.id, { onDelete: "cascade" }),
    // 意味
    meaning: text("meaning").notNull(),
    // 品詞
    partOfSpeech: text("part_of_speech"),
    // 発音記号
    phonetic: text("phonetic"),
    // 例文
    example: text("example"),
    // コロケーション
    collocation: text("collocation"),
    // 類義語
    synonym: text("synonym"),
    // 語源
    etymology: text("etymology"),
    // 出典
    source: text("source"),
    // 意味の番号
    slot: integer("slot").notNull(),
    // 4択クイズで必要→全ての意味がisRemembered: trueになったら、isMastered: true
    isRemembered: integer("is_remembered", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("word_meaning_word_id_idx").on(table.wordId),
    uniqueIndex("word_meaning_word_id_slot_unique").on(table.wordId, table.slot),
    check("word_meaning_slot_range_check", sql`${table.slot} >= 1 AND ${table.slot} <= 5`),
  ],
);

// リレーション設定
export const userWordSetRelations = relations(user, ({ many }) => ({
  wordSets: many(wordSet),
  words: many(word),
}));

export const wordSetRelations = relations(wordSet, ({ one, many }) => ({
  user: one(user, {
    fields: [wordSet.userId],
    references: [user.id],
  }),
  words: many(word),
}));

export const wordRelations = relations(word, ({ one, many }) => ({
  user: one(user, {
    fields: [word.userId],
    references: [user.id],
  }),
  wordSet: one(wordSet, {
    fields: [word.wordSetId],
    references: [wordSet.id],
  }),
  meanings: many(wordMeaning),
}));

export const wordMeaningRelations = relations(wordMeaning, ({ one }) => ({
  word: one(word, {
    fields: [wordMeaning.wordId],
    references: [word.id],
  }),
}));
