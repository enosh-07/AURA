import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'aura_access_secret_2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'aura_refresh_secret_2026',
  // AI Providers (backend-only — never sent to frontend)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  // Google OAuth — used for server-side token audience validation
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3',
  AI_PROVIDER: process.env.AI_PROVIDER || 'gemini', // gemini | openai | ollama
  // Storage
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local', // local | s3 | supabase
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || '',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || '',
  S3_REGION: process.env.S3_REGION || 'us-east-1',
  S3_BUCKET_AUDIO: process.env.S3_BUCKET_AUDIO || 'aura-audio',
  S3_BUCKET_ARTWORK: process.env.S3_BUCKET_ARTWORK || 'aura-artwork',
};
