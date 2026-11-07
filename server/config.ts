import { resolve } from 'node:path'

// Load .env if one exists. Missing file is fine: every value has a safe default.
try {
  process.loadEnvFile('.env')
} catch {
  /* no .env file */
}

const isProduction = process.env.NODE_ENV === 'production'

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
}

export const config = {
  isProduction,
  port: Number(process.env.PORT || 3000),
  databasePath: resolve(process.env.DATABASE_PATH || './data/altitude.db'),
  /** Where uploaded pictures are kept. On a host with a disk attached, point this at the disk. */
  uploadDir: resolve(process.env.UPLOAD_DIR || './data/uploads'),
  /**
   * Demo mode adds the "Continue as demo student" button. It defaults to on for local development
   * so the app runs without Google credentials, and to off in production.
   */
  demoMode: (process.env.DEMO_MODE ?? (isProduction ? 'false' : 'true')).toLowerCase() === 'true',
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
  allowedEmailDomains: list(process.env.ALLOWED_EMAIL_DOMAINS),
  /**
   * Optional. When a key is set, the mood suggester asks a model to read the text. Without one, the local
   * scorer does the job. Gemini is used first; Anthropic is the alternative if only that key is set.
   */
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || null,
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
  geminiBaseUrl: (process.env.GEMINI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, ''),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
  anthropicModel: process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'altitude-admin',
  seedBaristaPassword: process.env.SEED_BARISTA_PASSWORD || 'altitude-barista',
} as const
