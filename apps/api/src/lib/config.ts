import { z } from 'zod';
import 'dotenv/config';

const configSchema = z.object({
  // Server
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url(),
  
  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('24h'),
  
  // CORS
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  API_ORIGIN: z.string().url().default('http://localhost:4000'),
  
  // S3/File Storage
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('pmo-files'),
  S3_ATTACHMENTS_BUCKET: z.string().default('cohuron-attachments-prod-957207443425'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  AWS_PROFILE: z.string().default('cohuron'),
  AWS_REGION: z.string().default('us-east-1'),
  
  // Email/SMTP
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default('noreply@pmo.local'),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // OpenTelemetry
  OTEL_SERVICE_NAME: z.string().default('pmo-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

type Config = z.infer<typeof configSchema>;

let config: Config;

try {
  config = configSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error);
  process.exit(1);
}

export { config, type Config };