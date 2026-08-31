import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const algorithm = 'aes-256-gcm'

function encryptionKey() {
  return createHash('sha256').update(process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'simba-device-secret').digest()
}

export function encryptDeviceKey(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(algorithm, encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptDeviceKey(value: string) {
  const [ivText, tagText, encryptedText] = value.split('.')
  const decipher = createDecipheriv(algorithm, encryptionKey(), Buffer.from(ivText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8')
}