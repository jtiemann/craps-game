import { createGameState } from '../game/state.js'

export class Table {
  constructor(id, maxPlayers = 8) {
    this.id = id
    this.maxPlayers = maxPlayers
    this.players = new Map() // socketId → { userId, username, chipBalance }
    this.bets = []
    this.gameState = createGameState()
  }

  addPlayer(socketId, userId, username, chipBalance) {
    if (this.players.size >= this.maxPlayers) {
      throw Object.assign(new Error('Table is full'), { code: 'TABLE_FULL' })
    }
    this.players.set(socketId, { socketId, userId, username, chipBalance })
  }

  removePlayer(socketId) {
    this.players.delete(socketId)
    this.bets = this.bets.filter(b => b.socketId !== socketId)
  }

  getState() {
    return {
      id: this.id,
      phase: this.gameState.phase,
      point: this.gameState.point,
      players: Array.from(this.players.values()),
      bets: [...this.bets],
    }
  }
}
