CREATE TABLE `word` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`word_set_id` text NOT NULL,
	`text` text NOT NULL,
	`primary_meaning` text,
	`location_label` text,
	`image_key` text,
	`is_mastered` integer DEFAULT false NOT NULL,
	`last_reviewed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_set_id`) REFERENCES `word_set`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `word_user_id_idx` ON `word` (`user_id`);--> statement-breakpoint
CREATE INDEX `word_word_set_id_idx` ON `word` (`word_set_id`);--> statement-breakpoint
CREATE TABLE `word_meaning` (
	`id` text PRIMARY KEY NOT NULL,
	`word_id` text NOT NULL,
	`meaning` text NOT NULL,
	`part_of_speech` text,
	`phonetic` text,
	`example` text,
	`collocation` text,
	`synonym` text,
	`etymology` text,
	`source` text,
	`slot` integer NOT NULL,
	`is_remembered` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`word_id`) REFERENCES `word`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "word_meaning_slot_range_check" CHECK("word_meaning"."slot" >= 1 AND "word_meaning"."slot" <= 5)
);
--> statement-breakpoint
CREATE INDEX `word_meaning_word_id_idx` ON `word_meaning` (`word_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `word_meaning_word_id_slot_unique` ON `word_meaning` (`word_id`,`slot`);--> statement-breakpoint
CREATE TABLE `word_set` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `word_set_user_id_idx` ON `word_set` (`user_id`);