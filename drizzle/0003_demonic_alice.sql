CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available` integer NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`last_error` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_ready` ON `jobs` (`state`,`available`);--> statement-breakpoint
CREATE INDEX `jobs_lease` ON `jobs` (`state`,`lease_until`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`status` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_order_created` ON `order_events` (`order_id`,`created`);--> statement-breakpoint
ALTER TABLE `orders` ADD `carrier` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_number` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_url` text;--> statement-breakpoint
CREATE INDEX `orders_session_created` ON `orders` (`session`,`created`);--> statement-breakpoint
CREATE INDEX `orders_gateway` ON `orders` (`gateway_order_id`);--> statement-breakpoint
CREATE TRIGGER orders_history_insert AFTER INSERT ON orders BEGIN
 INSERT INTO order_events(id,order_id,status,created) VALUES(lower(hex(randomblob(16))),NEW.id,NEW.status,CAST(strftime('%s','now') AS INTEGER)*1000);
END;
--> statement-breakpoint
CREATE TRIGGER orders_history_update AFTER UPDATE OF status ON orders WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO order_events(id,order_id,status,created) VALUES(lower(hex(randomblob(16))),NEW.id,NEW.status,CAST(strftime('%s','now') AS INTEGER)*1000);
END;
