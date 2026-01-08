# SFDCHTI

**Salesforce Integration for HubZone Technology Initiative**

A TypeScript client for Salesforce REST API using JWT Bearer Token Flow. Designed for server-to-server integration with the HubZone Salesforce instance.

## Features

- 🔐 JWT Bearer Token Flow authentication
- 🔄 Automatic token caching and refresh
- 📊 Full SOQL query support with pagination
- 📝 CRUD operations for all standard objects
- 🏢 HTI-specific methods for Accounts, Contacts, Opportunities, Tasks
- ⚡ Retry logic with exponential backoff
- 📦 Zero dependencies except `jsonwebtoken` and `zod`

## Installation

```bash
npm install @willsigmon/sfdchti
```

## Quick Start

```typescript
import { SalesforceClient, configFromEnv } from '@willsigmon/sfdchti';

// Configure from environment variables
const client = new SalesforceClient({ config: configFromEnv() });

// Get all accounts
const accounts = await client.getAccounts();
console.log(`Found ${accounts.length} accounts`);

// Search accounts
const results = await client.searchAccounts('HubZone');

// Execute custom SOQL
const contacts = await client.query(
  `SELECT Id, Name, Email FROM Contact WHERE AccountId = '001xxx'`
);

// CRUD operations
const newAccount = await client.createRecord('Account', { Name: 'New Account' });
await client.updateRecord('Account', newAccount.id, { Industry: 'Technology' });
await client.deleteRecord('Account', newAccount.id);
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SF_CLIENT_ID` | Consumer Key from Connected App | Yes |
| `SF_USERNAME` | Salesforce username | Yes |
| `SF_PRIVATE_KEY` | Private key content (PEM format) | Yes* |
| `SF_PRIVATE_KEY_PATH` | Path to private key file | Yes* |
| `SF_INSTANCE_URL` | Salesforce instance URL | No (defaults to HubZone) |

*Either `SF_PRIVATE_KEY` or `SF_PRIVATE_KEY_PATH` is required.

### Manual Configuration

```typescript
import { SalesforceClient } from '@willsigmon/sfdchti';
import fs from 'fs';

const client = new SalesforceClient({
  config: {
    clientId: 'your-consumer-key',
    username: 'your-salesforce-username',
    privateKey: fs.readFileSync('path/to/private.key', 'utf8'),
    instanceUrl: 'https://your-instance.my.salesforce.com',
  },
  tokenCacheTtlMs: 55 * 60 * 1000, // 55 minutes
  requestTimeoutMs: 30000,
  maxRetries: 3,
});
```

## HubZone Instance Details

| Property | Value |
|----------|-------|
| Instance URL | https://hubzonetechnologyinitiative.my.salesforce.com |
| Connected App | Claude Code API Access |
| API Version | v61.0 |
| Auth Flow | JWT Bearer Token |

## API Reference

### Query Methods

```typescript
// Execute SOQL with automatic pagination
client.query<T>(soql: string, fetchAll?: boolean): Promise<T[]>

// HTI-specific queries
client.getAccounts(): Promise<Account[]>
client.getContacts(): Promise<Contact[]>
client.getOpportunities(): Promise<Opportunity[]>
client.getTasks(): Promise<Task[]>
client.searchAccounts(term: string): Promise<Account[]>
```

### CRUD Methods

```typescript
client.getRecord<T>(sobject: string, id: string, fields?: string[]): Promise<T>
client.createRecord(sobject: string, data: object): Promise<{ id: string; success: boolean }>
client.updateRecord(sobject: string, id: string, data: object): Promise<void>
client.deleteRecord(sobject: string, id: string): Promise<void>
client.upsertRecord(sobject: string, extIdField: string, extIdValue: string, data: object): Promise<{ id: string; success: boolean; created: boolean }>
```

### Utility Methods

```typescript
client.getLimits(): Promise<Record<string, unknown>>
client.describeSObject(sobject: string): Promise<Record<string, unknown>>
client.clearTokenCache(): void
```

## Setting Up JWT Authentication

1. **Generate a Certificate**
   ```bash
   openssl req -newkey rsa:2048 -nodes \
     -keyout salesforce.key \
     -x509 -days 365 \
     -out salesforce.crt \
     -subj "/CN=Claude Code API Access"
   ```

2. **Create a Connected App in Salesforce**
   - Setup → App Manager → New Connected App
   - Enable OAuth Settings
   - Enable "Use digital signatures"
   - Upload the certificate (.crt file)
   - Select OAuth Scopes: `full`, `api`, `refresh_token`

3. **Pre-authorize the App**
   - Setup → Manage Connected Apps
   - Find your app → Manage → Edit Policies
   - Set "Permitted Users" to "Admin approved users are pre-authorized"
   - Add profiles or permission sets

4. **Configure Environment**
   ```bash
   export SF_CLIENT_ID="your-consumer-key"
   export SF_USERNAME="your-username@example.com"
   export SF_PRIVATE_KEY_PATH="/path/to/salesforce.key"
   ```

## License

MIT

## Author

Will Sigmon <will@hubzonetechnology.com>

---

Built with ❤️ for HubZone Technology Initiative
