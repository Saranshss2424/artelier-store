CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`details` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `addresses_user` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE TABLE `order_owners` (
	`order_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `owners_user` ON `order_owners` (`user_id`);--> statement-breakpoint
CREATE TABLE `returns` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'Requested' NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `returns_order_id_unique` ON `returns` (`order_id`);--> statement-breakpoint
CREATE INDEX `returns_user` ON `returns` (`user_id`,`created`);--> statement-breakpoint
CREATE INDEX `returns_status` ON `returns` (`status`,`created`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`rating` integer NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	CONSTRAINT "rating_range" CHECK("reviews"."rating" >= 1 AND "reviews"."rating" <= 5)
);
--> statement-breakpoint
CREATE INDEX `reviews_product_status` ON `reviews` (`product_id`,`status`,`created`);--> statement-breakpoint
CREATE INDEX `reviews_user` ON `reviews` (`user_id`);--> statement-breakpoint
CREATE TABLE `wishlist` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wishlist_user` ON `wishlist` (`user_id`,`created`);