CREATE TABLE IF NOT EXISTS `comandle_hourly` (
	`day` text NOT NULL,
	`hour` text NOT NULL,
	`event` text NOT NULL,
	`key` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `hour`, `event`, `key`)
);
