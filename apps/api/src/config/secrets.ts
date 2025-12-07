// ============================================================================
// Secrets Loader
// ============================================================================
// Loads secrets from AWS Secrets Manager in production, falls back to .env locally.
//
// Usage:
//   import { loadSecrets, getSecret } from '@/config/secrets.js';
//   await loadSecrets(); // Call once at app startup
//   const dbPassword = getSecret('database', 'password');

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { config } from './index.js';

// ============================================================================
// Types
// ============================================================================

interface DatabaseSecrets {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  url: string;
}

interface AuthSecrets {
  jwt_secret: string;
  jwt_expires_in: string;
}

interface OAuthSecrets {
  google: { client_id: string; client_secret: string };
  microsoft: { client_id: string; client_secret: string };
  github: { client_id: string; client_secret: string };
}

interface ApiKeysSecrets {
  openai: { api_key: string; model: string };
  deepgram: { api_key: string };
  eleven_labs: { api_key: string };
}

interface RedisSecrets {
  host: string;
  port: number;
  password: string;
  url: string;
}

interface RabbitMQSecrets {
  url: string;
}

interface AllSecrets {
  database: DatabaseSecrets;
  auth: AuthSecrets;
  oauth: OAuthSecrets;
  'api-keys': ApiKeysSecrets;
  redis: RedisSecrets;
  rabbitmq: RabbitMQSecrets;
}

type SecretName = keyof AllSecrets;

// ============================================================================
// State
// ============================================================================

let secretsLoaded = false;
let secretsCache: Partial<AllSecrets> = {};
let secretsClient: SecretsManagerClient | null = null;

// ============================================================================
// Initialization
// ============================================================================

function getSecretsClient(): SecretsManagerClient {
  if (!secretsClient) {
    secretsClient = new SecretsManagerClient({ region: config.aws.region });
  }
  return secretsClient;
}

// ============================================================================
// Load from AWS Secrets Manager
// ============================================================================

async function loadFromSecretsManager(secretName: string): Promise<Record<string, unknown> | null> {
  const prefix = process.env.AWS_SECRETS_PREFIX || 'cohuron/prod';
  const fullSecretId = `${prefix}/${secretName}`;

  try {
    const client = getSecretsClient();
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: fullSecretId })
    );

    if (response.SecretString) {
      return JSON.parse(response.SecretString);
    }
  } catch (error) {
    console.warn(`Failed to load secret ${fullSecretId}:`, error);
  }

  return null;
}

// ============================================================================
// Load from Environment Variables (Fallback)
// ============================================================================

function loadFromEnv(): Partial<AllSecrets> {
  return {
    database: {
      host: process.env.DB_HOST || config.database.host,
      port: parseInt(process.env.DB_PORT || String(config.database.port), 10),
      database: process.env.DB_NAME || config.database.database,
      username: process.env.DB_USER || 'app',
      password: process.env.DB_PASSWORD || 'app',
      url: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'app'}:${process.env.DB_PASSWORD || 'app'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5434'}/${process.env.DB_NAME || 'app'}`,
    },
    auth: {
      jwt_secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
      jwt_expires_in: process.env.JWT_EXPIRES_IN || config.jwt.expiresIn,
    },
    oauth: {
      google: {
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      },
      microsoft: {
        client_id: process.env.MICROSOFT_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      },
      github: {
        client_id: process.env.GITHUB_CLIENT_ID || '',
        client_secret: process.env.GITHUB_CLIENT_SECRET || '',
      },
    },
    'api-keys': {
      openai: {
        api_key: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || config.aiModels.defaultModel,
      },
      deepgram: {
        api_key: process.env.DEEPGRAM_API_KEY || '',
      },
      eleven_labs: {
        api_key: process.env.ELEVEN_LABS_API_KEY || '',
      },
    },
    redis: {
      host: process.env.REDIS_HOST || config.redis.host,
      port: parseInt(process.env.REDIS_PORT || String(config.redis.port), 10),
      password: process.env.REDIS_PASSWORD || '',
      url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
    },
    rabbitmq: {
      url: process.env.RABBITMQ_URL || '',
    },
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Load all secrets from AWS Secrets Manager or environment variables.
 * Call this once during application startup.
 */
export async function loadSecrets(): Promise<void> {
  if (secretsLoaded) {
    return;
  }

  const useSecretsManager = config.features.useSecretsManager;

  if (useSecretsManager) {
    console.log('Loading secrets from AWS Secrets Manager...');

    const secretNames: SecretName[] = ['database', 'auth', 'oauth', 'api-keys', 'redis', 'rabbitmq'];

    await Promise.all(
      secretNames.map(async (name) => {
        const secret = await loadFromSecretsManager(name);
        if (secret) {
          secretsCache[name] = secret as AllSecrets[typeof name];
        }
      })
    );

    // Fall back to env for any secrets that failed to load
    const envSecrets = loadFromEnv();
    for (const [key, value] of Object.entries(envSecrets)) {
      if (!secretsCache[key as SecretName]) {
        secretsCache[key as SecretName] = value as AllSecrets[SecretName];
      }
    }

    console.log('Secrets loaded from AWS Secrets Manager');
  } else {
    console.log('Loading secrets from environment variables...');
    secretsCache = loadFromEnv();
  }

  secretsLoaded = true;
}

/**
 * Get a specific secret value.
 * @param secretName - The secret category (e.g., 'database', 'auth')
 * @param key - The specific key within the secret (e.g., 'password')
 */
export function getSecret<T extends SecretName, K extends keyof AllSecrets[T]>(
  secretName: T,
  key: K
): AllSecrets[T][K] | undefined {
  if (!secretsLoaded) {
    console.warn('Secrets not loaded yet. Call loadSecrets() first.');
    // Fall back to env loading for development convenience
    secretsCache = loadFromEnv();
    secretsLoaded = true;
  }

  const secret = secretsCache[secretName];
  if (!secret) {
    return undefined;
  }

  return (secret as AllSecrets[T])[key];
}

/**
 * Get an entire secret object.
 */
export function getSecretObject<T extends SecretName>(secretName: T): AllSecrets[T] | undefined {
  if (!secretsLoaded) {
    console.warn('Secrets not loaded yet. Call loadSecrets() first.');
    secretsCache = loadFromEnv();
    secretsLoaded = true;
  }

  return secretsCache[secretName] as AllSecrets[T] | undefined;
}

/**
 * Convenience getters for common secrets
 */
export const secrets = {
  get databaseUrl(): string {
    return getSecret('database', 'url') || process.env.DATABASE_URL || '';
  },

  get jwtSecret(): string {
    return getSecret('auth', 'jwt_secret') || process.env.JWT_SECRET || '';
  },

  get openaiApiKey(): string {
    return getSecret('api-keys', 'openai')?.api_key || process.env.OPENAI_API_KEY || '';
  },

  get deepgramApiKey(): string {
    return getSecret('api-keys', 'deepgram')?.api_key || process.env.DEEPGRAM_API_KEY || '';
  },

  get elevenLabsApiKey(): string {
    return getSecret('api-keys', 'eleven_labs')?.api_key || process.env.ELEVEN_LABS_API_KEY || '';
  },

  get redisUrl(): string {
    return getSecret('redis', 'url') || process.env.REDIS_URL || '';
  },

  get rabbitmqUrl(): string {
    return getSecret('rabbitmq', 'url') || process.env.RABBITMQ_URL || '';
  },

  google: {
    get clientId(): string {
      return getSecret('oauth', 'google')?.client_id || process.env.GOOGLE_CLIENT_ID || '';
    },
    get clientSecret(): string {
      return getSecret('oauth', 'google')?.client_secret || process.env.GOOGLE_CLIENT_SECRET || '';
    },
  },

  microsoft: {
    get clientId(): string {
      return getSecret('oauth', 'microsoft')?.client_id || process.env.MICROSOFT_CLIENT_ID || '';
    },
    get clientSecret(): string {
      return getSecret('oauth', 'microsoft')?.client_secret || process.env.MICROSOFT_CLIENT_SECRET || '';
    },
  },

  github: {
    get clientId(): string {
      return getSecret('oauth', 'github')?.client_id || process.env.GITHUB_CLIENT_ID || '';
    },
    get clientSecret(): string {
      return getSecret('oauth', 'github')?.client_secret || process.env.GITHUB_CLIENT_SECRET || '';
    },
  },
};

export default secrets;
