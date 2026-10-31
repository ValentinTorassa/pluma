CREATE TABLE IF NOT EXISTS `comandle_rooms` (
	`day` text NOT NULL,
	`room` text NOT NULL,
	`key` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `room`, `key`)
);
