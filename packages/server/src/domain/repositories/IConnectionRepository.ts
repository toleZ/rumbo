export interface ConnectionRecord {
  id: string
  userId: string
  provider: string
  accessToken: string // ciphertext — decrypt via infrastructure/crypto/tokenCipher
  refreshToken: string // ciphertext — decrypt via infrastructure/crypto/tokenCipher
  expiresAt: Date
  scope: string
  providerUserId: string | null
  displayName: string | null
  isPremium: boolean | null
  createdAt: Date
  updatedAt: Date
}

export interface UpsertConnectionInput {
  userId: string
  provider: string
  accessToken: string // ciphertext
  refreshToken: string // ciphertext
  expiresAt: Date
  scope: string
  providerUserId?: string | null
  displayName?: string | null
  isPremium?: boolean | null
}

export interface IConnectionRepository {
  findByUserAndProvider(userId: string, provider: string): Promise<ConnectionRecord | null>
  upsert(data: UpsertConnectionInput): Promise<ConnectionRecord>
  deleteByUserAndProvider(userId: string, provider: string): Promise<void>
  listByUser(userId: string): Promise<ConnectionRecord[]>
}
