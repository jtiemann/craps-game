import { describe, it, expect } from 'vitest'
import { rollDice, FAIR_WEIGHTS } from './rng.js'

describe('rollDice', () => {
  it('returns die values in [1,6] range', () => {
    for (let i = 0; i < 100; i++) {
      const { die1, die2 } = rollDice()
      expect(die1).toBeGreaterThanOrEqual(1)
      expect(die1).toBeLessThanOrEqual(6)
      expect(die2).toBeGreaterThanOrEqual(1)
      expect(die2).toBeLessThanOrEqual(6)
    }
  })

  it('returns total = die1 + die2', () => {
    for (let i = 0; i < 50; i++) {
      const { die1, die2, total } = rollDice()
      expect(total).toBe(die1 + die2)
    }
  })

  it('can produce all 36 distinct face combinations over many rolls', () => {
    const seen = new Set()
    for (let i = 0; i < 10000; i++) {
      const { die1, die2 } = rollDice()
      seen.add(`${die1},${die2}`)
    }
    expect(seen.size).toBe(36)
  })
})

describe('FAIR_WEIGHTS', () => {
  it('has exactly 36 entries (all d1×d2 combinations)', () => {
    expect(Object.keys(FAIR_WEIGHTS)).toHaveLength(36)
  })

  it('all weights are equal', () => {
    const values = Object.values(FAIR_WEIGHTS)
    const first = values[0]
    expect(values.every(v => v === first)).toBe(true)
  })
})

describe('FAIR_WEIGHTS distribution (100k samples)', () => {
  it('produces expected total frequencies within 0.5% tolerance', () => {
    const counts = new Array(13).fill(0)
    const N = 100_000
    for (let i = 0; i < N; i++) {
      counts[rollDice(FAIR_WEIGHTS).total]++
    }
    // Ways to roll each total out of 36
    const ways = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]
    for (let t = 2; t <= 12; t++) {
      const actual = counts[t] / N
      const expected = ways[t] / 36
      expect(Math.abs(actual - expected), `total ${t}`).toBeLessThan(0.005)
    }
  })

  it('custom weights can bias toward 7', () => {
    const biasedWeights = {}
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        biasedWeights[`${d1},${d2}`] = d1 + d2 === 7 ? 10 : 1
      }
    }
    let sevens = 0
    const N = 1000
    for (let i = 0; i < N; i++) {
      if (rollDice(biasedWeights).total === 7) sevens++
    }
    // 7 should appear much more than fair 16.7%
    expect(sevens / N).toBeGreaterThan(0.4)
  })
})
