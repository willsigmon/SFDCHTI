/**
 * TypeScript types for Salesforce objects and API responses
 */

import { z } from 'zod';

// ===== API Response Schemas =====

export const SalesforceTokenResponseSchema = z.object({
  access_token: z.string(),
  instance_url: z.string(),
  id: z.string(),
  token_type: z.string(),
  issued_at: z.string(),
  signature: z.string(),
});

export const SalesforceQueryResponseSchema = z.object({
  totalSize: z.number(),
  done: z.boolean(),
  records: z.array(z.record(z.string(), z.any())),
  nextRecordsUrl: z.string().optional(),
});

export const SalesforceCreateResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  errors: z.array(z.any()),
});

export const SalesforceErrorSchema = z.array(z.object({
  message: z.string(),
  errorCode: z.string(),
  fields: z.array(z.string()).optional(),
}));

// ===== Salesforce Object Schemas =====

export const AccountSchema = z.object({
  Id: z.string(),
  Name: z.string().optional(),
  Industry: z.string().optional(),
  Type: z.string().optional(),
  Website: z.string().optional(),
  Phone: z.string().optional(),
  BillingStreet: z.string().optional(),
  BillingCity: z.string().optional(),
  BillingState: z.string().optional(),
  BillingPostalCode: z.string().optional(),
  Description: z.string().optional(),
  CreatedDate: z.string().optional(),
  LastModifiedDate: z.string().optional(),
}).passthrough();

export const ContactSchema = z.object({
  Id: z.string(),
  FirstName: z.string().optional(),
  LastName: z.string().optional(),
  Email: z.string().optional(),
  Phone: z.string().optional(),
  Title: z.string().optional(),
  AccountId: z.string().optional(),
  MailingStreet: z.string().optional(),
  MailingCity: z.string().optional(),
  MailingState: z.string().optional(),
  MailingPostalCode: z.string().optional(),
  CreatedDate: z.string().optional(),
  LastModifiedDate: z.string().optional(),
}).passthrough();

export const OpportunitySchema = z.object({
  Id: z.string(),
  Name: z.string().optional(),
  AccountId: z.string().optional(),
  Amount: z.number().optional(),
  StageName: z.string().optional(),
  CloseDate: z.string().optional(),
  Probability: z.number().optional(),
  Type: z.string().optional(),
  Description: z.string().optional(),
  CreatedDate: z.string().optional(),
  LastModifiedDate: z.string().optional(),
}).passthrough();

export const TaskSchema = z.object({
  Id: z.string(),
  Subject: z.string().optional(),
  Status: z.string().optional(),
  Priority: z.string().optional(),
  WhoId: z.string().optional(),
  WhatId: z.string().optional(),
  ActivityDate: z.string().optional(),
  Description: z.string().optional(),
  CreatedDate: z.string().optional(),
  LastModifiedDate: z.string().optional(),
}).passthrough();

// ===== Type Exports =====

export type SalesforceTokenResponse = z.infer<typeof SalesforceTokenResponseSchema>;
export type SalesforceQueryResponse = z.infer<typeof SalesforceQueryResponseSchema>;
export type SalesforceCreateResponse = z.infer<typeof SalesforceCreateResponseSchema>;
export type SalesforceError = z.infer<typeof SalesforceErrorSchema>;

export type Account = z.infer<typeof AccountSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type Task = z.infer<typeof TaskSchema>;

// ===== Configuration Types =====

export interface SalesforceConfig {
  clientId: string;
  username: string;
  privateKey: string;
  instanceUrl?: string;
  loginUrl?: string;
  apiVersion?: string;
}

export interface SalesforceClientOptions {
  config: SalesforceConfig;
  tokenCacheTtlMs?: number;
  requestTimeoutMs?: number;
  maxRetries?: number;
}
