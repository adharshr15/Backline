import 'dotenv/config';

/**
 * Secrets are read via `process.env.X as string` all over the codebase, so a missing
 * value silently becomes `undefined` and surfaces much later as a confusing 500.
 * Validate once at boot instead.
 */

const MIN_SECRET_LENGTH = 32

export const requireEnv = () => {
  const missing: string[] = []

  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL')
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET')

  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Set them in backend/.env (see .env.example).`
    )
  }

  const secret = process.env.JWT_SECRET as string
  if (secret.length < MIN_SECRET_LENGTH && process.env.NODE_ENV === 'production') {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production ` +
      `(got ${secret.length}). Generate one with: openssl rand -base64 48`
    )
  }
}

export const jwtSecret = (): string => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return secret
}
