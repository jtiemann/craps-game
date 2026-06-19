import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
})

io.on('connection', (socket) => {
  console.log('client connected', socket.id)
  socket.on('disconnect', () => console.log('client disconnected', socket.id))
})

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => console.log(`Server listening on :${PORT}`))
