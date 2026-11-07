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
  /**
   * Demo mode adds the "Continue as demo student" button. It defaults to on for local development
   * so the app runs without Google credentials, and to off in production.
   */
  demoMode: (process.env.DEMO_MODE ?? (isProduction ? 'false' : 'true')).toLowerCase() === 'true',
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
  allowedEmailDomains: list(process.env.ALLOWED_EMAIL_DOMAINS),
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'altitude-admin',
  seedBaristaPassword: process.env.SEED_BARISTA_PASSWORD || 'altitude-barista',
} as const
