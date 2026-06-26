export interface ISessionPort {
  create(userId: string, rememberMe: boolean): Promise<void>
  clear(token?: string): Promise<void>
}
