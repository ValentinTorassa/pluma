CREATE TABLE IF NOT EXISTS `page_views` (
	`page` text NOT NULL,
	`day` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`uniques` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`page`, `day`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `page_view_hits` (
	`page` text NOT NULL,
	`day` text NOT NULL,
	`ip_hash` text NOT NULL,
	PRIMARY KEY(`page`, `day`, `ip_hash`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `page_views_day_idx` ON `page_views` (`day`);
