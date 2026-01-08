/**
 * Default configuration for HubZone Technology Initiative Salesforce instance
 */

import type { SalesforceConfig } from './types.js';

// HubZone Salesforce Instance defaults
export const HUBZONE_INSTANCE_URL = 'https://hubzonetechnologyinitiative.my.salesforce.com';
export const SALESFORCE_LOGIN_URL = 'https://login.salesforce.com';
export const DEFAULT_API_VERSION = 'v61.0';

/**
 * Create configuration from environment variables
 *
 * Expected env vars:
 * - SF_CLIENT_ID: Consumer Key from Connected App
 * - SF_USERNAME: Salesforce username (e.g., wsigmon@hubzonetech.org)
 * - SF_PRIVATE_KEY: Private key content (or path via SF_PRIVATE_KEY_PATH)
 * - SF_PRIVATE_KEY_PATH: Path to private key file
 * - SF_INSTANCE_URL: Optional, defaults to HubZone instance
 */
export function configFromEnv(): SalesforceConfig {
  const clientId = process.env.SF_CLIENT_ID;
  const username = process.env.SF_USERNAME;
  const privateKey = process.env.SF_PRIVATE_KEY;
  const privateKeyPath = process.env.SF_PRIVATE_KEY_PATH;
  const instanceUrl = process.env.SF_INSTANCE_URL || HUBZONE_INSTANCE_URL;

  if (!clientId) {
    throw new Error('SF_CLIENT_ID environment variable is required');
  }
  if (!username) {
    throw new Error('SF_USERNAME environment variable is required');
  }

  let key: string;
  if (privateKey) {
    key = privateKey;
  } else if (privateKeyPath) {
    // Lazy load fs to avoid issues in browser environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    key = fs.readFileSync(privateKeyPath, 'utf8');
  } else {
    throw new Error('Either SF_PRIVATE_KEY or SF_PRIVATE_KEY_PATH is required');
  }

  return {
    clientId,
    username,
    privateKey: key,
    instanceUrl,
    loginUrl: SALESFORCE_LOGIN_URL,
    apiVersion: DEFAULT_API_VERSION,
  };
}

/**
 * HubZone HTI-specific configuration
 * Consumer Key for "Claude Code API Access" Connected App
 */
export const HUBZONE_CONFIG = {
  consumerKey: '3MVG9riCAn8HHkYUvHwd21ilaE1bmWMD26O5Dv6z5ucgRw3a.FUmD_ANNlz80e1BHJ.1jb4GauTy4ACQjzODD',
  defaultUsername: 'wsigmon@hubzonetech.org',
  instanceUrl: HUBZONE_INSTANCE_URL,
  connectedAppName: 'Claude Code API Access',
};
