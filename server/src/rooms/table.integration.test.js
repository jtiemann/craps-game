import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Table } from './table.js'
import { BET_TYPES } from '../game/bets.js'

vi.mock('../auth/index.js', () => ({
  updateChipBalance: vi.fn(),
  getUser: vi.fn(),
}))

function makeTable(rolls) {
  const seq = [...rolls]
  return new Table('t', 8, () => {
    const r = seq.shift()
    if (!r) throw new Error('No more rolls in test sequence')
    return { ...r, total: r.die1 + r.die2 }
  })
}

// ─── T10: Come + Don't Come + Place bets ──────────────────────────────────────

describe('T10 — Come bet', () => {
  it('traveling come bet transitions to on-point then wins when target rolls', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // come_out → point_set(6)
      { die1: 4, die2: 4 }, // point phase → come_point_set(8)
      { die1: 4, die2: 4 }, // come bet (target=8) wins
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)

    // Establish point 6
    const r1 = table.roll()
    expect(r1.event).toBe('point_set')
    expect(table.gameState.point).toBe(6)

    // Place a traveling come bet ($10)
    table.placeBet('s1', BET_TYPES.COME, 10)
    expect(table.bets[0].target).toBeNull()
    expect(table.getState().players[0].chipBalance).toBe(990)

    // Roll 8 → come_point_set; bet stays in remaining with target updated
    const r2 = table.roll()
    expect(r2.event).toBe('roll')
    expect(r2.updates).toHaveLength(1)
    expect(r2.updates[0].target).toBe(8)
    expect(table.bets).toHaveLength(1)
    expect(table.bets[0].target).toBe(8)

    // Roll 8 again → come bet wins, payout = 20
    const r3 = table.roll()
    const win = r3.resolved.find(r => r.result === 'win')
    expect(win).toBeDefined()
    expect(win.payout).toBe(20)
    expect(table.bets).toHaveLength(0)
    expect(table.getState().players[0].chipBalance).toBe(1010) // 990 + 20
  })

  it('on-point come bet loses when 7 rolls before target', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 4, die2: 4 }, // come_point_set(8)
      { die1: 3, die2: 4 }, // 7 → come bet loses
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)

    table.roll() // point_set
    table.placeBet('s1', BET_TYPES.COME, 10)
    table.roll() // come_point_set(8)
    expect(table.bets[0].target).toBe(8)

    const r3 = table.roll() // 7-out
    const loss = r3.resolved.find(r => r.result === 'lose')
    expect(loss).toBeDefined()
    expect(table.bets).toHaveLength(0)
    expect(table.getState().players[0].chipBalance).toBe(990) // 1000 - 10
  })

  it('traveling come bet wins immediately on natural 7', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 3, die2: 4 }, // natural 7 while traveling → come wins
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)

    table.roll() // point_set
    table.placeBet('s1', BET_TYPES.COME, 10)
    const r2 = table.roll()
    const win = r2.resolved.find(r => r.result === 'win')
    expect(win).toBeDefined()
    expect(win.payout).toBe(20)
    expect(table.getState().players[0].chipBalance).toBe(1010)
  })

  it('traveling come bet loses immediately on craps 2', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 1, die2: 1 }, // 2 while traveling → come loses
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)

    table.roll()
    table.placeBet('s1', BET_TYPES.COME, 10)
    const r2 = table.roll()
    const loss = r2.resolved.find(r => r.result === 'lose')
    expect(loss).toBeDefined()
    expect(table.getState().players[0].chipBalance).toBe(990)
  })
})

describe("T10 — Don't Come bet", () => {
  it("don't come: traveling bar 12 → push", () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 6, die2: 6 }, // 12 while DC traveling → push
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.DONT_COME, 10)
    const r2 = table.roll()
    const push = r2.resolved.find(r => r.result === 'push')
    expect(push).toBeDefined()
    expect(push.payout).toBe(10) // stake returned
    expect(table.getState().players[0].chipBalance).toBe(1000) // push: back to 1000
  })

  it("don't come on-point wins when 7 rolls before target", () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 4, die2: 4 }, // DC travels to on-point(8)
      { die1: 3, die2: 4 }, // 7 → DC wins
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.DONT_COME, 10)
    table.roll() // come_point_set(8) for DC
    expect(table.bets[0].target).toBe(8)

    const r3 = table.roll()
    const win = r3.resolved.find(r => r.result === 'win')
    expect(win).toBeDefined()
    expect(win.payout).toBe(20)
    expect(table.getState().players[0].chipBalance).toBe(1010)
  })
})

describe('T10 — Place bets', () => {
  it('place_6 wins at 7:6 payout when 6 rolls', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6) — place bets legal during point phase
      { die1: 3, die2: 3 }, // 6 rolls → place_6 wins
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll() // establish point

    table.placeBet('s1', BET_TYPES.PLACE_6, 12) // $12 at 7:6 → win $14 profit → payout=26
    const r2 = table.roll()
    const win = r2.resolved.find(r => r.result === 'win')
    expect(win).toBeDefined()
    expect(win.payout).toBe(26) // 12 stake + 14 profit (7:6 × 12)
    expect(table.getState().players[0].chipBalance).toBe(1014) // 1000 - 12 + 26
  })

  it('place_6 loses when 7 rolls', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 3, die2: 4 }, // 7 → place_6 loses
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.PLACE_6, 12)
    const r2 = table.roll()
    const loss = r2.resolved.find(r => r.result === 'lose')
    expect(loss).toBeDefined()
    expect(table.getState().players[0].chipBalance).toBe(988)
  })

  it('place_4 wins at 9:5 payout when 4 rolls', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 2, die2: 2 }, // 4 rolls → place_4 wins at 9:5
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.PLACE_4, 10) // $10 at 9:5 → profit $18 → payout=28
    const r2 = table.roll()
    const win = r2.resolved.find(r => r.result === 'win')
    expect(win).toBeDefined()
    expect(win.payout).toBe(28) // 10 stake + 18 profit
    expect(table.getState().players[0].chipBalance).toBe(1018)
  })

  it('place_9 wins at 7:5 payout when 9 rolls', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 4, die2: 5 }, // 9 rolls → place_9 wins at 7:5
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.PLACE_9, 10) // $10 at 7:5 → profit $14 → payout=24
    const r2 = table.roll()
    const win = r2.resolved.find(r => r.result === 'win')
    expect(win).toBeDefined()
    expect(win.payout).toBe(24)
  })

  it('place bets are not allowed in come_out phase', () => {
    const table = makeTable([])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    expect(() => table.placeBet('s1', BET_TYPES.PLACE_6, 10))
      .toThrow(expect.objectContaining({ code: 'INVALID_PHASE' }))
  })
})

// ─── T11: Hard ways + prop bets ───────────────────────────────────────────────

describe('T11 — Hard ways', () => {
  it('hard_8 wins at 9:1 when 4+4 rolls', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 4, die2: 4 }, // hard 8 wins
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.HARD_8, 10) // $10 at 9:1 → payout=100
    const r2 = table.roll()
    const win = r2.resolved.find(r => r.result === 'win')
    expect(win).toBeDefined()
    expect(win.payout).toBe(100)
    expect(table.getState().players[0].chipBalance).toBe(1090)
  })

  it('hard_8 loses on easy 8 (3+5)', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 3, die2: 5 }, // easy 8 → hard_8 loses
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.HARD_8, 10)
    const r2 = table.roll()
    const loss = r2.resolved.find(r => r.result === 'lose')
    expect(loss).toBeDefined()
    expect(table.getState().players[0].chipBalance).toBe(990)
  })

  it('hard_8 loses on 7', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 3, die2: 4 }, // 7 → hard_8 loses
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.HARD_8, 10)
    const r2 = table.roll()
    const loss = r2.resolved.find(r => r.result === 'lose')
    expect(loss).toBeDefined()
  })

  it('hard_4 wins at 7:1 when 2+2 rolls', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 2, die2: 2 }, // hard 4 wins
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.HARD_4, 10) // $10 at 7:1 → payout=80
    const r2 = table.roll()
    const win = r2.resolved.find(r => r.result === 'win')
    expect(win).toBeDefined()
    expect(win.payout).toBe(80)
  })

  it('hard_10 wins at 7:1 when 5+5 rolls', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6)
      { die1: 5, die2: 5 }, // hard 10 wins
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.HARD_10, 10)
    const r2 = table.roll()
    expect(r2.resolved.find(r => r.result === 'win')?.payout).toBe(80)
  })

  it('hard_6 wins at 9:1 when 3+3 rolls', () => {
    const table = makeTable([
      { die1: 4, die2: 4 }, // point_set(8)
      { die1: 3, die2: 3 }, // hard 6 wins
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.HARD_6, 10)
    const r2 = table.roll()
    expect(r2.resolved.find(r => r.result === 'win')?.payout).toBe(100)
  })
})

describe('T11 — Prop bets', () => {
  it('field bet wins at 2:1 on 2', () => {
    const table = makeTable([{ die1: 1, die2: 1 }])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.placeBet('s1', BET_TYPES.FIELD, 10)
    const r = table.roll()
    expect(r.resolved.find(b => b.result === 'win')?.payout).toBe(30)
  })

  it('field bet wins at 2:1 on 12', () => {
    const table = makeTable([{ die1: 6, die2: 6 }])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.placeBet('s1', BET_TYPES.FIELD, 10)
    const r = table.roll()
    expect(r.resolved.find(b => b.result === 'win')?.payout).toBe(30)
  })

  it('field bet wins at 1:1 on 9', () => {
    const table = makeTable([{ die1: 4, die2: 5 }])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.placeBet('s1', BET_TYPES.FIELD, 10)
    const r = table.roll()
    expect(r.resolved.find(b => b.result === 'win')?.payout).toBe(20)
  })

  it('field bet loses on 7', () => {
    const table = makeTable([{ die1: 3, die2: 4 }])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.placeBet('s1', BET_TYPES.FIELD, 10)
    const r = table.roll()
    expect(r.resolved.find(b => b.result === 'lose')).toBeDefined()
  })

  it('any_seven wins at 4:1 on 7', () => {
    const table = makeTable([{ die1: 3, die2: 4 }])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.placeBet('s1', BET_TYPES.ANY_SEVEN, 10)
    const r = table.roll()
    expect(r.resolved.find(b => b.result === 'win')?.payout).toBe(50) // 10*5=50
  })

  it('yo (11) wins at 15:1', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set(6) — YO legal in both phases
      { die1: 5, die2: 6 }, // 11 → Yo wins
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.YO, 10)
    const r2 = table.roll()
    expect(r2.resolved.find(b => b.result === 'win')?.payout).toBe(160) // 10 + 150
  })

  it('aces (2) wins at 30:1', () => {
    const table = makeTable([{ die1: 1, die2: 1 }])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.placeBet('s1', BET_TYPES.ACES, 10)
    const r = table.roll()
    expect(r.resolved.find(b => b.result === 'win')?.payout).toBe(310) // 10 + 300
  })

  it('boxcars (12) wins at 30:1', () => {
    const table = makeTable([{ die1: 6, die2: 6 }])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.placeBet('s1', BET_TYPES.BOXCARS, 10)
    const r = table.roll()
    expect(r.resolved.find(b => b.result === 'win')?.payout).toBe(310)
  })

  it('horn $4 wins unit*31 on 12', () => {
    const table = makeTable([{ die1: 6, die2: 6 }])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.placeBet('s1', BET_TYPES.HORN, 4) // unit=$1, rolls 12 → payout = unit*31 = 31
    const r = table.roll()
    expect(r.resolved.find(b => b.result === 'win')?.payout).toBe(31)
  })

  it('horn $4 wins unit*16 on 11', () => {
    const table = makeTable([
      { die1: 3, die2: 3 }, // point_set so YO/horn placeable in either phase
      { die1: 5, die2: 6 }, // 11 → horn payout = unit*16 = 16
    ])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.roll()
    table.placeBet('s1', BET_TYPES.HORN, 4)
    const r2 = table.roll()
    expect(r2.resolved.find(b => b.result === 'win')?.payout).toBe(16)
  })

  it('any_craps wins on 2', () => {
    const table = makeTable([{ die1: 1, die2: 1 }])
    table.addPlayer('s1', 'u1', 'alice', 1000)
    table.placeBet('s1', BET_TYPES.ANY_CRAPS, 10)
    const r = table.roll()
    expect(r.resolved.find(b => b.result === 'win')).toBeDefined()
  })
})
