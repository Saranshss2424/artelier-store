CREATE TABLE `allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`artist_id` text NOT NULL,
	`account` text NOT NULL,
	`gross` integer NOT NULL,
	`net` integer NOT NULL,
	`commission_bps` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `allocations_order` ON `allocations` (`order_id`);--> statement-breakpoint
CREATE TABLE `artists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`account` text NOT NULL,
	`commission_bps` integer NOT NULL,
	`created` integer NOT NULL,
	CONSTRAINT "commission_range" CHECK("artists"."commission_bps" >= 0 AND "artists"."commission_bps" <= 10000)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`status` text NOT NULL,
	`customer` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`payload` text,
	`provider_id` text,
	`first_attempt` integer,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_state` ON `notifications` (`state`,`created`);--> statement-breakpoint
CREATE TABLE `product_artists` (
	`product_id` text PRIMARY KEY NOT NULL,
	`artist_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`order_id` text PRIMARY KEY NOT NULL,
	`awb` text NOT NULL,
	`status` text DEFAULT 'Awaiting tracking' NOT NULL,
	`checked` integer DEFAULT 0 NOT NULL,
	`delivered` integer,
	`detail` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipments_awb_unique` ON `shipments` (`awb`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`order_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`payload` text NOT NULL,
	`result` text,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER notify_order_event AFTER INSERT ON order_events BEGIN
 INSERT INTO notifications(id,order_id,status,customer,created)
 SELECT NEW.id,NEW.order_id,NEW.status,customer,NEW.created FROM orders WHERE id=NEW.order_id;
END;
--> statement-breakpoint
CREATE TRIGGER allocate_attempt AFTER INSERT ON payment_attempts BEGIN
 INSERT INTO allocations(id,order_id,product_id,artist_id,account,gross,net,commission_bps)
 SELECT NEW.id||':'||json_extract(j.value,'$.id'),NEW.id,json_extract(j.value,'$.id'),a.id,a.account,
 json_extract(j.value,'$.price')*json_extract(j.value,'$.qty'),
 CAST(json_extract(j.value,'$.price')*json_extract(j.value,'$.qty')*(10000-a.commission_bps)/10000 AS INTEGER),a.commission_bps
 FROM json_each(NEW.items) j JOIN product_artists p ON p.product_id=json_extract(j.value,'$.id') JOIN artists a ON a.id=p.artist_id;
END;
--> statement-breakpoint
CREATE TRIGGER allocate_order AFTER INSERT ON orders WHEN NOT EXISTS(SELECT 1 FROM payment_attempts WHERE id=NEW.id) BEGIN
 INSERT INTO allocations(id,order_id,product_id,artist_id,account,gross,net,commission_bps)
 SELECT NEW.id||':'||json_extract(j.value,'$.id'),NEW.id,json_extract(j.value,'$.id'),a.id,a.account,
 json_extract(j.value,'$.price')*json_extract(j.value,'$.qty'),
 CAST(json_extract(j.value,'$.price')*json_extract(j.value,'$.qty')*(10000-a.commission_bps)/10000 AS INTEGER),a.commission_bps
 FROM json_each(NEW.items) j JOIN product_artists p ON p.product_id=json_extract(j.value,'$.id') JOIN artists a ON a.id=p.artist_id;
END;
