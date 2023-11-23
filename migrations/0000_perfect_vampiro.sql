CREATE TABLE `scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` text NOT NULL,
	`score` integer NOT NULL,
	`registered_at` integer NOT NULL
);
