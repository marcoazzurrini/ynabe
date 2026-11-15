CREATE TABLE `passkey_challenges` (
	`challenge` text NOT NULL,
	`email` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`counter` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`email` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`transports` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `passkeys_email` ON `passkeys` (`email`);--> statement-breakpoint
CREATE TABLE `second_steps` (
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`hash` text PRIMARY KEY NOT NULL
);
