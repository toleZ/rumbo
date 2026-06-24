export interface BetaRequestRecord {
  id: string
  name: string
  email: string
  message: string | null
}

export interface CreateBetaRequestInput {
  name: string
  email: string
  message?: string | null
}

export interface IBetaRepository {
  findByEmail(email: string): Promise<BetaRequestRecord | null>
  create(data: CreateBetaRequestInput): Promise<void>
}
