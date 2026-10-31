CREATE TABLE `accounts` (
	`closed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'checking' NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`amount` integer NOT NULL,
	`category_id` text NOT NULL,
	`month` text NOT NULL,
	PRIMARY KEY(`category_id`, `month`),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`group_id` text NOT NULL,
	`icon` text,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`target_amount` integer,
	`target_by` text,
	`target_due_day` integer,
	`target_kind` text,
	FOREIGN KEY (`group_id`) REFERENCES `category_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_group` ON `categories` (`group_id`);--> statement-breakpoint
CREATE TABLE `category_groups` (
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`account_id` text NOT NULL,
	`amount` integer NOT NULL,
	`category_id` text,
	`cleared` text DEFAULT 'uncleared' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`date` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`memo` text,
	`payee` text NOT NULL,
	`transfer_account_id` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transfer_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_account` ON `transactions` (`account_id`);