import { pgTable, serial, integer, varchar, text, timestamp, bigint, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const customerStatusEnum = pgEnum('customer_status', ['active', 'inactive', 'archived']);
export const addressTypeEnum = pgEnum('address_type', ['shipping', 'billing', 'both']);
export const integrationStatusEnum = pgEnum('integration_status', ['pending', 'synced', 'failed', 'disabled']);

// Customers table - core customer data
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  company: varchar('company', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  status: customerStatusEnum('status').default('active'),
  
  // Integration IDs
  shopifyId: bigint('shopify_id', { mode: 'bigint' }).unique(),
  quickbooksId: varchar('quickbooks_id', { length: 255 }).unique(),
  
  // Integration status tracking
  shopifyStatus: integrationStatusEnum('shopify_status').default('pending'),
  quickbooksStatus: integrationStatusEnum('quickbooks_status').default('pending'),
  
  // Metadata
  source: varchar('source', { length: 50 }), // 'ticket', 'email', 'phone', 'web', 'manual'
  notes: text('notes'),
  tags: text('tags'), // JSON array stored as text
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastSyncedAt: timestamp('last_synced_at'),
});

// Customer addresses - supports multiple addresses per customer
export const customerAddresses = pgTable('customer_addresses', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  
  // Address fields
  name: varchar('name', { length: 255 }),
  company: varchar('company', { length: 255 }),
  country: varchar('country', { length: 100 }).notNull(),
  addressLine1: varchar('address_line_1', { length: 255 }).notNull(),
  addressLine2: varchar('address_line_2', { length: 255 }),
  addressLine3: varchar('address_line_3', { length: 255 }),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  
  // Address metadata
  addressType: addressTypeEnum('address_type').default('shipping'),
  isDefault: boolean('is_default').default(false),
  
  // Integration IDs
  shopifyId: bigint('shopify_address_id', { mode: 'bigint' }),
  quickbooksId: varchar('quickbooks_address_id', { length: 255 }),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Customer sync log - tracks integration sync attempts
export const customerSyncLog = pgTable('customer_sync_log', {
  id: serial('id').primaryKey(),
  customerId: serial('customer_id').references(() => customers.id).notNull(),
  
  // Sync details
  service: varchar('service', { length: 50 }).notNull(), // 'shopify', 'quickbooks'
  operation: varchar('operation', { length: 50 }).notNull(), // 'create', 'update', 'sync'
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'failed', 'pending'
  
  // Result data
  externalId: varchar('external_id', { length: 255 }),
  requestData: text('request_data'), // JSON of request sent
  responseData: text('response_data'), // JSON of response received
  errorMessage: text('error_message'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Relations
export const customerRelations = relations(customers, ({ many }) => ({
  addresses: many(customerAddresses),
  syncLogs: many(customerSyncLog),
}));

export const addressRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, {
    fields: [customerAddresses.customerId],
    references: [customers.id],
  }),
}));

export const syncLogRelations = relations(customerSyncLog, ({ one }) => ({
  customer: one(customers, {
    fields: [customerSyncLog.customerId],
    references: [customers.id],
  }),
}));

// Re-export ticketing tables
export * from './ticketing';

// Export types
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type NewCustomerAddress = typeof customerAddresses.$inferInsert;
export type CustomerSyncLog = typeof customerSyncLog.$inferSelect;
export type NewCustomerSyncLog = typeof customerSyncLog.$inferInsert;