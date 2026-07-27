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

describe('cashOut', () => {
  it('refunds active bet stakes, removes the player, and advances the shooter', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.addPlayer('s2', 'u2', 'bob', 1000)
    t.placeBet('s1', 'pass_line', 10)  // alice: chips 990, one active bet
    expect(t.players.get('s1').chipBalance).toBe(990)
    expect(t.isShooter('s1')).toBe(true)

    const info = t.cashOut('s1')
    expect(info).toMatchObject({ userId: 'u1', username: 'alice', chipBalance: 1000 })  // stake refunded
    expect(t.players.has('s1')).toBe(false)
    expect(t.bets.filter(b => b.socketId === 's1')).toHaveLength(0)
    expect(t.isShooter('s2')).toBe(true)  // dice passed to next player
  })

  it('returns null for someone who is not a seated player', () => {
    const t = new Table('t1')
    expect(t.cashOut('ghost')).toBeNull()
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

describe('T16 — server-side validation', () => {
  it('placeBet throws INVALID_BET_TYPE for unknown bet string', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    expect(() => t.placeBet('s1', 'bogus_bet', 10))
      .toThrow(expect.objectContaining({ code: 'INVALID_BET_TYPE' }))
  })

  it('placeBet throws DUPLICATE_BET for second pass_line', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.placeBet('s1', 'pass_line', 10)
    expect(() => t.placeBet('s1', 'pass_line', 10))
      .toThrow(expect.objectContaining({ code: 'DUPLICATE_BET' }))
  })

  it('placeBet throws DUPLICATE_BET for second dont_pass', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.placeBet('s1', 'dont_pass', 10)
    expect(() => t.placeBet('s1', 'dont_pass', 10))
      .toThrow(expect.objectContaining({ code: 'DUPLICATE_BET' }))
  })

  it('shooterHasLineBet returns false when shooter has only field bet', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.placeBet('s1', 'field', 10)
    expect(t.shooterHasLineBet()).toBe(false)
  })

  it('shooterHasLineBet returns true when shooter has pass_line', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.placeBet('s1', 'pass_line', 10)
    expect(t.shooterHasLineBet()).toBe(true)
  })

  it('shooterHasLineBet returns true when shooter has dont_pass', () => {
    const t = new Table('t1')
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.placeBet('s1', 'dont_pass', 10)
    expect(t.shooterHasLineBet()).toBe(true)
  })
})

describe('Come odds', () => {
  // Helper: build a table in point phase with a come bet already on a number
  function tableWithComeOnSix() {
    const rolls = [
      { die1: 3, die2: 3 }, // come_out → point 6
      { die1: 2, die2: 3 }, // come bet with no target resolves → come_point_set(5)
    ]
    const t = new Table('t1', 8, () => rolls.shift())
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.placeBet('s1', 'pass_line', 10)
    t.roll()                          // phase → point(6)
    t.placeBet('s1', 'come', 10)
    t.roll()                          // come bet moves to target 5
    return t
  }

  it('allows come_odds in come_out phase when a come bet survived point_made', () => {
    // come bets with established targets survive point_made and stay active in come_out
    const rolls = [
      { die1: 3, die2: 3 }, // come_out → point 6
      { die1: 2, die2: 3 }, // point phase → come bet gets target 5
      { die1: 3, die2: 3 }, // point_made(6) → phase resets to come_out; come bet on 5 survives
    ]
    const t = new Table('t1', 8, () => rolls.shift())
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.placeBet('s1', 'pass_line', 10)
    t.roll()                          // point 6
    t.placeBet('s1', 'come', 10)
    t.roll()                          // come → target 5
    t.roll()                          // point_made → come_out phase, come bet on 5 still active
    expect(t.gameState.phase).toBe('come_out')
    expect(t.bets.some(b => b.type === 'come' && b.target === 5)).toBe(true)
    // Player should be able to take odds on the surviving come bet
    expect(() => t.placeBet('s1', 'come_odds', 10, 5)).not.toThrow()
  })

  it('rejects come_odds when no base come bet exists on that number', () => {
    const t = tableWithComeOnSix()
    expect(() => t.placeBet('s1', 'come_odds', 10, 9))
      .toThrow(expect.objectContaining({ code: 'NO_BASE_BET' }))
  })

  it('rejects come_odds when target is missing', () => {
    const t = tableWithComeOnSix()
    expect(() => t.placeBet('s1', 'come_odds', 10, null))
      .toThrow(expect.objectContaining({ code: 'MISSING_TARGET' }))
  })

  it('accepts come_odds when a come bet is on that number', () => {
    const t = tableWithComeOnSix()
    const before = t.players.get('s1').chipBalance
    t.placeBet('s1', 'come_odds', 20, 5)
    expect(t.bets.some(b => b.type === 'come_odds' && b.target === 5 && b.amount === 20)).toBe(true)
    expect(t.players.get('s1').chipBalance).toBe(before - 20)
  })

  it('come_odds wins with correct payout when come point is hit', () => {
    const rolls = [
      { die1: 3, die2: 3 }, // come_out → point 6
      { die1: 2, die2: 3 }, // come_point_set(5)
      { die1: 2, die2: 3 }, // come point 5 hit → come wins, come_odds wins
    ]
    const t = new Table('t1', 8, () => rolls.shift())
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.placeBet('s1', 'pass_line', 10)
    t.roll()                          // point 6
    t.placeBet('s1', 'come', 10)
    t.roll()                          // come → 5
    t.placeBet('s1', 'come_odds', 20, 5)
    const before = t.players.get('s1').chipBalance
    t.roll()                          // total=5 → come wins (even money), come_odds wins (3:2)
    const after = t.players.get('s1').chipBalance
    // come: 10 stake + 10 win = +20; come_odds: 20 stake + 30 win = +50; net = +70
    expect(after - before).toBe(70)
  })

  it('come_odds loses on seven-out', () => {
    const rolls = [
      { die1: 3, die2: 3 }, // point 6
      { die1: 2, die2: 3 }, // come_point_set(5)
      { die1: 3, die2: 4 }, // seven_out → come and come_odds both lose
    ]
    const t = new Table('t1', 8, () => rolls.shift())
    t.addPlayer('s1', 'u1', 'alice', 1000)
    t.placeBet('s1', 'pass_line', 10)
    t.roll()
    t.placeBet('s1', 'come', 10)
    t.roll()
    t.placeBet('s1', 'come_odds', 20, 5)
    t.roll()                          // seven_out
    expect(t.bets.some(b => b.type === 'come_odds')).toBe(false)
    expect(t.bets.some(b => b.type === 'come')).toBe(false)
  })

  it('replacing come_odds refunds the difference in chips', () => {
    const t = tableWithComeOnSix()
    t.placeBet('s1', 'come_odds', 20, 5)
    const before = t.players.get('s1').chipBalance
    t.placeBet('s1', 'come_odds', 30, 5)  // replace — net cost should be 10
    expect(t.players.get('s1').chipBalance).toBe(before - 10)
    expect(t.bets.filter(b => b.type === 'come_odds' && b.target === 5)).toHaveLength(1)
    expect(t.bets.find(b => b.type === 'come_odds' && b.target === 5).amount).toBe(30)
  })
})

describe('T17 — reconnection', () => {
  it('reconnectPlayer swaps socketId in players map', () => {
    const t = new Table('t1')
    t.addPlayer('old', 'u1', 'alice', 1000)
    const ok = t.reconnectPlayer('old', 'new')
    expect(ok).toBe(true)
    expect(t.players.has('new')).toBe(true)
    expect(t.players.has('old')).toBe(false)
    expect(t.players.get('new').socketId).toBe('new')
  })

  it('reconnectPlayer updates bets socketId', () => {
    const t = new Table('t1')
    t.addPlayer('old', 'u1', 'alice', 1000)
    t.placeBet('old', 'pass_line', 10)
    t.reconnectPlayer('old', 'new')
    expect(t.bets[0].socketId).toBe('new')
  })

  it('reconnectPlayer preserves shooter status', () => {
    const t = new Table('t1')
    t.addPlayer('old', 'u1', 'alice', 1000)
    t.reconnectPlayer('old', 'new')
    expect(t.isShooter('new')).toBe(true)
    expect(t.getState().shooter_socket_id).toBe('new')
  })

  it('reconnectPlayer returns false for unknown socketId', () => {
    const t = new Table('t1')
    expect(t.reconnectPlayer('ghost', 'new')).toBe(false)
  })

  it('reconnectSpectator swaps socketId', () => {
    const t = new Table('t1')
    t.addSpectator('old', 'bob')
    const ok = t.reconnectSpectator('old', 'new')
    expect(ok).toBe(true)
    expect(t.spectators.has('new')).toBe(true)
    expect(t.spectators.has('old')).toBe(false)
  })
})
