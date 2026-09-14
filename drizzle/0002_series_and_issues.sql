CREATE TABLE `series` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`planned_parts` integer,
	`upcoming` text DEFAULT '[]' NOT NULL,
	`facts` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `series_slug_unique` ON `series` (`slug`);--> statement-breakpoint
ALTER TABLE `articles` ADD `series_id` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `series_order` integer;--> statement-breakpoint
ALTER TABLE `articles` ADD `issue_number` integer;--> statement-breakpoint
CREATE INDEX `articles_series_idx` ON `articles` (`series_id`,`series_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `articles_issue_number_unique` ON `articles` (`issue_number`);