import { randomUUID } from 'crypto'
import { createGameState, applyComeOutRoll, applyPointRoll } from '../game/state.js'
import { BET_TYPES } from '../game/bets.js'
import { resolveAllBets } from '../game/resolution.js'
import { rollDice, FAIR_WEIGHTS } from '../game/rng.js'
import { getUser, updateChipBalance } from '../auth/index.js'

// House-edge weight table — 7 is slightly favored to push house edge above natural
const HOUSE_WEIGHTS = { ...FAIR_WEIGHTS }
for (let d1 = 1; d1 <= 6; d1++) {
  for (let d2 = 1; d2 <= 6; d2++) {
    HOUSE_WEIGHTS[`${d1},${d2}`] = (d1 + d2 === 7) ? 1.12 : 1.0
  }
}

const PLACEABLE_COME_OUT = new Set([BET_TYPES.PASS_LINE, BET_TYPES.DONT_PASS, BET_TYPES.FIELD,
  BET_TYPES.ANY_SEVEN, BET_TYPES.ANY_CRAPS, BET_TYPES.YO, BET_TYPES.ACES,
  BET_TYPES.ACE_DEUCE, BET_TYPES.BOXCARS, BET_TYPES.HORN])
const PLACEABLE_POINT = new Set([BET_TYPES.PASS_ODDS, BET_TYPES.DONT_PASS_ODDS,
  BET_TYPES.COME, BET_TYPES.DONT_COME, BET_TYPES.PLACE_4, BET_TYPES.PLACE_5,
  BET_TYPES.PLACE_6, BET_TYPES.PLACE_8, BET_TYPES.PLACE_9, BET_TYPES.PLACE_10,
  BET_TYPES.HARD_4, BET_TYPES.HARD_6, BET_TYPES.HARD_8, BET_TYPES.HARD_10,
  BET_TYPES.FIELD, BET_TYPES.ANY_SEVEN, BET_TYPES.ANY_CRAPS, BET_TYPES.YO,
  BET_TYPES.ACES, BET_TYPES.ACE_DEUCE, BET_TYPES.BOXCARS, BET_TYPES.HORN,
  BET_TYPES.BIG_6, BET_TYPES.BIG_8])

export class Table {
  constructor(id, maxPlayers = 8, rollFn = null) {
    this.id = id
    this.maxPlayers = maxPlayers
    this.players = new Map()
    this.bets = []
    this.gameState = createGameState()
    this._rollFn = rollFn ?? (() => rollDice(HOUSE_WEIGHTS))
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

  placeBet(socketId, betType, amount) {
    const player = this.players.get(socketId)
    if (!player) throw Object.assign(new Error('Not at table'), { code: 'NOT_AT_TABLE' })
    if (amount <= 0) throw Object.assign(new Error('Amount must be positive'), { code: 'INVALID_AMOUNT' })
    if (player.chipBalance < amount) throw Object.assign(new Error('Insufficient chips'), { code: 'INSUFFICIENT_CHIPS' })

    const allowed = this.gameState.phase === 'come_out' ? PLACEABLE_COME_OUT : PLACEABLE_POINT
    if (!allowed.has(betType)) {
      throw Object.assign(new Error(`${betType} not allowed in ${this.gameState.phase} phase`), { code: 'INVALID_PHASE' })
    }

    player.chipBalance -= amount
    updateChipBalance(player.userId, player.chipBalance)

    const bet = { id: randomUUID(), socketId, playerId: player.userId, type: betType, amount, target: null }
    this.bets.push(bet)
    return bet
  }

  roll() {
    const { die1, die2 } = this._rollFn()
    const total = die1 + die2

    const { event, newState } = this.gameState.phase === 'come_out'
      ? applyComeOutRoll(this.gameState, die1, die2)
      : applyPointRoll(this.gameState, die1, die2)

    const { resolved, remaining, updates } = resolveAllBets(this.bets, die1, die2, this.gameState)
    this.bets = remaining

    // Apply payouts
    for (const res of resolved) {
      const player = this._playerByUserId(res.playerId)
      if (player && res.payout > 0) {
        player.chipBalance += res.payout
        updateChipBalance(res.playerId, player.chipBalance)
      }
    }

    this.gameState = newState

    return { die1, die2, total, event, resolved, updates }
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

  _playerByUserId(userId) {
    for (const p of this.players.values()) {
      if (p.userId === userId) return p
    }
    return null
  }
}
