import { relations, sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

// 単語埋め込みの次元数（Gemini text-embedding 系の標準次元）。
// P0 ではダミーベクトルで近傍検索の疎通のみ確認する。
export const EMBEDDING_DIM = 768;

// Turso(libSQL) の Vector 型カラム。Drizzle にネイティブ型が無いため
// customType で `F32_BLOB(次元数)` をそのまま列定義として出力する。
// 値の挿入・検索は vector32() / vector_distance_cos() を使い repository 側で行う。
// 値の読み書きは vector32()/vector_distance_cos() を使うため、ここでは
// node の Buffer 型に依存しない汎用的な型(number[] / string)にしておく。
const float32Blob = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `F32_BLOB(${EMBEDDING_DIM})`;
  },
});

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

// 単語ごとのレビュー状態（間隔反復のスケジューリング器）。
// word に対して 1:1。実アルゴリズムは P4 で実装し、ここでは器だけ用意する。
export const reviewState = sqliteTable("review_state", {
  wordId: text("word_id")
    .primaryKey()
    .references(() => word.id, { onDelete: "cascade" }),
  // 次回出題日（未スケジュールは null）
  nextReviewAt: integer("next_review_at", { mode: "timestamp_ms" }),
  // 現在の間隔（日数）
  intervalDays: integer("interval_days").default(0).notNull(),
  // 難易度係数（SM-2系）
  easeFactor: real("ease_factor").default(2.5).notNull(),
  // 連続正解回数
  reps: integer("reps").default(0).notNull(),
  // 忘却回数
  lapses: integer("lapses").default(0).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// レビュー履歴（正誤・モード別の記録、分析と忘却曲線の入力）。
export const reviewLog = sqliteTable(
  "review_log",
  {
    id: text("id").primaryKey(),
    wordId: text("word_id")
      .notNull()
      .references(() => word.id, { onDelete: "cascade" }),
    // カードは意味ごとに記録するため nullable
    meaningId: text("meaning_id").references(() => wordMeaning.id, {
      onDelete: "cascade",
    }),
    // 'quiz' | 'flashcard'
    mode: text("mode").notNull(),
    // 'correct' | 'wrong' | 'known' | 'unknown'
    result: text("result").notNull(),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("review_log_word_id_idx").on(table.wordId),
    check("review_log_mode_check", sql`${table.mode} IN ('quiz', 'flashcard')`),
    check(
      "review_log_result_check",
      sql`${table.result} IN ('correct', 'wrong', 'known', 'unknown')`,
    ),
  ],
);

// 単語のベクトル埋め込み（クイズのディストラクタ近傍検索用）。word に対して 1:1。
export const wordEmbedding = sqliteTable("word_embedding", {
  wordId: text("word_id")
    .primaryKey()
    .references(() => word.id, { onDelete: "cascade" }),
  // F32_BLOB(EMBEDDING_DIM) の Turso Vector 列
  embedding: float32Blob("embedding").notNull(),
  // 生成モデル名
  model: text("model").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

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
  reviewState: one(reviewState, {
    fields: [word.id],
    references: [reviewState.wordId],
  }),
  reviewLogs: many(reviewLog),
  embedding: one(wordEmbedding, {
    fields: [word.id],
    references: [wordEmbedding.wordId],
  }),
}));

export const wordMeaningRelations = relations(wordMeaning, ({ one, many }) => ({
  word: one(word, {
    fields: [wordMeaning.wordId],
    references: [word.id],
  }),
  reviewLogs: many(reviewLog),
}));

export const reviewStateRelations = relations(reviewState, ({ one }) => ({
  word: one(word, {
    fields: [reviewState.wordId],
    references: [word.id],
  }),
}));

export const reviewLogRelations = relations(reviewLog, ({ one }) => ({
  word: one(word, {
    fields: [reviewLog.wordId],
    references: [word.id],
  }),
  meaning: one(wordMeaning, {
    fields: [reviewLog.meaningId],
    references: [wordMeaning.id],
  }),
}));

export const wordEmbeddingRelations = relations(wordEmbedding, ({ one }) => ({
  word: one(word, {
    fields: [wordEmbedding.wordId],
    references: [word.id],
  }),
}));
