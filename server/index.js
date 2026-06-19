import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import authRoutes from './src/auth/routes.js'
import { socketAuthMiddleware } from './src/ws/authMiddleware.js'
import { Table } from './src/rooms/table.js'
import * as P from '../shared/protocol.js'

const app = express()
app.use(express.json())
app.use(authRoutes)

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
})

io.use(socketAuthMiddleware)

const table = new Table('main')

io.on('connection', (socket) => {
  console.log('client connected', socket.id, socket.username)

  socket.on(P.JOIN_TABLE, () => {
    try {
      table.addPlayer(socket.id, socket.userId, socket.username, socket.chipBalance)
      socket.join('main')
      io.to('main').emit(P.TABLE_STATE, table.getState())
    } catch (err) {
      socket.emit(P.ERROR, { message: err.message, code: err.code })
    }
  })

  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id)
    table.removePlayer(socket.id)
    if (table.players.size > 0) {
      io.to('main').emit(P.TABLE_STATE, table.getState())
    }
  })
})

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => console.log(`Server listening on :${PORT}`))
