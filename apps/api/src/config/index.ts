// ============================================================================
// Application Configuration
// ============================================================================
// Non-secret configuration values loaded from environment with sensible defaults.
// Secrets (API keys, passwords) should be loaded from AWS Secrets Manager in production.

// ============================================================================
// Server Configuration
// ============================================================================
export const serverConfig = {
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || process.env.API_PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

// ============================================================================
// CORS Configuration
// ============================================================================
export const corsConfig = {
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  apiOrigin: process.env.API_ORIGIN || 'http://localhost:4000',
} as const;

// ============================================================================
// Database Configuration (connection details, not credentials)
// ============================================================================
export const databaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5434', 10),
  database: process.env.DB_NAME || 'app',
  // username and password should come from Secrets Manager in production
} as const;

// ============================================================================
// Redis Configuration (connection details, not credentials)
// ============================================================================
export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: parseInt(process.env.REDIS_DB || '0', 10),
  // password should come from Secrets Manager in production
} as const;

// ============================================================================
// JWT Configuration (non-secret parts)
// ============================================================================
export const jwtConfig = {
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  // secret should come from Secrets Manager in production
} as const;

// ============================================================================
// WebAuthn Configuration
// ============================================================================
export const webAuthnConfig = {
  rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
  rpName: process.env.WEBAUTHN_RP_NAME || 'PMO Platform',
  origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173',
} as const;

// ============================================================================
// AWS Configuration (non-secret parts)
// ============================================================================
export const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  profile: process.env.AWS_PROFILE || 'default',
} as const;

// ============================================================================
// S3 Configuration
// ============================================================================
export const s3Config = {
  endpoint: process.env.S3_ENDPOINT || undefined, // undefined uses AWS default
  region: process.env.S3_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET || 'pmo-files',
  attachmentsBucket: process.env.S3_ATTACHMENTS_BUCKET || 'pmo-attachments',
  // accessKey and secretKey should come from IAM role or Secrets Manager
} as const;

// ============================================================================
// SES (Email) Configuration
// ============================================================================
export const sesConfig = {
  fromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@pmo.local',
  fromName: process.env.AWS_SES_FROM_NAME || 'PMO Platform',
  configurationSet: process.env.AWS_SES_CONFIGURATION_SET || 'pmo-email-tracking',
} as const;

// ============================================================================
// SNS (SMS) Configuration
// ============================================================================
export const snsConfig = {
  senderId: process.env.AWS_SNS_SENDER_ID || 'PMO',
} as const;

// ============================================================================
// SMTP Configuration (for local development with MailHog)
// ============================================================================
export const smtpConfig = {
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: process.env.SMTP_SECURE === 'true',
  from: process.env.SMTP_FROM || 'noreply@pmo.local',
  // user and pass should come from Secrets Manager in production
} as const;

// ============================================================================
// AI/LLM Model Configuration
// ============================================================================
export const aiModelConfig = {
  // Default model for general use
  defaultModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',

  // Agent-specific models
  orchestratorModel: process.env.ORCHESTRATOR_MODEL || 'gpt-4o-mini',
  plannerModel: process.env.PLANNER_MODEL || 'gpt-4o-mini',
  workerModel: process.env.WORKER_MODEL || 'gpt-4o-mini',
  evaluatorModel: process.env.EVALUATOR_MODEL || 'gpt-4o-mini',
  criticModel: process.env.CRITIC_MODEL || 'gpt-4o-mini',
  summaryModel: process.env.SUMMARY_MODEL || 'gpt-4o-mini',
  decisionEngineModel: process.env.DECISION_ENGINE_MODEL || 'gpt-4o-mini',

  // Complexity-based model selection
  simpleModel: process.env.SIMPLE_MODEL || 'gpt-4o-mini',
  mediumModel: process.env.MEDIUM_MODEL || 'gpt-4o-mini',
  complexModel: process.env.COMPLEX_MODEL || 'gpt-4-turbo-preview',
} as const;

// ============================================================================
// ElevenLabs Voice Configuration
// ============================================================================
export const elevenLabsConfig = {
  voiceId: process.env.ELEVEN_LABS_VOICE_ID || '56AoDkrOh6qfVPDXZ7Pt',
  modelId: process.env.ELEVEN_LABS_MODEL_ID || 'eleven_flash_v2_5',
  stability: parseFloat(process.env.ELEVEN_LABS_STABILITY || '0.8'),
  similarity: parseFloat(process.env.ELEVEN_LABS_SIMILARITY || '0.8'),
  style: parseFloat(process.env.ELEVEN_LABS_STYLE || '0.0'),
} as const;

// ============================================================================
// Logging Configuration
// ============================================================================
export const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  verboseAgentLogs: process.env.VERBOSE_AGENT_LOGS === 'true',
} as const;

// ============================================================================
// OpenTelemetry Configuration
// ============================================================================
export const otelConfig = {
  serviceName: process.env.OTEL_SERVICE_NAME || 'pmo-api',
  exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || undefined,
  enabled: !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
} as const;

// ============================================================================
// Feature Flags (computed from environment)
// ============================================================================
export const featureFlags = {
  useSecretsManager: process.env.USE_SECRETS_MANAGER === 'true' || serverConfig.isProduction,
  enableOpenTelemetry: otelConfig.enabled,
  enableVerboseLogging: loggingConfig.verboseAgentLogs,
} as const;

// ============================================================================
// Export all configs as a single object
// ============================================================================
export const config = {
  server: serverConfig,
  cors: corsConfig,
  database: databaseConfig,
  redis: redisConfig,
  jwt: jwtConfig,
  webAuthn: webAuthnConfig,
  aws: awsConfig,
  s3: s3Config,
  ses: sesConfig,
  sns: snsConfig,
  smtp: smtpConfig,
  aiModels: aiModelConfig,
  elevenLabs: elevenLabsConfig,
  logging: loggingConfig,
  otel: otelConfig,
  features: featureFlags,
} as const;

export default config;
