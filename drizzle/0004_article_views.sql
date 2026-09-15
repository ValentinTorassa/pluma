CREATE TABLE IF NOT EXISTS `article_views` (
	`article_id` text NOT NULL,
	`day` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`uniques` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`article_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `article_view_hits` (
	`article_id` text NOT NULL,
	`day` text NOT NULL,
	`ip_hash` text NOT NULL,
	PRIMARY KEY(`article_id`, `day`, `ip_hash`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `article_views_day_idx` ON `article_views` (`day`);
