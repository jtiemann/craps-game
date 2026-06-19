import { getPayout } from './bets.js'

export function resolveAllBets(bets, die1, die2, gameState) {
  const resolved = []
  const remaining = []
  const updates = []

  for (const bet of bets) {
    const result = getPayout(bet.type, bet.amount, bet.target, die1, die2, gameState)

    if (result.result === 'come_point_set') {
      const updatedBet = { ...bet, target: die1 + die2 }
      remaining.push(updatedBet)
      updates.push(updatedBet)
    } else if (result.result === 'pending') {
      remaining.push(bet)
    } else {
      resolved.push({
        betId: bet.id,
        playerId: bet.playerId,
        result: result.result,
        payout: result.payout,
      })
    }
  }

  return { resolved, remaining, updates }
}
