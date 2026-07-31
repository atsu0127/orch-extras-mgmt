CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concert_id` integer NOT NULL,
	`title` text(100) NOT NULL,
	`body` text(1000) NOT NULL,
	`url` text(2000),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`concert_id`) REFERENCES `concerts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `announcements_concert_created_idx` ON `announcements` (`concert_id`,`created_at`);