CREATE SCHEMA "customer_service";
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
	"breached" boolean DEFAULT false
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
ALTER TABLE "customer_service"."attachments" ADD CONSTRAINT "attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "customer_service"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service"."ticket_actions" ADD CONSTRAINT "ticket_actions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "customer_service"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_ticket_id_idx" ON "customer_service"."attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "calls_call_id_idx" ON "customer_service"."calls" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "calls_from_idx" ON "customer_service"."calls" USING btree ("from_number");--> statement-breakpoint
CREATE INDEX "ticket_actions_ticket_id_idx" ON "customer_service"."ticket_actions" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "customer_service"."tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_assignee_idx" ON "customer_service"."tickets" USING btree ("assignee");--> statement-breakpoint
CREATE INDEX "tickets_call_id_idx" ON "customer_service"."tickets" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "transcripts_call_id_idx" ON "customer_service"."transcripts" USING btree ("call_id");