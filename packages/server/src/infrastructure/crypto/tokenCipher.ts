import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '../../env.js'

// AES-256-GCM at-rest encryption for third-party OAuth tokens (Connection.accessToken /
// refreshToken). Ciphertext is stored as `iv:authTag:data`, each base64 — never store or
// log the raw key or plaintext tokens.
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  const key = Buffer.from(env.CONNECTION_ENC_KEY, 'base64')
  if (key.length !== 32) {
    throw new Error('CONNECTION_ENC_KEY must decode to exactly 32 bytes (base64-encoded)')
  }
  return key
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${data.toString('base64')}`
}

export function decrypt(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(':')
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Malformed ciphertext')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const data = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
  return data.toString('utf8')
}
