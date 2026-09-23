CREATE TABLE `seller_products` (
	`product_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `seller_products_user` ON `seller_products` (`user_id`);--> statement-breakpoint
CREATE TABLE `seller_uploads` (
	`image` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sellers` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`bio` text NOT NULL,
	`portfolio` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`artist_id` text,
	`reply` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
