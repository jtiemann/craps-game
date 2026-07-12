import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_prod'
const SALT_ROUNDS = 10
const DEFAULT_CHIP_BALANCE = 1000

const users = new Map()     // id → { id, username, passwordHash, chipBalance }
const byUsername = new Map() // username → id

export async function register(username, password) {
  if (!username || !password) {
    throw Object.assign(new Error('Username and password required'), { code: 'VALIDATION_ERROR' })
  }
  if (byUsername.has(username)) {
    throw Object.assign(new Error('Username taken'), { code: 'USERNAME_TAKEN' })
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const user = { id: randomUUID(), username, passwordHash, chipBalance: DEFAULT_CHIP_BALANCE }
  users.set(user.id, user)
  byUsername.set(username, user.id)
  return { id: user.id, username: user.username, chipBalance: user.chipBalance }
}

export async function login(username, password) {
  const userId = byUsername.get(username)
  if (!userId) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' })
  }
  const user = users.get(userId)
  const match = await bcrypt.compare(password, user.passwordHash)
  if (!match) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' })
  }
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyJwt(token) {
  return jwt.verify(token, JWT_SECRET)
}

export function getUser(userId) {
  return users.get(userId) ?? null
}

export function updateChipBalance(userId, amount) {
  const user = users.get(userId)
  if (!user) throw new Error('User not found')
  user.chipBalance = amount
}

export function giveChips(username, amount) {
  const userId = byUsername.get(username)
  if (!userId) throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' })
  const user = users.get(userId)
  user.chipBalance += amount
  return { userId, chipBalance: user.chipBalance }
}

export function clearUsers() {
  users.clear()
  byUsername.clear()
}
