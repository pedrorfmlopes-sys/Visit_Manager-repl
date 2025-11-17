import { db } from './db';
import { microsoftTokens } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { User } from '@shared/schema';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.SESSION_SECRET || 'fallback-key-for-dev-only';

function encrypt(text: string): string {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export interface MicrosoftTokenData {
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  expiresAt: Date;
}

export async function storeMicrosoftTokens(
  userId: string,
  tokenData: MicrosoftTokenData
): Promise<void> {
  const encryptedAccess = encrypt(tokenData.accessToken);
  const encryptedRefresh = encrypt(tokenData.refreshToken);
  
  const existing = await db
    .select()
    .from(microsoftTokens)
    .where(eq(microsoftTokens.userId, userId))
    .limit(1);
  
  if (existing.length > 0) {
    await db
      .update(microsoftTokens)
      .set({
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        scopes: JSON.stringify(tokenData.scopes),
        expiresAt: tokenData.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(microsoftTokens.userId, userId));
  } else {
    await db.insert(microsoftTokens).values({
      userId,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      scopes: JSON.stringify(tokenData.scopes),
      expiresAt: tokenData.expiresAt,
    });
  }
}

export async function getMicrosoftTokens(
  userId: string
): Promise<MicrosoftTokenData | null> {
  const result = await db
    .select()
    .from(microsoftTokens)
    .where(eq(microsoftTokens.userId, userId))
    .limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  const token = result[0];
  
  return {
    accessToken: decrypt(token.accessToken),
    refreshToken: decrypt(token.refreshToken),
    scopes: JSON.parse(token.scopes),
    expiresAt: token.expiresAt,
  };
}

export async function deleteMicrosoftTokens(userId: string): Promise<void> {
  await db
    .delete(microsoftTokens)
    .where(eq(microsoftTokens.userId, userId));
}

export interface MicrosoftGraphClient {
  get(endpoint: string): Promise<any>;
  post(endpoint: string, body: any): Promise<any>;
  patch(endpoint: string, body: any): Promise<any>;
  delete(endpoint: string): Promise<void>;
}

async function refreshAccessToken(userId: string): Promise<string> {
  const tokens = await getMicrosoftTokens(userId);
  if (!tokens) {
    throw new Error('No Microsoft tokens found');
  }
  
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials not configured');
  }
  
  const tokenEndpoint = 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token';
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    scope: tokens.scopes.join(' '),
  });
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }
  
  const data = await response.json();
  
  const newTokenData: MicrosoftTokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || tokens.refreshToken,
    scopes: data.scope ? data.scope.split(' ') : tokens.scopes,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
  
  await storeMicrosoftTokens(userId, newTokenData);
  
  return data.access_token;
}

export async function createMicrosoftGraphClient(
  userId: string
): Promise<MicrosoftGraphClient> {
  let tokens = await getMicrosoftTokens(userId);
  
  if (!tokens) {
    throw new Error('User not connected to Microsoft 365');
  }
  
  let accessToken = tokens.accessToken;
  
  if (new Date() >= tokens.expiresAt) {
    accessToken = await refreshAccessToken(userId);
  }
  
  const makeRequest = async (
    method: string,
    endpoint: string,
    body?: any
  ): Promise<any> => {
    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://graph.microsoft.com/v1.0${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    
    const options: RequestInit = {
      method,
      headers,
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    let response = await fetch(url, options);
    
    if (response.status === 401) {
      accessToken = await refreshAccessToken(userId);
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(url, { ...options, headers });
    }
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const seconds = retryAfter ? parseInt(retryAfter) : 5;
      throw new Error(`Rate limited. Retry after ${seconds} seconds`);
    }
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft Graph API error: ${response.status} - ${error}`);
    }
    
    if (response.status === 204 || method === 'DELETE') {
      return null;
    }
    
    return response.json();
  };
  
  return {
    get: (endpoint: string) => makeRequest('GET', endpoint),
    post: (endpoint: string, body: any) => makeRequest('POST', endpoint, body),
    patch: (endpoint: string, body: any) => makeRequest('PATCH', endpoint, body),
    delete: (endpoint: string) => makeRequest('DELETE', endpoint),
  };
}
