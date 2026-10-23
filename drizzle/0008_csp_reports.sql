CREATE TABLE IF NOT EXISTS `csp_reports` (
	`directive` text NOT NULL,
	`blocked` text NOT NULL,
	`path` text NOT NULL,
	`disposition` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	PRIMARY KEY(`directive`, `blocked`, `path`, `disposition`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `csp_reports_last_seen_idx` ON `csp_reports` (`last_seen`);