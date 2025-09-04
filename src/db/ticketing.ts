// Ticketing system database schema
import { pgSchema, pgTable, serial, text, timestamp, varchar, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";

export const customerService = pgSchema("customer_service");

// Calls table - tracks all inbound/outbound calls from 3CX
export const calls = customerService.table("calls", {
  id: serial("id").primaryKey(),
  callId: varchar("call_id", { length: 64 }).notNull().unique(),
  direction: varchar("direction", { length: 10 }).notNull(), // inbound|outbound
  fromNumber: varchar("from_number", { length: 32 }).notNull(),
  toNumber: varchar("to_number", { length: 32 }).notNull(),
  agentExt: varchar("agent_ext", { length: 16 }),
  agentName: varchar("agent_name", { length: 128 }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  recordingUrl: text("recording_url"),
  raw: jsonb("raw"), // full 3CX payload for audit/debug
}, (t) => ({
  callIdIdx: index("calls_call_id_idx").on(t.callId),
  fromIdx: index("calls_from_idx").on(t.fromNumber),
}));

// Tickets table - tracks customer service requests
export const tickets = customerService.table("tickets", {
  id: serial("id").primaryKey(),
  callId: varchar("call_id", { length: 64 }), // nullable (email tickets)
  requestType: varchar("request_type", { length: 32 }).notNull(), // quote|coa|freight|claim|other
  status: varchar("status", { length: 24 }).notNull().default("open"), // open|routed|in_progress|resolved|closed
  priority: varchar("priority", { length: 16 }).default("normal"), // low|normal|high|urgent
  summary: text("summary"),
  customerEmail: varchar("customer_email", { length: 256 }),
  customerPhone: varchar("customer_phone", { length: 32 }),
  customerName: varchar("customer_name", { length: 256 }),
  data: jsonb("data"), // flexible payload (products, qty, ship-to, photos)
  assignee: varchar("assignee", { length: 128 }), // person or team
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  breached: boolean("breached").default(false),
  // AI-enhanced fields
  aiClassification: jsonb("ai_classification"), // AI classification results
  aiRoutingSuggestion: jsonb("ai_routing_suggestion"), // AI routing analysis
  aiSentiment: varchar("ai_sentiment", { length: 16 }), // positive|neutral|negative
  aiSentimentScore: integer("ai_sentiment_score"), // 0-100
  aiExtractedEntities: jsonb("ai_extracted_entities"), // Extracted entities
  aiConfidence: integer("ai_confidence"), // 0-100 confidence score
}, (t) => ({
  statusIdx: index("tickets_status_idx").on(t.status),
  assigneeIdx: index("tickets_assignee_idx").on(t.assignee),
  callIdIdx: index("tickets_call_id_idx").on(t.callId),
  sentimentIdx: index("tickets_ai_sentiment_idx").on(t.aiSentiment),
}));

// Ticket actions table - tracks actions taken on tickets
export const ticketActions = customerService.table("ticket_actions", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  actionType: varchar("action_type", { length: 64 }).notNull(), // shopify_draft|qbo_estimate|email_sent|freight_ping
  externalId: varchar("external_id", { length: 128 }),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  ticketIdIdx: index("ticket_actions_ticket_id_idx").on(t.ticketId),
}));

// Routing rules table - defines how tickets are assigned
export const routingRules = customerService.table("routing_rules", {
  id: serial("id").primaryKey(),
  predicate: jsonb("predicate").notNull(), // {requestType:"quote", productFamily:"acids"} etc.
  assignees: jsonb("assignees").notNull(), // ["Adnan"] or ["Lori"] or ["coa-team"]
  active: boolean("active").default(true),
  order: integer("order").default(100), // priority (lower numbers = higher priority)
});

// Transcripts table - stores call transcripts and summaries
export const transcripts = customerService.table("transcripts", {
  id: serial("id").primaryKey(),
  callId: varchar("call_id", { length: 64 }).notNull(),
  text: text("text").notNull(),
  summary: text("summary"),
  sentiment: varchar("sentiment", { length: 16 }), // positive|neutral|negative
  modelMeta: jsonb("model_meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  callIdIdx: index("transcripts_call_id_idx").on(t.callId),
}));

// Attachments table - stores files associated with tickets
export const attachments = customerService.table("attachments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 24 }).notNull(), // coa|photo|pdf
  url: text("url").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  ticketIdIdx: index("attachments_ticket_id_idx").on(t.ticketId),
}));

// AI Operations table - tracks all AI operations for audit and analytics
export const aiOperations = customerService.table("ai_operations", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
  callId: varchar("call_id", { length: 64 }),
  operation: varchar("operation", { length: 64 }).notNull(), // classify|route|summarize|sentiment|suggest|extract
  provider: varchar("provider", { length: 32 }).notNull(), // openai|gemini
  model: varchar("model", { length: 64 }),
  input: jsonb("input").notNull(),
  output: jsonb("output"),
  success: boolean("success").notNull(),
  responseTimeMs: integer("response_time_ms"),
  errorMessage: text("error_message"),
  tokensUsed: integer("tokens_used"),
  costEstimate: integer("cost_estimate"), // in cents
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  ticketIdIdx: index("ai_operations_ticket_id_idx").on(t.ticketId),
  operationIdx: index("ai_operations_operation_idx").on(t.operation),
  createdAtIdx: index("ai_operations_created_at_idx").on(t.createdAt),
}));

// Suggested Responses table - stores AI-generated response suggestions
export const suggestedResponses = customerService.table("suggested_responses", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  responseText: text("response_text").notNull(),
  tone: varchar("tone", { length: 24 }).notNull(), // formal|friendly|apologetic|informative
  confidence: integer("confidence").notNull(), // 0-100
  tags: jsonb("tags"),
  selected: boolean("selected").default(false),
  agentId: varchar("agent_id", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  selectedAt: timestamp("selected_at", { withTimezone: true }),
}, (t) => ({
  ticketIdIdx: index("suggested_responses_ticket_id_idx").on(t.ticketId),
  selectedIdx: index("suggested_responses_selected_idx").on(t.selected),
}));