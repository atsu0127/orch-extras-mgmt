CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`admin_email` text(254),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `concert_resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concert_id` integer NOT NULL,
	`title` text(100) NOT NULL,
	`url` text(2000) NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`concert_id`) REFERENCES `concerts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `concert_resources_concert_sort_idx` ON `concert_resources` (`concert_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `concerts` ADD `note` text(2000);