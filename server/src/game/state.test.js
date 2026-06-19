import { describe, it, expect } from 'vitest'
import { createGameState, applyComeOutRoll, applyPointRoll } from './state.js'

describe('createGameState', () => {
  it('starts in come_out phase with no point', () => {
    const s = createGameState()
    expect(s.phase).toBe('come_out')
    expect(s.point).toBeNull()
  })
})

describe('applyComeOutRoll', () => {
  it('natural on 7', () => {
    const { event, newState } = applyComeOutRoll(createGameState(), 3, 4)
    expect(event).toBe('natural')
    expect(newState.phase).toBe('come_out')
    expect(newState.point).toBeNull()
  })

  it('natural on 11', () => {
    const { event } = applyComeOutRoll(createGameState(), 5, 6)
    expect(event).toBe('natural')
  })

  it('craps on 2', () => {
    const { event, newState } = applyComeOutRoll(createGameState(), 1, 1)
    expect(event).toBe('craps')
    expect(newState.phase).toBe('come_out')
  })

  it('craps on 3', () => {
    expect(applyComeOutRoll(createGameState(), 1, 2).event).toBe('craps')
  })

  it('craps on 12', () => {
    expect(applyComeOutRoll(createGameState(), 6, 6).event).toBe('craps')
  })

  it.each([
    [2, 2, 4], [2, 3, 5], [3, 3, 6],
    [2, 6, 8], [4, 5, 9], [4, 6, 10],
  ])('point_set on %i+%i=%i', (d1, d2, total) => {
    const { event, newState } = applyComeOutRoll(createGameState(), d1, d2)
    expect(event).toBe('point_set')
    expect(newState.phase).toBe('point')
    expect(newState.point).toBe(total)
  })

  it('does not mutate the original state', () => {
    const state = createGameState()
    applyComeOutRoll(state, 3, 4)
    expect(state.phase).toBe('come_out')
  })
})

describe('applyPointRoll', () => {
  const pointState = { phase: 'point', point: 8 }

  it('point_made when rolling the point', () => {
    const { event, newState } = applyPointRoll(pointState, 4, 4)
    expect(event).toBe('point_made')
    expect(newState.phase).toBe('come_out')
    expect(newState.point).toBeNull()
  })

  it('seven_out on 7', () => {
    const { event, newState } = applyPointRoll(pointState, 3, 4)
    expect(event).toBe('seven_out')
    expect(newState.phase).toBe('come_out')
    expect(newState.point).toBeNull()
  })

  it('roll continues on non-7 non-point', () => {
    const { event, newState } = applyPointRoll(pointState, 2, 2) // 4, not 8
    expect(event).toBe('roll')
    expect(newState.phase).toBe('point')
    expect(newState.point).toBe(8)
  })

  it.each([[4], [5], [6], [9], [10]])('point=%i: rolling it wins', (point) => {
    const state = { phase: 'point', point }
    const [d1, d2] = point <= 6 ? [1, point - 1] : [point - 6, 6]
    const { event } = applyPointRoll(state, d1, d2)
    expect(event).toBe('point_made')
  })

  it('does not mutate the original state', () => {
    const state = { phase: 'point', point: 8 }
    applyPointRoll(state, 4, 4)
    expect(state.phase).toBe('point')
  })
})
