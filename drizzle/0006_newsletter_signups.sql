CREATE TABLE IF NOT EXISTS `newsletter_signups` (
	`day` text NOT NULL,
	`ref` text NOT NULL,
	`form` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `ref`, `form`)
);
