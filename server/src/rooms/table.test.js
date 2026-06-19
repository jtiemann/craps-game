import { describe, it, expect } from 'vitest'
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
