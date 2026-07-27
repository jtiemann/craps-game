import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import authRoutes from './src/auth/routes.js'
import { giveChips } from './src/auth/index.js'
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
const RECONNECT_HOLD_MS = 30_000
const ROLL_TIMEOUT_MS = 3 * 60_000  // shooter must roll within 3 min or they are cashed out

// userId → { oldSocketId, timer, isSpectator }
const pendingReconnect = new Map()

function clearReconnectHold(userId) {
  const held = pendingReconnect.get(userId)
  if (held) {
    clearTimeout(held.timer)
    pendingReconnect.delete(userId)
  }
}

// ── Between-rolls shooter timeout ─────────────────────────────────────────────
// The timer is armed for a specific shooter socket id. It resets on every roll and
// whenever the shooter changes, so it always fires against the player it was watching.
let rollTimer = null
let armedFor = null

function armRollTimer() {
  if (rollTimer) clearTimeout(rollTimer)
  armedFor = table._shooterSocketId
  rollTimer = armedFor ? setTimeout(onRollTimeout, ROLL_TIMEOUT_MS) : null
}

// Re-arm only when the shooter actually changed (a new shooter gets a fresh window).
function syncRollTimer() {
  if (table._shooterSocketId !== armedFor) armRollTimer()
}

function onRollTimeout() {
  const shooterId = armedFor
  const sock = io.sockets.sockets.get(shooterId)
  const info = table.cashOut(shooterId)  // advances the shooter if they were shooting
  if (info) {
    clearReconnectHold(info.userId)
    if (sock) {
      sock.emit(P.CASHED_OUT, { reason: 'timeout', chip_balance: info.chipBalance })
      sock.leave('main')
    }
  }
  io.to('main').emit(P.TABLE_STATE, table.getState())
  armRollTimer()  // fresh window for the next shooter (clears if the table is now empty)
}

io.on('connection', (socket) => {
  console.log('client connected', socket.id, socket.username)

  socket.on(P.JOIN_TABLE, () => {
    try {
      // Restore session if disconnected within hold window
      const held = pendingReconnect.get(socket.userId)
      if (held && !held.isSpectator) {
        clearReconnectHold(socket.userId)
        if (table.reconnectPlayer(held.oldSocketId, socket.id)) {
          socket.join('main')
          socket.emit(P.RECONNECTED, table.getState())
          io.to('main').emit(P.TABLE_STATE, table.getState())
          syncRollTimer()
          return
        }
      }
      table.addPlayer(socket.id, socket.userId, socket.username, socket.chipBalance)
      socket.join('main')
      io.to('main').emit(P.TABLE_STATE, table.getState())
      syncRollTimer()
    } catch (err) {
      socket.emit(P.ERROR, { message: err.message, code: err.code })
    }
  })

  socket.on(P.JOIN_AS_SPECTATOR, () => {
    try {
      const held = pendingReconnect.get(socket.userId)
      if (held && held.isSpectator) {
        clearReconnectHold(socket.userId)
        if (table.reconnectSpectator(held.oldSocketId, socket.id)) {
          socket.join('main')
          socket.emit(P.RECONNECTED, table.getState())
          return
        }
      }
      table.addSpectator(socket.id, socket.username)
      socket.join('main')
      socket.emit(P.TABLE_STATE, table.getState())
    } catch (err) {
      socket.emit(P.ERROR, { message: err.message, code: err.code })
    }
  })

  socket.on(P.PLACE_BET, ({ bet_type, amount, target = null }) => {
    try {
      const bet = table.placeBet(socket.id, bet_type, amount, target)
      io.to('main').emit(P.BET_PLACED, { bet, table_state: table.getState() })
    } catch (err) {
      socket.emit(P.ERROR, { message: err.message, code: err.code })
    }
  })

  socket.on(P.READY_FOR_ROLL, () => {
    try {
      if (!table._shooterSocketId) {
        socket.emit(P.ERROR, { message: 'No shooter at table', code: 'NO_SHOOTER' })
        return
      }
      if (!table.isShooter(socket.id)) {
        socket.emit(P.ERROR, { message: 'Not your turn to shoot', code: 'NOT_SHOOTER' })
        return
      }
      if (!table.shooterHasLineBet()) {
        socket.emit(P.ERROR, { message: "Shooter must have a Pass Line or Don't Pass bet", code: 'SHOOTER_NEEDS_LINE_BET' })
        return
      }
      const { die1, die2, total, event, resolved, updates } = table.roll()
      armRollTimer()  // reset the between-rolls window (advances to new shooter on seven-out)
      const rollTimestamp = Date.now()
      io.to('main').emit(P.ROLL_START, { die1, die2, total, timestamp: rollTimestamp })
      io.to('main').emit(P.ROLL_RESOLVED, { die1, die2, total, event, resolved, updates, table_state: table.getState() })
      // Chip updates
      for (const res of resolved) {
        if (res.payout > 0) {
          const player = table.getState().players.find(p => p.userId === res.playerId)
          if (player) {
            io.to('main').emit(P.CHIP_UPDATE, { player_id: res.playerId, chip_balance: player.chipBalance })
          }
        }
      }
    } catch (err) {
      socket.emit(P.ERROR, { message: err.message, code: err.code })
    }
  })

  socket.on(P.CASH_OUT, () => {
    const isSpec = table.isSpectator(socket.id)
    const info = table.cashOut(socket.id)  // null if not a seated player
    if (isSpec) table.removeSpectator(socket.id)
    clearReconnectHold(socket.userId)      // don't hold a seat for someone who left
    socket.emit(P.CASHED_OUT, { reason: 'left', chip_balance: info?.chipBalance ?? socket.chipBalance })
    socket.leave('main')
    io.to('main').emit(P.TABLE_STATE, table.getState())
    syncRollTimer()  // shooter may have advanced
  })

  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id)
    const isPlayer = table.players.has(socket.id)
    const isSpec = table.spectators.has(socket.id)
    if (!isPlayer && !isSpec) return

    // Hold session for 30s to allow reconnection
    const timer = setTimeout(() => {
      pendingReconnect.delete(socket.userId)
      table.removePlayer(socket.id)
      table.removeSpectator(socket.id)
      const anyoneLeft = table.players.size > 0 || table.spectators.size > 0
      if (anyoneLeft) io.to('main').emit(P.TABLE_STATE, table.getState())
      syncRollTimer()  // shooter may have advanced when the held seat was released
    }, RECONNECT_HOLD_MS)

    pendingReconnect.set(socket.userId, { oldSocketId: socket.id, timer, isSpectator: isSpec })
  })
})

// Admin: top up any player's chip balance
app.post('/admin/give-chips', (req, res) => {
  try {
    const { username, amount } = req.body
    if (!username || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'username and positive amount required' })
    }
    const { userId, chipBalance } = giveChips(username, amount)
    // Also patch the live table record if the player is currently seated
    const seated = [...table.players.values()].find(p => p.userId === userId)
    if (seated) {
      seated.chipBalance = chipBalance
      io.to('main').emit(P.TABLE_STATE, table.getState())
    }
    res.json({ username, chipBalance })
  } catch (err) {
    res.status(404).json({ error: err.message, code: err.code })
  }
})

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => console.log(`Server listening on :${PORT}`))
