import { describe, it, expect, beforeEach } from 'vitest'
import { register, login, verifyJwt, getUser, clearUsers } from './index.js'

beforeEach(() => clearUsers())

describe('register', () => {
  it('creates a user with the given username and default chip balance', async () => {
    const user = await register('alice', 'pass123')
    expect(user.username).toBe('alice')
    expect(user.chipBalance).toBe(1000)
    expect(user.id).toBeDefined()
    expect(user.passwordHash).toBeUndefined()
  })

  it('throws USERNAME_TAKEN when username already registered', async () => {
    await register('alice', 'pass1')
    await expect(register('alice', 'pass2')).rejects.toMatchObject({ code: 'USERNAME_TAKEN' })
  })

  it('throws VALIDATION_ERROR on empty username', async () => {
    await expect(register('', 'pass')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('throws VALIDATION_ERROR on empty password', async () => {
    await expect(register('alice', '')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

describe('login', () => {
  it('returns a JWT token for valid credentials', async () => {
    await register('alice', 'pass123')
    const token = await login('alice', 'pass123')
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('throws INVALID_CREDENTIALS for wrong password', async () => {
    await register('alice', 'pass123')
    await expect(login('alice', 'wrongpass')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('throws INVALID_CREDENTIALS for unknown username', async () => {
    await expect(login('nobody', 'pass')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })
})

describe('verifyJwt', () => {
  it('returns payload with userId for a valid token', async () => {
    await register('alice', 'pass123')
    const token = await login('alice', 'pass123')
    const payload = verifyJwt(token)
    expect(payload.userId).toBeDefined()
  })

  it('throws on an invalid token', () => {
    expect(() => verifyJwt('not.a.token')).toThrow()
  })
})

describe('getUser', () => {
  it('returns the user object by id', async () => {
    const { id } = await register('alice', 'pass123')
    const user = getUser(id)
    expect(user.username).toBe('alice')
    expect(user.chipBalance).toBe(1000)
  })

  it('returns null for unknown id', () => {
    expect(getUser('nonexistent')).toBeNull()
  })
})
