import { z } from 'zod';

// Customer creation schema - for API validation
export const createCustomerSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  source: z.enum(['ticket', 'email', 'phone', 'web', 'manual']).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  
  // Integration settings
  syncToShopify: z.boolean().default(true),
  syncToQuickbooks: z.boolean().default(true),
  
  // Associated data for context
  ticketId: z.number().optional(),
  orderId: z.string().optional(),
});

// Customer address schema
export const createAddressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  addressType: z.enum(['shipping', 'billing', 'both']).default('shipping'),
  isDefault: z.boolean().default(false),
});

// Customer search schema
export const customerSearchSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  name: z.string().optional(),
  shopifyId: z.string().optional(),
  quickbooksId: z.string().optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
});

// Service response types
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CustomerCreateResult {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customer?: any;
  customerId?: string;
  shopifyResult?: ShopifyIntegrationResult;
  quickbooksResult?: QuickbooksIntegrationResult;
  error?: string;
  message?: string;
  alreadyExists?: boolean;
}

export interface ShopifyIntegrationResult {
  success: boolean;
  customerId?: string;
  alreadyExists?: boolean;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response?: any;
}

export interface QuickbooksIntegrationResult {
  success: boolean;
  customerId?: string;
  alreadyExists?: boolean;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response?: any;
}

// External service customer formats
export interface ShopifyCustomerData {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  tags?: string;
  note?: string;
  verified_email?: boolean;
  accepts_marketing?: boolean;
  addresses?: ShopifyAddressData[];
}

export interface ShopifyAddressData {
  first_name?: string;
  last_name?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  country: string;
  zip: string;
  phone?: string;
  country_code?: string;
  province_code?: string;
}

export interface QuickbooksCustomerData {
  Name: string;
  CompanyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  BillAddr?: QuickbooksAddressData;
  ShipAddr?: QuickbooksAddressData;
  Notes?: string;
}

export interface QuickbooksAddressData {
  Line1: string;
  Line2?: string;
  Line3?: string;
  City: string;
  Country: string;
  CountrySubDivisionCode?: string;
  PostalCode: string;
}

// Type exports
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;