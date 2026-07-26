CREATE TABLE `concerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(100) NOT NULL,
	`performance_date` text,
	`venue_id` integer,
	`attendance_url` text(2000),
	`attendance_note` text(500),
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`role` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `link_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`url` text(2000) NOT NULL,
	`verdict` text NOT NULL,
	`http_status` integer,
	`detail` text,
	`checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `link_checks_target_unique` ON `link_checks` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip` text NOT NULL,
	`attempted_at` text NOT NULL,
	`success` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_ip_attempted_at_idx` ON `login_attempts` (`ip`,`attempted_at`);--> statement-breakpoint
CREATE TABLE `pieces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concert_id` integer NOT NULL,
	`title` text(100) NOT NULL,
	`composer` text(100),
	`sort_order` integer DEFAULT 0 NOT NULL,
	`bowing_url` text(2000),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`concert_id`) REFERENCES `concerts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pieces_concert_sort_idx` ON `pieces` (`concert_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `practice_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`practice_id` integer NOT NULL,
	`title` text(100) NOT NULL,
	`url` text(2000) NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`practice_id`) REFERENCES `practices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `practice_media_practice_sort_idx` ON `practice_media` (`practice_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `practices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concert_id` integer NOT NULL,
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`venue_id` integer,
	`detail` text(2000),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`concert_id`) REFERENCES `concerts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `practices_concert_date_idx` ON `practices` (`concert_id`,`date`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(100) NOT NULL,
	`address` text(200) NOT NULL,
	`note` text(500),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
