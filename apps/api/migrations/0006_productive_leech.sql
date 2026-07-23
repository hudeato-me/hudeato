CREATE TABLE `quiz_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`word_set_id` text NOT NULL,
	`scope` text NOT NULL,
	`direction` text NOT NULL,
	`time_limit_seconds` integer NOT NULL,
	`correct_count` integer NOT NULL,
	`total_count` integer NOT NULL,
	`items_json` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_set_id`) REFERENCES `word_set`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quiz_session_word_set_id_idx` ON `quiz_session` (`word_set_id`);--> statement-breakpoint
CREATE INDEX `quiz_session_user_id_idx` ON `quiz_session` (`user_id`);