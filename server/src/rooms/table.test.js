import { describe, it, expect, vi } from 'vitest'
vi.mock('../auth/index.js', () => ({ updateChipBalance: vi.fn(), getUser: vi.fn() }))
import { Table } from './table.js'

describe('Table', () => {
  it('initializes in come_out phase with no bets or players', () => {
    const t = new Table('t1')
    const state = t.getState()
    expect(state.phase).toBe('come_out')
    expect(state.point).toBeNull()
    expect(state.players).toHaveLength(0)
    expect(state.bets).toHaveLength(0)
    expect(state.id).toBe('t1')
  })

  it('addPlayer adds a player', () => {
    const t = new Table('t1')
    t.addPlayer('sock1', 'uid1', 'alice', 1000)
    expect(t.getState().players).toHaveLength(1)
    expect(t.getState().players[0]).toMatchObject({ socketId: 'sock1', userId: 'uid1', username: 'alice', chipBalance: 1000 })
  })

  it('removePlayer removes the player and their bets', () => {
    const t = new Table('t1')
    t.addPlayer('sock1', 'uid1', 'alice', 1000)
    t.bets.push({ id: 'b1', socketId: 'sock1', type: 'pass_line', amount: 10 })
    t.bets.push({ id: 'b2', socketId: 'sock2', type: 'pass_line', amount: 10 })
    t.removePlayer('sock1')
    expect(t.getState().players).toHaveLength(0)
    expect(t.bets).toHaveLength(1)
    expect(t.bets[0].socketId).toBe('sock2')
  })

  it('throws TABLE_FULL when maxPlayers exceeded', () => {
    const t = new Table('t1', 2)
    t.addPlayer('s1', 'u1', 'a', 1000)
    t.addPlayer('s2', 'u2', 'b', 1000)
    expect(() => t.addPlayer('s3', 'u3', 'c', 1000)).toThrow()
    expect(() => t.addPlayer('s3', 'u3', 'c', 1000)).toThrow(expect.objectContaining({ code: 'TABLE_FULL' }))
  })

  it('getState returns a plain object (not live references)', () => {
    const t = new Table('t1')
    t.addPlayer('sock1', 'uid1', 'alice', 1000)
    const state = t.getState()
    t.addPlayer('sock2', 'uid2', 'bob', 500)
    expect(state.players).toHaveLength(1) // snapshot, not live
  })
})

describe('Spectator mode', () => {
  it('addSpectator adds to spectators, not players', () => {
    const t = new Table('t1')
    t.addSpectator('s1', 'alice')
    expect(t.spectators.size).toBe(1)
    expect(t.players.size).toBe(0)
    expect(t.isSpectator('s1')).toBe(true)
  })

  it('spectator appears in getState().spectators', () => {
    const t = new Table('t1')
    t.addSpectator('s1', 'alice')
    const state = t.getState()
    expect(state.spectators).toHaveLength(1)
    expect(state.spectators[0]).toMatchObject({ socketId: 's1', username: 'alice' })
  })

  it('spectator is not in shooter order', () => {
    const t = new Table('t1')
    t.addSpectator('s1', 'alice')
    expect(t._shooterOrder).toHaveLength(0)
    expect(t.getState().shooter_socket_id).toBeNull()
  })

  it('removeSpectator removes from spectators', () => {
    const t = new Table('t1')
    t.addSpectator('s1', 'alice')
    t.removeSpectator('s1')
    expect(t.spectators.size).toBe(0)
    expect(t.isSpectator('s1')).toBe(false)
  })

  it('placeBet throws SPECTATOR_CANNOT_BET for spectator', () => {
    const t = new Table('t1')
    t.addSpectator('s1', 'alice')
    expect(() => t.placeBet('s1', 'pass_line', 10))
      .toThrow(expect.objectContaining({ code: 'SPECTATOR_CANNOT_BET' }))
  })
})

describe('Shooter model', () => {
  it('first player to join is the shooter', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    expect(t.isShooter('s1')).toBe(true)
    expect(t.getState().shooter_socket_id).toBe('s1')
  })

  it('second player is NOT the shooter', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.addPlayer('s2', 'u2', 'bob', 1000)
    expect(t.isShooter('s1')).toBe(true)
    expect(t.isShooter('s2')).toBe(false)
  })

  it('shooter advances to next player on seven_out', () => {
    const rolls = [
      { die1: 2, die2: 2 }, // come_out → point_set(4)
      { die1: 3, die2: 4 }, // seven_out → advance shooter
    ]
    const t = new Table('t1', 8, () => rolls.shift())
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.addPlayer('s2', 'u2', 'bob', 1000)
    t.roll() // point_set
    t.roll() // seven_out
    expect(t.isShooter('s1')).toBe(false)
    expect(t.isShooter('s2')).toBe(true)
    expect(t.getState().shooter_socket_id).toBe('s2')
  })

  it('shooter wraps around (last player → first on next seven_out)', () => {
    const rolls = [
      { die1: 2, die2: 2 }, // point_set(4)
      { die1: 3, die2: 4 }, // seven_out → s2 shoots
      { die1: 2, die2: 2 }, // point_set(4)
      { die1: 3, die2: 4 }, // seven_out → back to s1
    ]
    const t = new Table('t1', 8, () => rolls.shift())
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.addPlayer('s2', 'u2', 'bob', 1000)
    t.roll(); t.roll() // s2 now shooting
    t.roll(); t.roll() // back to s1
    expect(t.isShooter('s1')).toBe(true)
  })

  it('shooter advances when current shooter leaves', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.addPlayer('s2', 'u2', 'bob', 1000)
    t.removePlayer('s1')
    expect(t.isShooter('s2')).toBe(true)
  })

  it('shooter is null when all players leave', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.removePlayer('s1')
    expect(t.getState().shooter_socket_id).toBeNull()
  })

  it('shooter does NOT advance on natural or point_made', () => {
    const rolls = [
      { die1: 3, die2: 4 }, // come_out: natural 7
      { die1: 2, die2: 2 }, // point_set(4)
      { die1: 2, die2: 2 }, // point_made(4)
    ]
    const t = new Table('t1', 8, () => rolls.shift())
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.addPlayer('s2', 'u2', 'bob', 1000)
    t.roll() // natural
    t.roll() // point_set
    t.roll() // point_made
    expect(t.isShooter('s1')).toBe(true) // still s1
  })
})
