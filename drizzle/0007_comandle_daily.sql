CREATE TABLE IF NOT EXISTS `comandle_daily` (
	`day` text NOT NULL,
	`event` text NOT NULL,
	`key` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `event`, `key`)
);
