const ALL_COMBOS = []
for (let d1 = 1; d1 <= 6; d1++) {
  for (let d2 = 1; d2 <= 6; d2++) {
    ALL_COMBOS.push([d1, d2])
  }
}

export const FAIR_WEIGHTS = Object.fromEntries(
  ALL_COMBOS.map(([d1, d2]) => [`${d1},${d2}`, 1])
)

export function rollDice(weights = FAIR_WEIGHTS) {
  let totalWeight = 0
  for (const [d1, d2] of ALL_COMBOS) {
    totalWeight += weights[`${d1},${d2}`] ?? 1
  }

  let rand = Math.random() * totalWeight
  for (const [d1, d2] of ALL_COMBOS) {
    rand -= weights[`${d1},${d2}`] ?? 1
    if (rand <= 0) {
      return { die1: d1, die2: d2, total: d1 + d2 }
    }
  }

  const [d1, d2] = ALL_COMBOS[ALL_COMBOS.length - 1]
  return { die1: d1, die2: d2, total: d1 + d2 }
}
