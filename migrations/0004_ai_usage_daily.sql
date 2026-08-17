CREATE TABLE `ai_usage_daily` (
	`usage_date` text NOT NULL,
	`model` text NOT NULL,
	`api_request_count` integer DEFAULT 0 NOT NULL,
	`successful_question_count` integer DEFAULT 0 NOT NULL,
	`failed_question_count` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`usage_date`, `model`)
);
