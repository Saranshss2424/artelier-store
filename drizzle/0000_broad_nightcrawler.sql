CREATE TABLE `carts` (
	`id` text PRIMARY KEY NOT NULL,
	`items` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`customer` text NOT NULL,
	`items` text NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orders_created` ON `orders` (`created`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	`image` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL,
	CONSTRAINT "stock_nonnegative" CHECK("products"."stock" >= 0),
	CONSTRAINT "price_positive" CHECK("products"."price" > 0)
);
--> statement-breakpoint
CREATE INDEX `products_active_created` ON `products` (`active`,`created`);