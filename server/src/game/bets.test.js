import { describe, it, expect } from 'vitest'
import { BET_TYPES, getPayout } from './bets.js'

const comeOut = { phase: 'come_out', point: null }
const pointOn8 = { phase: 'point', point: 8 }
const pointOn6 = { phase: 'point', point: 6 }
const pointOn4 = { phase: 'point', point: 4 }

describe('BET_TYPES', () => {
  it('exports all expected bet type strings', () => {
    const expected = [
      'PASS_LINE', 'DONT_PASS', 'PASS_ODDS', 'DONT_PASS_ODDS',
      'COME', 'DONT_COME', 'COME_ODDS', 'DONT_COME_ODDS',
      'PLACE_4', 'PLACE_5', 'PLACE_6', 'PLACE_8', 'PLACE_9', 'PLACE_10',
      'HARD_4', 'HARD_6', 'HARD_8', 'HARD_10',
      'FIELD', 'ANY_SEVEN', 'ANY_CRAPS', 'YO', 'ACES', 'ACE_DEUCE', 'BOXCARS',
      'HORN', 'BIG_6', 'BIG_8',
    ]
    for (const key of expected) {
      expect(BET_TYPES[key], `BET_TYPES.${key}`).toBeDefined()
      expect(typeof BET_TYPES[key]).toBe('string')
    }
  })
})

describe('Pass Line', () => {
  it('wins on 7 during come-out', () => {
    const r = getPayout(BET_TYPES.PASS_LINE, 10, null, 3, 4, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(20)
  })

  it('wins on 11 during come-out', () => {
    const r = getPayout(BET_TYPES.PASS_LINE, 10, null, 5, 6, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(20)
  })

  it('loses on 2 during come-out', () => {
    const r = getPayout(BET_TYPES.PASS_LINE, 10, null, 1, 1, comeOut)
    expect(r.result).toBe('lose')
    expect(r.payout).toBe(0)
  })

  it('loses on 3 during come-out', () => {
    expect(getPayout(BET_TYPES.PASS_LINE, 10, null, 1, 2, comeOut).result).toBe('lose')
  })

  it('loses on 12 during come-out', () => {
    expect(getPayout(BET_TYPES.PASS_LINE, 10, null, 6, 6, comeOut).result).toBe('lose')
  })

  it('pending when point is set during come-out', () => {
    const r = getPayout(BET_TYPES.PASS_LINE, 10, null, 2, 2, comeOut)
    expect(r.result).toBe('pending')
  })

  it('wins when rolling the point', () => {
    const r = getPayout(BET_TYPES.PASS_LINE, 10, null, 4, 4, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(20)
  })

  it('loses on 7 in point phase', () => {
    const r = getPayout(BET_TYPES.PASS_LINE, 10, null, 3, 4, pointOn8)
    expect(r.result).toBe('lose')
    expect(r.payout).toBe(0)
  })

  it('pending on non-point non-7 in point phase', () => {
    expect(getPayout(BET_TYPES.PASS_LINE, 10, null, 2, 2, pointOn8).result).toBe('pending')
  })
})

describe("Don't Pass", () => {
  it('wins on 2 during come-out', () => {
    const r = getPayout(BET_TYPES.DONT_PASS, 10, null, 1, 1, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(20)
  })

  it('wins on 3 during come-out', () => {
    expect(getPayout(BET_TYPES.DONT_PASS, 10, null, 1, 2, comeOut).result).toBe('win')
  })

  it('pushes on 12 during come-out (bars 12)', () => {
    const r = getPayout(BET_TYPES.DONT_PASS, 10, null, 6, 6, comeOut)
    expect(r.result).toBe('push')
    expect(r.payout).toBe(10)
  })

  it('loses on 7 during come-out', () => {
    expect(getPayout(BET_TYPES.DONT_PASS, 10, null, 3, 4, comeOut).result).toBe('lose')
  })

  it('loses on 11 during come-out', () => {
    expect(getPayout(BET_TYPES.DONT_PASS, 10, null, 5, 6, comeOut).result).toBe('lose')
  })

  it('pending when point set during come-out', () => {
    expect(getPayout(BET_TYPES.DONT_PASS, 10, null, 2, 2, comeOut).result).toBe('pending')
  })

  it('wins on 7 in point phase', () => {
    const r = getPayout(BET_TYPES.DONT_PASS, 10, null, 3, 4, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(20)
  })

  it('loses when point is made in point phase', () => {
    const r = getPayout(BET_TYPES.DONT_PASS, 10, null, 4, 4, pointOn8)
    expect(r.result).toBe('lose')
    expect(r.payout).toBe(0)
  })
})

describe('Pass Odds', () => {
  it('wins at 2:1 on 4 (point)', () => {
    const r = getPayout(BET_TYPES.PASS_ODDS, 10, 4, 2, 2, pointOn4)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(30) // 10 stake + 20 profit
  })

  it('wins at 3:2 on 5 (point)', () => {
    const r = getPayout(BET_TYPES.PASS_ODDS, 10, 5, 2, 3, { phase: 'point', point: 5 })
    expect(r.result).toBe('win')
    expect(r.payout).toBe(25) // 10 + 15
  })

  it('wins at 6:5 on 6 (point)', () => {
    const r = getPayout(BET_TYPES.PASS_ODDS, 10, 6, 3, 3, pointOn6)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(22) // 10 + 12
  })

  it('wins at 6:5 on 8 (point)', () => {
    const r = getPayout(BET_TYPES.PASS_ODDS, 10, 8, 4, 4, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(22)
  })

  it('wins at 2:1 on 10 (point)', () => {
    const r = getPayout(BET_TYPES.PASS_ODDS, 10, 10, 4, 6, { phase: 'point', point: 10 })
    expect(r.result).toBe('win')
    expect(r.payout).toBe(30)
  })

  it('loses on 7', () => {
    const r = getPayout(BET_TYPES.PASS_ODDS, 10, 8, 3, 4, pointOn8)
    expect(r.result).toBe('lose')
    expect(r.payout).toBe(0)
  })

  it('pending on other rolls', () => {
    const r = getPayout(BET_TYPES.PASS_ODDS, 10, 8, 2, 2, pointOn8)
    expect(r.result).toBe('pending')
  })
})

describe("Don't Pass Odds", () => {
  it('wins at 1:2 on point=4 when 7 rolls', () => {
    const r = getPayout(BET_TYPES.DONT_PASS_ODDS, 10, 4, 3, 4, pointOn4)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(15) // 10 stake + 5 profit (1:2 on 10)
  })

  it('wins at 5:6 on point=8 when 7 rolls', () => {
    const r = getPayout(BET_TYPES.DONT_PASS_ODDS, 12, 8, 3, 4, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(22) // 12 stake + 10 profit
  })

  it('loses when point is rolled', () => {
    const r = getPayout(BET_TYPES.DONT_PASS_ODDS, 10, 8, 4, 4, pointOn8)
    expect(r.result).toBe('lose')
  })
})

describe('Come', () => {
  it('wins on 7 when traveling', () => {
    const r = getPayout(BET_TYPES.COME, 10, null, 3, 4, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(20)
  })

  it('wins on 11 when traveling', () => {
    expect(getPayout(BET_TYPES.COME, 10, null, 5, 6, pointOn8).result).toBe('win')
  })

  it('loses on 2 when traveling', () => {
    expect(getPayout(BET_TYPES.COME, 10, null, 1, 1, pointOn8).result).toBe('lose')
  })

  it('loses on 3 when traveling', () => {
    expect(getPayout(BET_TYPES.COME, 10, null, 1, 2, pointOn8).result).toBe('lose')
  })

  it('loses on 12 when traveling', () => {
    expect(getPayout(BET_TYPES.COME, 10, null, 6, 6, pointOn8).result).toBe('lose')
  })

  it('come_point_set on 4/5/6/8/9/10 when traveling', () => {
    for (const [d1, d2] of [[2,2],[2,3],[3,3],[2,6],[4,5],[4,6]]) {
      expect(getPayout(BET_TYPES.COME, 10, null, d1, d2, pointOn8).result).toBe('come_point_set')
    }
  })

  it('wins when come-point rolls again', () => {
    const r = getPayout(BET_TYPES.COME, 10, 6, 3, 3, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(20)
  })

  it('loses on 7 after come-point established', () => {
    expect(getPayout(BET_TYPES.COME, 10, 6, 3, 4, pointOn8).result).toBe('lose')
  })

  it('pending on non-7 non-come-point after come-point established', () => {
    expect(getPayout(BET_TYPES.COME, 10, 6, 2, 2, pointOn8).result).toBe('pending')
  })
})

describe("Don't Come", () => {
  it('wins on 2 when traveling', () => {
    expect(getPayout(BET_TYPES.DONT_COME, 10, null, 1, 1, pointOn8).result).toBe('win')
  })

  it('wins on 3 when traveling', () => {
    expect(getPayout(BET_TYPES.DONT_COME, 10, null, 1, 2, pointOn8).result).toBe('win')
  })

  it('pushes on 12 when traveling (bars 12)', () => {
    const r = getPayout(BET_TYPES.DONT_COME, 10, null, 6, 6, pointOn8)
    expect(r.result).toBe('push')
    expect(r.payout).toBe(10)
  })

  it('loses on 7 when traveling', () => {
    expect(getPayout(BET_TYPES.DONT_COME, 10, null, 3, 4, pointOn8).result).toBe('lose')
  })

  it('come_point_set on 4/5/6/9/10 when traveling', () => {
    expect(getPayout(BET_TYPES.DONT_COME, 10, null, 2, 2, pointOn8).result).toBe('come_point_set')
  })

  it('wins on 7 after come-point established', () => {
    const r = getPayout(BET_TYPES.DONT_COME, 10, 6, 3, 4, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(20)
  })

  it('loses when come-point rolls again', () => {
    expect(getPayout(BET_TYPES.DONT_COME, 10, 6, 3, 3, pointOn8).result).toBe('lose')
  })
})

describe('Come Odds', () => {
  it('wins at 6:5 when come-point=6 rolls', () => {
    const r = getPayout(BET_TYPES.COME_ODDS, 10, 6, 3, 3, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(22)
  })

  it('loses on 7', () => {
    expect(getPayout(BET_TYPES.COME_ODDS, 10, 6, 3, 4, pointOn8).result).toBe('lose')
  })

  it('pending on other rolls', () => {
    expect(getPayout(BET_TYPES.COME_ODDS, 10, 6, 2, 2, pointOn8).result).toBe('pending')
  })
})

describe('Place bets', () => {
  it('place_4: wins at 9:5 when 4 rolls', () => {
    const r = getPayout(BET_TYPES.PLACE_4, 10, null, 2, 2, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(28) // 10 + 18
  })

  it('place_5: wins at 7:5 when 5 rolls', () => {
    const r = getPayout(BET_TYPES.PLACE_5, 10, null, 2, 3, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(24) // 10 + 14
  })

  it('place_6: wins at 7:6 when 6 rolls', () => {
    const r = getPayout(BET_TYPES.PLACE_6, 12, null, 3, 3, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(26) // 12 + 14
  })

  it('place_8: wins at 7:6 when 8 rolls', () => {
    const r = getPayout(BET_TYPES.PLACE_8, 12, null, 4, 4, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(26)
  })

  it('place_9: wins at 7:5 when 9 rolls', () => {
    const r = getPayout(BET_TYPES.PLACE_9, 10, null, 4, 5, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(24)
  })

  it('place_10: wins at 9:5 when 10 rolls', () => {
    const r = getPayout(BET_TYPES.PLACE_10, 10, null, 4, 6, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(28)
  })

  it('all place bets lose on 7', () => {
    for (const type of [BET_TYPES.PLACE_4, BET_TYPES.PLACE_6, BET_TYPES.PLACE_8, BET_TYPES.PLACE_10]) {
      expect(getPayout(type, 10, null, 3, 4, pointOn8).result).toBe('lose')
    }
  })

  it('place bet is pending on irrelevant roll', () => {
    expect(getPayout(BET_TYPES.PLACE_6, 12, null, 2, 2, pointOn8).result).toBe('pending')
  })
})

describe('Hard ways', () => {
  it('hard_4 wins on 2+2 only', () => {
    const r = getPayout(BET_TYPES.HARD_4, 10, null, 2, 2, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(80) // 10 + 70 (7:1)
  })

  it('hard_4 loses on easy 4 (1+3)', () => {
    expect(getPayout(BET_TYPES.HARD_4, 10, null, 1, 3, pointOn8).result).toBe('lose')
  })

  it('hard_4 loses on 7', () => {
    expect(getPayout(BET_TYPES.HARD_4, 10, null, 3, 4, pointOn8).result).toBe('lose')
  })

  it('hard_4 is pending on other rolls', () => {
    expect(getPayout(BET_TYPES.HARD_4, 10, null, 2, 3, pointOn8).result).toBe('pending')
  })

  it('hard_6 wins on 3+3 at 9:1', () => {
    const r = getPayout(BET_TYPES.HARD_6, 10, null, 3, 3, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(100) // 10 + 90
  })

  it('hard_6 loses on easy 6 (2+4)', () => {
    expect(getPayout(BET_TYPES.HARD_6, 10, null, 2, 4, pointOn8).result).toBe('lose')
  })

  it('hard_8 wins on 4+4 at 9:1', () => {
    const r = getPayout(BET_TYPES.HARD_8, 10, null, 4, 4, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(100)
  })

  it('hard_10 wins on 5+5 at 7:1', () => {
    const r = getPayout(BET_TYPES.HARD_10, 10, null, 5, 5, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(80)
  })
})

describe('Field', () => {
  it('loses on 5, 6, 7, 8', () => {
    for (const [d1, d2] of [[2,3],[3,3],[3,4],[4,4]]) {
      expect(getPayout(BET_TYPES.FIELD, 10, null, d1, d2, comeOut).result).toBe('lose')
    }
  })

  it('wins 1:1 on 3, 4, 9, 10, 11', () => {
    for (const [d1, d2] of [[1,2],[1,3],[4,5],[4,6],[5,6]]) {
      const r = getPayout(BET_TYPES.FIELD, 10, null, d1, d2, comeOut)
      expect(r.result).toBe('win')
      expect(r.payout).toBe(20)
    }
  })

  it('wins 2:1 on 2', () => {
    const r = getPayout(BET_TYPES.FIELD, 10, null, 1, 1, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(30) // 10 + 20
  })

  it('wins 2:1 on 12', () => {
    const r = getPayout(BET_TYPES.FIELD, 10, null, 6, 6, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(30)
  })
})

describe('Proposition bets', () => {
  it('any_seven wins at 4:1 on 7', () => {
    const r = getPayout(BET_TYPES.ANY_SEVEN, 10, null, 3, 4, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(50) // 10 + 40
  })

  it('any_seven loses on non-7', () => {
    expect(getPayout(BET_TYPES.ANY_SEVEN, 10, null, 3, 3, comeOut).result).toBe('lose')
  })

  it('any_craps wins at 7:1 on 2, 3, 12', () => {
    for (const [d1, d2] of [[1,1],[1,2],[6,6]]) {
      const r = getPayout(BET_TYPES.ANY_CRAPS, 10, null, d1, d2, comeOut)
      expect(r.result).toBe('win')
      expect(r.payout).toBe(80) // 10 + 70
    }
  })

  it('any_craps loses on non-craps', () => {
    expect(getPayout(BET_TYPES.ANY_CRAPS, 10, null, 3, 4, comeOut).result).toBe('lose')
  })

  it('yo wins at 15:1 on 11', () => {
    const r = getPayout(BET_TYPES.YO, 10, null, 5, 6, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(160) // 10 + 150
  })

  it('aces wins at 30:1 on 2', () => {
    const r = getPayout(BET_TYPES.ACES, 10, null, 1, 1, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(310) // 10 + 300
  })

  it('ace_deuce wins at 15:1 on 3', () => {
    const r = getPayout(BET_TYPES.ACE_DEUCE, 10, null, 1, 2, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(160)
  })

  it('boxcars wins at 30:1 on 12', () => {
    const r = getPayout(BET_TYPES.BOXCARS, 10, null, 6, 6, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(310)
  })
})

describe('Horn', () => {
  it('wins on 12: net return is unit*31', () => {
    // $4 bet, 1 unit = $1, winning component (boxcars) returns 30+1=31; other 3 units lost
    const r = getPayout(BET_TYPES.HORN, 4, null, 6, 6, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(31) // unit*31 = 1*31
  })

  it('wins on 2: same as 12', () => {
    const r = getPayout(BET_TYPES.HORN, 4, null, 1, 1, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(31)
  })

  it('wins on 11: unit*16', () => {
    // winning component (yo) returns 15+1=16; other 3 units lost
    const r = getPayout(BET_TYPES.HORN, 4, null, 5, 6, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(16)
  })

  it('wins on 3: same as 11', () => {
    const r = getPayout(BET_TYPES.HORN, 4, null, 1, 2, comeOut)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(16)
  })

  it('loses on other totals', () => {
    expect(getPayout(BET_TYPES.HORN, 4, null, 3, 4, comeOut).result).toBe('lose')
  })

  it('scales with $8 horn bet', () => {
    const r = getPayout(BET_TYPES.HORN, 8, null, 6, 6, comeOut)
    expect(r.payout).toBe(62) // 2 * 31
  })
})

describe('Big 6 / Big 8', () => {
  it('big_6 wins at 1:1 when 6 rolls', () => {
    const r = getPayout(BET_TYPES.BIG_6, 10, null, 3, 3, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(20)
  })

  it('big_6 loses on 7', () => {
    expect(getPayout(BET_TYPES.BIG_6, 10, null, 3, 4, pointOn8).result).toBe('lose')
  })

  it('big_6 is pending on other rolls', () => {
    expect(getPayout(BET_TYPES.BIG_6, 10, null, 4, 4, pointOn8).result).toBe('pending')
  })

  it('big_8 wins at 1:1 when 8 rolls', () => {
    const r = getPayout(BET_TYPES.BIG_8, 10, null, 4, 4, pointOn8)
    expect(r.result).toBe('win')
    expect(r.payout).toBe(20)
  })

  it('big_8 loses on 7', () => {
    expect(getPayout(BET_TYPES.BIG_8, 10, null, 3, 4, pointOn8).result).toBe('lose')
  })
})
