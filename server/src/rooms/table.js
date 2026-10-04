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

const ALL_BET_TYPES = new Set(Object.values(BET_TYPES))

const PLACEABLE_COME_OUT = new Set([BET_TYPES.PASS_LINE, BET_TYPES.DONT_PASS, BET_TYPES.FIELD,
  BET_TYPES.ANY_SEVEN, BET_TYPES.ANY_CRAPS, BET_TYPES.YO, BET_TYPES.ACES,
  BET_TYPES.ACE_DEUCE, BET_TYPES.BOXCARS, BET_TYPES.HORN,
  // Come bets with established points survive point_made into come-out; odds may be added at any time
  BET_TYPES.COME_ODDS, BET_TYPES.DONT_COME_ODDS])
const PLACEABLE_POINT = new Set([
  BET_TYPES.PASS_ODDS, BET_TYPES.DONT_PASS_ODDS,
  BET_TYPES.COME, BET_TYPES.DONT_COME, BET_TYPES.COME_ODDS, BET_TYPES.DONT_COME_ODDS,
  BET_TYPES.PLACE_4, BET_TYPES.PLACE_5,
  BET_TYPES.PLACE_6, BET_TYPES.PLACE_8, BET_TYPES.PLACE_9, BET_TYPES.PLACE_10,
  BET_TYPES.HARD_4, BET_TYPES.HARD_6, BET_TYPES.HARD_8, BET_TYPES.HARD_10,
  BET_TYPES.FIELD, BET_TYPES.ANY_SEVEN, BET_TYPES.ANY_CRAPS, BET_TYPES.YO,
  BET_TYPES.ACES, BET_TYPES.ACE_DEUCE, BET_TYPES.BOXCARS, BET_TYPES.HORN,
  BET_TYPES.BIG_6, BET_TYPES.BIG_8])

// Bets a player may hold only one of at a time
const SINGLE_BET_TYPES = new Set([BET_TYPES.PASS_LINE, BET_TYPES.DONT_PASS])

export class Table {
  constructor(id, maxPlayers = 8, rollFn = null) {
    this.id = id
    this.maxPlayers = maxPlayers
    this.players = new Map()
    this.spectators = new Map()
    this.bets = []
    this.gameState = createGameState()
    this._rollFn = rollFn ?? (() => rollDice(HOUSE_WEIGHTS))
    this._shooterSocketId = null
    this._shooterOrder = []  // insertion-order socketIds for rotation
  }

  addPlayer(socketId, userId, username, chipBalance) {
    if (this.players.size >= this.maxPlayers) {
      throw Object.assign(new Error('Table is full'), { code: 'TABLE_FULL' })
    }
    this.players.set(socketId, { socketId, userId, username, chipBalance })
    this._shooterOrder.push(socketId)
    if (!this._shooterSocketId) this._shooterSocketId = socketId
  }

  addSpectator(socketId, username) {
    this.spectators.set(socketId, { socketId, username })
  }

  removePlayer(socketId) {
    this.players.delete(socketId)
    this.bets = this.bets.filter(b => b.socketId !== socketId)
    this._shooterOrder = this._shooterOrder.filter(id => id !== socketId)
    if (this._shooterSocketId === socketId) this._advanceShooter()
  }

  removeSpectator(socketId) {
    this.spectators.delete(socketId)
  }

  // Player leaves the table: refund the stakes of their still-active (unresolved) bets,
  // then remove them (which drops their bets, rotation slot, and advances the shooter
  // if they were shooting). Returns { userId, username, chipBalance } or null if absent.
  cashOut(socketId) {
    const player = this.players.get(socketId)
    if (!player) return null
    const refund = this.bets
      .filter(b => b.socketId === socketId)
      .reduce((sum, b) => sum + b.amount, 0)
    if (refund > 0) {
      player.chipBalance += refund
      updateChipBalance(player.userId, player.chipBalance)
    }
    const result = { userId: player.userId, username: player.username, chipBalance: player.chipBalance }
    this.removePlayer(socketId)
    return result
  }

  isSpectator(socketId) {
    return this.spectators.has(socketId)
  }

  reconnectPlayer(oldSocketId, newSocketId) {
    const player = this.players.get(oldSocketId)
    if (!player) return false
    const updated = { ...player, socketId: newSocketId }
    this.players.delete(oldSocketId)
    this.players.set(newSocketId, updated)
    this.bets = this.bets.map(b => b.socketId === oldSocketId ? { ...b, socketId: newSocketId } : b)
    this._shooterOrder = this._shooterOrder.map(id => id === oldSocketId ? newSocketId : id)
    if (this._shooterSocketId === oldSocketId) this._shooterSocketId = newSocketId
    return true
  }

  reconnectSpectator(oldSocketId, newSocketId) {
    const spectator = this.spectators.get(oldSocketId)
    if (!spectator) return false
    const updated = { ...spectator, socketId: newSocketId }
    this.spectators.delete(oldSocketId)
    this.spectators.set(newSocketId, updated)
    return true
  }

  isShooter(socketId) {
    return this._shooterSocketId === socketId
  }

  _advanceShooter() {
    const active = this._shooterOrder.filter(id => this.players.has(id))
    this._shooterOrder = active
    if (active.length === 0) { this._shooterSocketId = null; return }
    const idx = active.indexOf(this._shooterSocketId)
    this._shooterSocketId = active[(idx + 1) % active.length]
  }

  placeBet(socketId, betType, amount, target = null) {
    if (this.spectators.has(socketId)) throw Object.assign(new Error('Spectators cannot bet'), { code: 'SPECTATOR_CANNOT_BET' })
    const player = this.players.get(socketId)
    if (!player) throw Object.assign(new Error('Not at table'), { code: 'NOT_AT_TABLE' })
    if (!ALL_BET_TYPES.has(betType)) throw Object.assign(new Error(`Unknown bet type: ${betType}`), { code: 'INVALID_BET_TYPE' })
    if (amount <= 0) throw Object.assign(new Error('Amount must be positive'), { code: 'INVALID_AMOUNT' })

    const allowed = this.gameState.phase === 'come_out' ? PLACEABLE_COME_OUT : PLACEABLE_POINT
    if (!allowed.has(betType)) {
      throw Object.assign(new Error(`${betType} not allowed in ${this.gameState.phase} phase`), { code: 'INVALID_PHASE' })
    }

    if (SINGLE_BET_TYPES.has(betType) && this.bets.some(b => b.socketId === socketId && b.type === betType)) {
      throw Object.assign(new Error(`Already have a ${betType} bet`), { code: 'DUPLICATE_BET' })
    }

    // Odds bets: require a base bet and replace any existing odds (player adjusts amount)
    let replacedBet = null
    if (betType === BET_TYPES.PASS_ODDS) {
      if (!this.bets.some(b => b.socketId === socketId && b.type === BET_TYPES.PASS_LINE)) {
        throw Object.assign(new Error('No Pass Line bet to place odds on'), { code: 'NO_BASE_BET' })
      }
      replacedBet = this.bets.find(b => b.socketId === socketId && b.type === BET_TYPES.PASS_ODDS) ?? null
    } else if (betType === BET_TYPES.DONT_PASS_ODDS) {
      if (!this.bets.some(b => b.socketId === socketId && b.type === BET_TYPES.DONT_PASS)) {
        throw Object.assign(new Error("No Don't Pass bet to place odds on"), { code: 'NO_BASE_BET' })
      }
      replacedBet = this.bets.find(b => b.socketId === socketId && b.type === BET_TYPES.DONT_PASS_ODDS) ?? null
    } else if (betType === BET_TYPES.COME_ODDS) {
      if (!target) throw Object.assign(new Error('Target number required for come odds'), { code: 'MISSING_TARGET' })
      if (!this.bets.some(b => b.socketId === socketId && b.type === BET_TYPES.COME && b.target === target)) {
        throw Object.assign(new Error(`No come bet on ${target} to place odds on`), { code: 'NO_BASE_BET' })
      }
      replacedBet = this.bets.find(b => b.socketId === socketId && b.type === BET_TYPES.COME_ODDS && b.target === target) ?? null
    } else if (betType === BET_TYPES.DONT_COME_ODDS) {
      if (!target) throw Object.assign(new Error("Target number required for don't come odds"), { code: 'MISSING_TARGET' })
      if (!this.bets.some(b => b.socketId === socketId && b.type === BET_TYPES.DONT_COME && b.target === target)) {
        throw Object.assign(new Error(`No don't come bet on ${target} to place odds on`), { code: 'NO_BASE_BET' })
      }
      replacedBet = this.bets.find(b => b.socketId === socketId && b.type === BET_TYPES.DONT_COME_ODDS && b.target === target) ?? null
    }

    // Net cost after refunding any replaced odds
    const netCost = amount - (replacedBet?.amount ?? 0)
    if (player.chipBalance < netCost) {
      throw Object.assign(new Error('Insufficient chips'), { code: 'INSUFFICIENT_CHIPS' })
    }
    if (replacedBet) this.bets = this.bets.filter(b => b !== replacedBet)

    player.chipBalance -= netCost
    updateChipBalance(player.userId, player.chipBalance)

    const bet = { id: randomUUID(), socketId, playerId: player.userId, type: betType, amount, target }
    this.bets.push(bet)
    return bet
  }

  // Take a bet down and refund its stake. Pass Line is a contract once the point is set,
  // and a Come bet is a contract once it has travelled to a number; everything else
  // (place, hard ways, big 6/8, odds, props, Don't Pass / Don't Come) can come down.
  // Taking down a Don't bet also takes down its lay odds.
  removeBet(socketId, betId) {
    const player = this.players.get(socketId)
    if (!player) throw Object.assign(new Error('Not at table'), { code: 'NOT_AT_TABLE' })
    const bet = this.bets.find(b => b.id === betId && b.socketId === socketId)
    if (!bet) throw Object.assign(new Error('Bet not found'), { code: 'BET_NOT_FOUND' })
    if (bet.type === BET_TYPES.PASS_LINE && this.gameState.phase !== 'come_out') {
      throw Object.assign(new Error('Pass Line cannot be removed once the point is set'), { code: 'BET_LOCKED' })
    }
    if (bet.type === BET_TYPES.COME && bet.target !== null) {
      throw Object.assign(new Error('A Come bet on a number cannot be removed'), { code: 'BET_LOCKED' })
    }
    const dependent = bet.type === BET_TYPES.DONT_PASS ? b => b.type === BET_TYPES.DONT_PASS_ODDS
      : bet.type === BET_TYPES.DONT_COME ? b => b.type === BET_TYPES.DONT_COME_ODDS && b.target === bet.target
      : () => false
    const removed = this.bets.filter(b => b === bet || (b.socketId === socketId && dependent(b)))
    this.bets = this.bets.filter(b => !removed.includes(b))
    player.chipBalance += removed.reduce((sum, b) => sum + b.amount, 0)
    updateChipBalance(player.userId, player.chipBalance)
    return removed
  }

  shooterHasLineBet() {
    return this.bets.some(b =>
      b.socketId === this._shooterSocketId &&
      (b.type === BET_TYPES.PASS_LINE || b.type === BET_TYPES.DONT_PASS)
    )
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

    // Dice pass to next player on seven-out
    if (event === 'seven_out') this._advanceShooter()

    return { die1, die2, total, event, resolved, updates }
  }

  getState() {
    return {
      id: this.id,
      phase: this.gameState.phase,
      point: this.gameState.point,
      shooter_socket_id: this._shooterSocketId,
      players: Array.from(this.players.values()),
      spectators: Array.from(this.spectators.values()),
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
