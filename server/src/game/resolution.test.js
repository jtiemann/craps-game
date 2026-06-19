import { describe, it, expect } from 'vitest'
import { resolveAllBets } from './resolution.js'
import { BET_TYPES } from './bets.js'

const comeOut = { phase: 'come_out', point: null }
const pointOn8 = { phase: 'point', point: 8 }

function bet(overrides) {
  return { id: 'b1', playerId: 'p1', type: BET_TYPES.PASS_LINE, amount: 10, target: null, ...overrides }
}

describe('resolveAllBets', () => {
  it('returns empty arrays when no bets', () => {
    const r = resolveAllBets([], 3, 4, comeOut)
    expect(r.resolved).toEqual([])
    expect(r.remaining).toEqual([])
    expect(r.updates).toEqual([])
  })

  it('resolves a winning pass line on 7 come-out', () => {
    const bets = [bet({ id: 'b1' })]
    const { resolved, remaining } = resolveAllBets(bets, 3, 4, comeOut)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({ betId: 'b1', playerId: 'p1', result: 'win', payout: 20 })
    expect(remaining).toHaveLength(0)
  })

  it('resolves a losing pass line on 2 come-out', () => {
    const bets = [bet()]
    const { resolved } = resolveAllBets(bets, 1, 1, comeOut)
    expect(resolved[0]).toMatchObject({ result: 'lose', payout: 0 })
  })

  it('keeps pass line pending when point is established', () => {
    const bets = [bet()]
    const { resolved, remaining } = resolveAllBets(bets, 2, 2, comeOut) // 4
    expect(resolved).toHaveLength(0)
    expect(remaining).toHaveLength(1)
  })

  it('keeps pass line pending on non-7 non-point in point phase', () => {
    const bets = [bet()]
    const { resolved, remaining } = resolveAllBets(bets, 2, 2, pointOn8) // 4, not 8
    expect(resolved).toHaveLength(0)
    expect(remaining).toHaveLength(1)
  })

  it('handles multiple bets on the same roll', () => {
    const bets = [
      bet({ id: 'pass', type: BET_TYPES.PASS_LINE, amount: 10 }),
      bet({ id: 'yo', type: BET_TYPES.YO, amount: 5 }),
    ]
    // Roll 11 (5+6): pass line wins come-out, yo wins
    const { resolved } = resolveAllBets(bets, 5, 6, comeOut)
    expect(resolved).toHaveLength(2)
    const passResult = resolved.find(r => r.betId === 'pass')
    const yoResult = resolved.find(r => r.betId === 'yo')
    expect(passResult).toMatchObject({ result: 'win', payout: 20 })
    expect(yoResult).toMatchObject({ result: 'win', payout: 80 }) // 5 + 75
  })

  it('resolves mixed win/lose/pending on same roll', () => {
    const bets = [
      bet({ id: 'pass', type: BET_TYPES.PASS_LINE }),
      bet({ id: 'dont', type: BET_TYPES.DONT_PASS }),
      bet({ id: 'place6', type: BET_TYPES.PLACE_6, amount: 12 }),
    ]
    // Roll 7 in point phase: pass loses, dont wins, place_6 loses
    const { resolved, remaining } = resolveAllBets(bets, 3, 4, pointOn8)
    expect(resolved).toHaveLength(3)
    expect(resolved.find(r => r.betId === 'pass')).toMatchObject({ result: 'lose' })
    expect(resolved.find(r => r.betId === 'dont')).toMatchObject({ result: 'win' })
    expect(resolved.find(r => r.betId === 'place6')).toMatchObject({ result: 'lose' })
    expect(remaining).toHaveLength(0)
  })

  it('transitions a traveling come bet to come_point_set', () => {
    const bets = [bet({ id: 'come1', type: BET_TYPES.COME, target: null })]
    const { resolved, remaining, updates } = resolveAllBets(bets, 2, 4, pointOn8) // 6
    expect(resolved).toHaveLength(0)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].target).toBe(6)
    expect(updates).toHaveLength(1)
    expect(updates[0].target).toBe(6)
  })

  it('resolves a come bet that reaches its come-point', () => {
    const bets = [bet({ id: 'come1', type: BET_TYPES.COME, target: 6 })]
    const { resolved, remaining } = resolveAllBets(bets, 3, 3, pointOn8) // 6
    expect(resolved[0]).toMatchObject({ result: 'win', payout: 20 })
    expect(remaining).toHaveLength(0)
  })

  it('loses a come bet on 7 after come-point established', () => {
    const bets = [bet({ id: 'come1', type: BET_TYPES.COME, target: 6 })]
    const { resolved } = resolveAllBets(bets, 3, 4, pointOn8)
    expect(resolved[0]).toMatchObject({ result: 'lose' })
  })

  it('handles dont_come push on 12 when traveling', () => {
    const bets = [bet({ id: 'dc', type: BET_TYPES.DONT_COME, target: null, amount: 10 })]
    const { resolved } = resolveAllBets(bets, 6, 6, pointOn8)
    expect(resolved[0]).toMatchObject({ result: 'push', payout: 10 })
  })

  it('preserves bet object fields in remaining bets', () => {
    const original = bet({ id: 'b1', playerId: 'alice', amount: 25 })
    const { remaining } = resolveAllBets([original], 2, 2, comeOut) // 4, point phase starts
    expect(remaining[0]).toMatchObject({ id: 'b1', playerId: 'alice', amount: 25 })
  })
})
