export function createGameState() {
  return { phase: 'come_out', point: null }
}

export function applyComeOutRoll(state, die1, die2) {
  const total = die1 + die2
  if (total === 7 || total === 11) {
    return { event: 'natural', newState: { ...state } }
  }
  if (total === 2 || total === 3 || total === 12) {
    return { event: 'craps', newState: { ...state } }
  }
  return { event: 'point_set', newState: { ...state, phase: 'point', point: total } }
}

export function applyPointRoll(state, die1, die2) {
  const total = die1 + die2
  if (total === state.point) {
    return { event: 'point_made', newState: { ...state, phase: 'come_out', point: null } }
  }
  if (total === 7) {
    return { event: 'seven_out', newState: { ...state, phase: 'come_out', point: null } }
  }
  return { event: 'roll', newState: { ...state } }
}
