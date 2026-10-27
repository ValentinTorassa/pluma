CREATE TABLE IF NOT EXISTS `newsletter_rejections` (
	`day` text NOT NULL,
	`reason` text NOT NULL,
	`form` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `reason`, `form`)
);
