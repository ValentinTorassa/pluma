CREATE TABLE IF NOT EXISTS `book_clicks` (
	`day` text NOT NULL,
	`event` text NOT NULL,
	`ref` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `event`, `ref`)
);
