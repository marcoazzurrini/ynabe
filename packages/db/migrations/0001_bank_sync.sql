CREATE TABLE `bank_links` (
	`account_id` text NOT NULL,
	`since` text NOT NULL,
	`source_id` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `source_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_source` ON `transactions` (`source_id`);