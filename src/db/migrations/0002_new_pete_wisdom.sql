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
ALTER TABLE "customer_service"."tickets" ADD COLUMN "ai_classification" jsonb;--> statement-breakpoint
ALTER TABLE "customer_service"."tickets" ADD COLUMN "ai_routing_suggestion" jsonb;--> statement-breakpoint
ALTER TABLE "customer_service"."tickets" ADD COLUMN "ai_sentiment" varchar(16);--> statement-breakpoint
ALTER TABLE "customer_service"."tickets" ADD COLUMN "ai_sentiment_score" integer;--> statement-breakpoint
ALTER TABLE "customer_service"."tickets" ADD COLUMN "ai_extracted_entities" jsonb;--> statement-breakpoint
ALTER TABLE "customer_service"."tickets" ADD COLUMN "ai_confidence" integer;--> statement-breakpoint
ALTER TABLE "customer_service"."ai_operations" ADD CONSTRAINT "ai_operations_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "customer_service"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service"."suggested_responses" ADD CONSTRAINT "suggested_responses_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "customer_service"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_operations_ticket_id_idx" ON "customer_service"."ai_operations" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ai_operations_operation_idx" ON "customer_service"."ai_operations" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "ai_operations_created_at_idx" ON "customer_service"."ai_operations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "suggested_responses_ticket_id_idx" ON "customer_service"."suggested_responses" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "suggested_responses_selected_idx" ON "customer_service"."suggested_responses" USING btree ("selected");--> statement-breakpoint
CREATE INDEX "tickets_ai_sentiment_idx" ON "customer_service"."tickets" USING btree ("ai_sentiment");