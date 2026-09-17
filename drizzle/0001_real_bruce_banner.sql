ALTER TABLE `orders` ADD `payment_method` text DEFAULT 'cod' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_status` text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `gateway_order_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_session_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `gateway_payment_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `stock_released` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` integer;--> statement-breakpoint
CREATE INDEX `orders_payment_status` ON `orders` (`payment_status`,`created`);