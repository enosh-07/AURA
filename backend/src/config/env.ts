import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const devSecretFallback = () => crypto.randomBytes(32).toString('hex');

export const ENV = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  DIRECT_URL: process.env.DIRECT_URL || '',

  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Cloudflare R2 / S3 Storage
  STORAGE_PROVIDER: (process.env.STORAGE_PROVIDER || 'local') as 'local' | 'r2' | 's3' | 'supabase',
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ENDPOINT: process.env.R2_ENDPOINT || process.env.S3_ENDPOINT || '',
  S3_ENDPOINT: process.env.R2_ENDPOINT || process.env.S3_ENDPOINT || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || '',
  S3_ACCESS_KEY: process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || '',
  S3_SECRET_KEY: process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || '',
  S3_REGION: process.env.S3_REGION || 'auto',
  R2_BUCKET_AUDIO: process.env.R2_BUCKET_AUDIO || process.env.S3_BUCKET_AUDIO || 'aura-audio',
  S3_BUCKET_AUDIO: process.env.R2_BUCKET_AUDIO || process.env.S3_BUCKET_AUDIO || 'aura-audio',
  R2_BUCKET_ARTWORK: process.env.R2_BUCKET_ARTWORK || process.env.S3_BUCKET_ARTWORK || 'aura-artwork',
  S3_BUCKET_ARTWORK: process.env.R2_BUCKET_ARTWORK || process.env.S3_BUCKET_ARTWORK || 'aura-artwork',
  R2_PUBLIC_DOMAIN: process.env.R2_PUBLIC_DOMAIN || '',

  // Resend Email Service
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'AURA Music <notifications@aura.audio>',
  RESEND_SUPPORT_EMAIL: process.env.RESEND_SUPPORT_EMAIL || 'support@aura.audio',

  // Authentication & Legacy JWT Secrets
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || devSecretFallback(),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || devSecretFallback(),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',

  // AI Providers (backend-only — never sent to frontend)
  AI_PROVIDER: process.env.AI_PROVIDER || 'gemini', // gemini | openai | ollama
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3',
};

/**
 * Validates critical environment configuration at startup.
 * Logs status in structured, safe format (without exposing secret keys).
 */
export function validateEnv(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (ENV.NODE_ENV === 'production') {
    if (!ENV.SUPABASE_URL) warnings.push('SUPABASE_URL is not set for production.');
    if (!ENV.SUPABASE_SERVICE_ROLE_KEY) warnings.push('SUPABASE_SERVICE_ROLE_KEY is not set for production.');
    if (ENV.STORAGE_PROVIDER === 'r2' && (!ENV.R2_ACCESS_KEY_ID || !ENV.R2_SECRET_ACCESS_KEY)) {
      warnings.push('Cloudflare R2 storage credentials (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) missing.');
    }
    if (!ENV.RESEND_API_KEY) {
      warnings.push('RESEND_API_KEY is not set. Transactional email sending will be simulated.');
    }
    if (ENV.AI_PROVIDER === 'gemini' && !ENV.GEMINI_API_KEY) {
      warnings.push('GEMINI_API_KEY is not configured for Gemini AI provider.');
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

