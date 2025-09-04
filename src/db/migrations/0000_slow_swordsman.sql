CREATE TYPE "public"."address_type" AS ENUM('shipping', 'billing', 'both');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('pending', 'synced', 'failed', 'disabled');--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" serial NOT NULL,
	"name" varchar(255),
	"company" varchar(255),
	"country" varchar(100) NOT NULL,
	"address_line_1" varchar(255) NOT NULL,
	"address_line_2" varchar(255),
	"address_line_3" varchar(255),
	"city" varchar(100) NOT NULL,
	"state" varchar(100),
	"postal_code" varchar(20) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"address_type" "address_type" DEFAULT 'shipping',
	"is_default" boolean DEFAULT false,
	"shopify_address_id" bigint,
	"quickbooks_address_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" serial NOT NULL,
	"service" varchar(50) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"external_id" varchar(255),
	"request_data" text,
	"response_data" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"company" varchar(255),
	"phone" varchar(20),
	"status" "customer_status" DEFAULT 'active',
	"shopify_id" bigint,
	"quickbooks_id" varchar(255),
	"shopify_status" "integration_status" DEFAULT 'pending',
	"quickbooks_status" "integration_status" DEFAULT 'pending',
	"source" varchar(50),
	"notes" text,
	"tags" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_synced_at" timestamp,
	CONSTRAINT "customers_email_unique" UNIQUE("email"),
	CONSTRAINT "customers_shopify_id_unique" UNIQUE("shopify_id"),
	CONSTRAINT "customers_quickbooks_id_unique" UNIQUE("quickbooks_id")
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sync_log" ADD CONSTRAINT "customer_sync_log_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;