CREATE TABLE `agent_messages` (
	`at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`text` text NOT NULL,
	`trigger` text DEFAULT 'chat' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_messages_at` ON `agent_messages` (`at`);--> statement-breakpoint
CREATE TABLE `agent_notes` (
	`content` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`up_to` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent_proposals` (
	`at` integer NOT NULL,
	`changes` text NOT NULL,
	`footnote` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`lines` text NOT NULL,
	`message_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`title` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_proposals_message` ON `agent_proposals` (`message_id`);