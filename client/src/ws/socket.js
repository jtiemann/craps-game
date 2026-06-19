import { io } from 'socket.io-client'

let socket = null

export function connectSocket(token) {
  socket = io({ auth: { token } })
  return socket
}

export function getSocket() {
  return socket
}
