CREATE TABLE `review_log` (
	`id` text PRIMARY KEY NOT NULL,
	`word_id` text NOT NULL,
	`meaning_id` text NOT NULL,
	`mode` text NOT NULL,
	`result` text NOT NULL,
	`reviewed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`word_id`) REFERENCES `word`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meaning_id`) REFERENCES `word_meaning`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_log_mode_check" CHECK("review_log"."mode" IN ('quiz', 'flashcard')),
	CONSTRAINT "review_log_result_check" CHECK("review_log"."result" IN ('correct', 'wrong', 'known', 'unknown')),
	CONSTRAINT "review_log_mode_result_check" CHECK(("review_log"."mode" = 'quiz' AND "review_log"."result" IN ('correct', 'wrong')) OR ("review_log"."mode" = 'flashcard' AND "review_log"."result" IN ('known', 'unknown')))
);
--> statement-breakpoint
CREATE INDEX `review_log_word_id_idx` ON `review_log` (`word_id`);--> statement-breakpoint
CREATE TABLE `review_state` (
	`meaning_id` text PRIMARY KEY NOT NULL,
	`next_review_at` integer,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`ease_factor` real DEFAULT 2.5 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`meaning_id`) REFERENCES `word_meaning`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `word_embedding` (
	`word_id` text PRIMARY KEY NOT NULL,
	`embedding` F32_BLOB(768) NOT NULL,
	`model` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`word_id`) REFERENCES `word`(`id`) ON UPDATE no action ON DELETE cascade
);
