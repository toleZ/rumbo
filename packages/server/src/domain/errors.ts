export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends DomainError {}
export class ConflictError extends DomainError {}
export class UnauthorizedError extends DomainError {}
export class ForbiddenError extends DomainError {}
export class BadRequestError extends DomainError {}
export class TooManyRequestsError extends DomainError {
  readonly retryAfterSeconds?: number

  constructor(message: string, retryAfterSeconds?: number) {
    super(message)
    this.retryAfterSeconds = retryAfterSeconds
  }
}
