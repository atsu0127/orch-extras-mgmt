CREATE TABLE `ai_ask_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip` text NOT NULL,
	`attempted_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_ask_attempts_ip_attempted_at_idx` ON `ai_ask_attempts` (`ip`,`attempted_at`);--> statement-breakpoint
ALTER TABLE `ai_usage_daily` ADD `accepted_question_count` integer DEFAULT 0 NOT NULL;