/**
 * Salesforce REST API Client
 *
 * Uses JWT Bearer Token Flow for server-to-server authentication.
 */

import * as jwt from 'jsonwebtoken';
import {
  SalesforceTokenResponseSchema,
  SalesforceQueryResponseSchema,
  SalesforceCreateResponseSchema,
  SalesforceErrorSchema,
  AccountSchema,
  ContactSchema,
  OpportunitySchema,
  TaskSchema,
  type SalesforceConfig,
  type SalesforceClientOptions,
  type Account,
  type Contact,
  type Opportunity,
  type Task,
} from './types.js';
import { SALESFORCE_LOGIN_URL, DEFAULT_API_VERSION, HUBZONE_INSTANCE_URL } from './config.js';

interface TokenCache {
  accessToken: string;
  instanceUrl: string;
  expiresAt: number;
}

/**
 * Salesforce REST API Client
 *
 * @example
 * ```typescript
 * import { SalesforceClient, configFromEnv } from '@willsigmon/sfdchti';
 *
 * const client = new SalesforceClient({ config: configFromEnv() });
 * const accounts = await client.getAccounts();
 * ```
 */
export class SalesforceClient {
  private config: SalesforceConfig;
  private tokenCache: TokenCache | null = null;
  private tokenCacheTtlMs: number;
  private requestTimeoutMs: number;
  private maxRetries: number;

  constructor(options: SalesforceClientOptions) {
    this.config = {
      instanceUrl: HUBZONE_INSTANCE_URL,
      loginUrl: SALESFORCE_LOGIN_URL,
      apiVersion: DEFAULT_API_VERSION,
      ...options.config,
    };
    this.tokenCacheTtlMs = options.tokenCacheTtlMs ?? 55 * 60 * 1000; // 55 minutes
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  // ===== Authentication =====

  private generateJwtAssertion(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.config.clientId,
      sub: this.config.username,
      aud: this.config.loginUrl,
      exp: now + 300, // 5 minutes
    };
    return jwt.sign(payload, this.config.privateKey, { algorithm: 'RS256' });
  }

  private async authenticate(): Promise<{ accessToken: string; instanceUrl: string }> {
    // Check cache
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return {
        accessToken: this.tokenCache.accessToken,
        instanceUrl: this.tokenCache.instanceUrl,
      };
    }

    const assertion = this.generateJwtAssertion();
    const tokenUrl = `${this.config.loginUrl}/services/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce authentication failed: ${errorText}`);
    }

    const data = SalesforceTokenResponseSchema.parse(await response.json());

    this.tokenCache = {
      accessToken: data.access_token,
      instanceUrl: data.instance_url,
      expiresAt: Date.now() + this.tokenCacheTtlMs,
    };

    return {
      accessToken: data.access_token,
      instanceUrl: data.instance_url,
    };
  }

  /**
   * Clear the token cache (forces re-authentication on next request)
   */
  public clearTokenCache(): void {
    this.tokenCache = null;
  }

  // ===== Generic Request =====

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = this.maxRetries
  ): Promise<T> {
    const { accessToken, instanceUrl } = await this.authenticate();
    const url = `${instanceUrl}/services/data/${this.config.apiVersion}${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Handle token expiration
      if (response.status === 401) {
        this.clearTokenCache();
        if (retries > 0) {
          return this.request<T>(endpoint, options, retries - 1);
        }
        throw new Error('Salesforce authentication failed after retries');
      }

      // Handle rate limiting
      if (response.status === 429 && retries > 0) {
        const delay = Math.pow(2, this.maxRetries - retries) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, retries - 1);
      }

      // Handle server errors
      if (response.status >= 500 && retries > 0) {
        const delay = Math.pow(2, this.maxRetries - retries) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, retries - 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Salesforce API Error (${response.status}): ${errorText}`;
        try {
          const errors = SalesforceErrorSchema.parse(JSON.parse(errorText));
          errorMessage = `Salesforce API Error: ${errors.map((e) => e.message).join(', ')}`;
        } catch {
          // Use raw error text
        }
        throw new Error(errorMessage);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      return response.json();
    } catch (error: unknown) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === 'AbortError') {
        if (retries > 0) {
          const delay = Math.pow(2, this.maxRetries - retries) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, retries - 1);
        }
        throw new Error('Salesforce request timeout after retries');
      }

      throw error;
    }
  }

  // ===== SOQL Query =====

  /**
   * Execute a SOQL query with automatic pagination
   */
  async query<T = Record<string, unknown>>(soql: string, fetchAll = true): Promise<T[]> {
    const encodedQuery = encodeURIComponent(soql);
    const response = await this.request<ReturnType<typeof SalesforceQueryResponseSchema.parse>>(
      `/query/?q=${encodedQuery}`
    );
    const result = SalesforceQueryResponseSchema.parse(response);

    let records = result.records as T[];

    if (fetchAll && !result.done && result.nextRecordsUrl) {
      let nextUrl = result.nextRecordsUrl;
      while (nextUrl) {
        const nextResponse = await this.request<ReturnType<typeof SalesforceQueryResponseSchema.parse>>(
          nextUrl.replace(`/services/data/${this.config.apiVersion}`, '')
        );
        const nextResult = SalesforceQueryResponseSchema.parse(nextResponse);
        records = records.concat(nextResult.records as T[]);
        nextUrl = nextResult.done ? '' : (nextResult.nextRecordsUrl || '');
      }
    }

    return records;
  }

  // ===== CRUD Operations =====

  /**
   * Get a single record by ID
   */
  async getRecord<T = Record<string, unknown>>(
    sobject: string,
    recordId: string,
    fields?: string[]
  ): Promise<T> {
    let endpoint = `/sobjects/${sobject}/${recordId}`;
    if (fields && fields.length > 0) {
      endpoint += `?fields=${fields.join(',')}`;
    }
    return this.request<T>(endpoint);
  }

  /**
   * Create a new record
   */
  async createRecord(
    sobject: string,
    data: Record<string, unknown>
  ): Promise<{ id: string; success: boolean }> {
    const response = await this.request<ReturnType<typeof SalesforceCreateResponseSchema.parse>>(
      `/sobjects/${sobject}/`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return SalesforceCreateResponseSchema.parse(response);
  }

  /**
   * Update an existing record
   */
  async updateRecord(
    sobject: string,
    recordId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.request(`/sobjects/${sobject}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a record
   */
  async deleteRecord(sobject: string, recordId: string): Promise<void> {
    await this.request(`/sobjects/${sobject}/${recordId}`, { method: 'DELETE' });
  }

  /**
   * Upsert a record by external ID
   */
  async upsertRecord(
    sobject: string,
    externalIdField: string,
    externalIdValue: string,
    data: Record<string, unknown>
  ): Promise<{ id: string; success: boolean; created: boolean }> {
    return this.request(`/sobjects/${sobject}/${externalIdField}/${externalIdValue}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ===== HTI-Specific Methods =====

  /**
   * Get all Accounts
   */
  async getAccounts(): Promise<Account[]> {
    const records = await this.query<Account>(
      `SELECT Id, Name, Industry, Type, Website, Phone,
       BillingStreet, BillingCity, BillingState, BillingPostalCode,
       Description, CreatedDate, LastModifiedDate
       FROM Account
       ORDER BY LastModifiedDate DESC`
    );
    return AccountSchema.array().parse(records);
  }

  /**
   * Get all Contacts
   */
  async getContacts(): Promise<Contact[]> {
    const records = await this.query<Contact>(
      `SELECT Id, FirstName, LastName, Email, Phone, Title, AccountId,
       MailingStreet, MailingCity, MailingState, MailingPostalCode,
       CreatedDate, LastModifiedDate
       FROM Contact
       ORDER BY LastModifiedDate DESC`
    );
    return ContactSchema.array().parse(records);
  }

  /**
   * Get all Opportunities
   */
  async getOpportunities(): Promise<Opportunity[]> {
    const records = await this.query<Opportunity>(
      `SELECT Id, Name, AccountId, Amount, StageName, CloseDate,
       Probability, Type, Description, CreatedDate, LastModifiedDate
       FROM Opportunity
       ORDER BY LastModifiedDate DESC`
    );
    return OpportunitySchema.array().parse(records);
  }

  /**
   * Get all Tasks
   */
  async getTasks(): Promise<Task[]> {
    const records = await this.query<Task>(
      `SELECT Id, Subject, Status, Priority, WhoId, WhatId,
       ActivityDate, Description, CreatedDate, LastModifiedDate
       FROM Task
       ORDER BY LastModifiedDate DESC`
    );
    return TaskSchema.array().parse(records);
  }

  /**
   * Search Accounts by name
   */
  async searchAccounts(searchTerm: string): Promise<Account[]> {
    const escapedTerm = searchTerm.replace(/'/g, "\\'");
    const records = await this.query<Account>(
      `SELECT Id, Name, Industry, Type, Website, Phone, BillingCity, BillingState
       FROM Account
       WHERE Name LIKE '%${escapedTerm}%'
       ORDER BY Name ASC
       LIMIT 50`
    );
    return AccountSchema.array().parse(records);
  }

  /**
   * Get API limits
   */
  async getLimits(): Promise<Record<string, unknown>> {
    return this.request('/limits/');
  }

  /**
   * Describe an sObject (get metadata)
   */
  async describeSObject(sobject: string): Promise<Record<string, unknown>> {
    return this.request(`/sobjects/${sobject}/describe/`);
  }
}
