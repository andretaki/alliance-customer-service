CREATE TYPE "public"."address_type" AS ENUM('shipping', 'billing', 'both');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('pending', 'synced', 'failed', 'disabled');--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
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
	"data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_synced_at" timestamp,
	CONSTRAINT "customers_email_unique" UNIQUE("email"),
	CONSTRAINT "customers_shopify_id_unique" UNIQUE("shopify_id"),
	CONSTRAINT "customers_quickbooks_id_unique" UNIQUE("quickbooks_id")
);
--> statement-breakpoint
CREATE TABLE "customer_service"."ai_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer,
	"call_id" varchar(64),
	"operation" varchar(64) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"model" varchar(64),
	"input" jsonb NOT NULL,
	"output" jsonb,
	"success" boolean NOT NULL,
	"response_time_ms" integer,
	"error_message" text,
	"tokens_used" integer,
	"cost_estimate" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_service"."attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"type" varchar(24) NOT NULL,
	"url" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_service"."calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"call_id" varchar(64) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"from_number" varchar(32) NOT NULL,
	"to_number" varchar(32) NOT NULL,
	"agent_ext" varchar(16),
	"agent_name" varchar(128),
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"recording_url" text,
	"raw" jsonb,
	CONSTRAINT "calls_call_id_unique" UNIQUE("call_id")
);
--> statement-breakpoint
CREATE TABLE "customer_service"."routing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"predicate" jsonb NOT NULL,
	"assignees" jsonb NOT NULL,
	"active" boolean DEFAULT true,
	"order" integer DEFAULT 100
);
--> statement-breakpoint
CREATE TABLE "customer_service"."suggested_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"response_text" text NOT NULL,
	"tone" varchar(24) NOT NULL,
	"confidence" integer NOT NULL,
	"tags" jsonb,
	"selected" boolean DEFAULT false,
	"agent_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"selected_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customer_service"."ticket_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"action_type" varchar(64) NOT NULL,
	"external_id" varchar(128),
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_service"."tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"call_id" varchar(64),
	"request_type" varchar(32) NOT NULL,
	"status" varchar(24) DEFAULT 'open' NOT NULL,
	"priority" varchar(16) DEFAULT 'normal',
	"summary" text,
	"customer_email" varchar(256),
	"customer_phone" varchar(32),
	"customer_name" varchar(256),
	"data" jsonb,
	"assignee" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_response_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"breached" boolean DEFAULT false,
	"ai_classification" jsonb,
	"ai_routing_suggestion" jsonb,
	"ai_sentiment" varchar(16),
	"ai_sentiment_score" integer,
	"ai_extracted_entities" jsonb,
	"ai_confidence" integer
);
--> statement-breakpoint
CREATE TABLE "customer_service"."transcripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"call_id" varchar(64) NOT NULL,
	"text" text NOT NULL,
	"summary" text,
	"sentiment" varchar(16),
	"model_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sync_log" ADD CONSTRAINT "customer_sync_log_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service"."ai_operations" ADD CONSTRAINT "ai_operations_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "customer_service"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service"."attachments" ADD CONSTRAINT "attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "customer_service"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service"."suggested_responses" ADD CONSTRAINT "suggested_responses_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "customer_service"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service"."ticket_actions" ADD CONSTRAINT "ticket_actions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "customer_service"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_operations_ticket_id_idx" ON "customer_service"."ai_operations" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ai_operations_operation_idx" ON "customer_service"."ai_operations" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "ai_operations_created_at_idx" ON "customer_service"."ai_operations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "attachments_ticket_id_idx" ON "customer_service"."attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "calls_call_id_idx" ON "customer_service"."calls" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "calls_from_idx" ON "customer_service"."calls" USING btree ("from_number");--> statement-breakpoint
CREATE INDEX "suggested_responses_ticket_id_idx" ON "customer_service"."suggested_responses" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "suggested_responses_selected_idx" ON "customer_service"."suggested_responses" USING btree ("selected");--> statement-breakpoint
CREATE INDEX "ticket_actions_ticket_id_idx" ON "customer_service"."ticket_actions" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "customer_service"."tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_assignee_idx" ON "customer_service"."tickets" USING btree ("assignee");--> statement-breakpoint
CREATE INDEX "tickets_call_id_idx" ON "customer_service"."tickets" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "tickets_ai_sentiment_idx" ON "customer_service"."tickets" USING btree ("ai_sentiment");--> statement-breakpoint
CREATE INDEX "transcripts_call_id_idx" ON "customer_service"."transcripts" USING btree ("call_id");