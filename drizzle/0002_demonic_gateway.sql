CREATE TABLE `payment_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`provider_order` text NOT NULL,
	`payment_id` text,
	`customer` text NOT NULL,
	`items` text NOT NULL,
	`total` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_provider_order_unique` ON `payment_attempts` (`provider_order`);--> statement-breakpoint
CREATE INDEX `attempts_state_expires` ON `payment_attempts` (`state`,`expires`);--> statement-breakpoint
CREATE INDEX `attempts_session_created` ON `payment_attempts` (`session`,`created`);