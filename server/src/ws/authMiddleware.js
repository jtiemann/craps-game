import { verifyJwt, getUser } from '../auth/index.js'

export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token
  if (!token) {
    return next(Object.assign(new Error('Authentication required'), { code: 'AUTH_REQUIRED' }))
  }
  try {
    const payload = verifyJwt(token)
    const user = getUser(payload.userId)
    if (!user) {
      return next(Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' }))
    }
    socket.userId = user.id
    socket.username = user.username
    socket.chipBalance = user.chipBalance
    next()
  } catch {
    next(Object.assign(new Error('Invalid token'), { code: 'INVALID_TOKEN' }))
  }
}
