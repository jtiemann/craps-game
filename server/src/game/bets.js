export const BET_TYPES = {
  PASS_LINE: 'pass_line',
  DONT_PASS: 'dont_pass',
  PASS_ODDS: 'pass_odds',
  DONT_PASS_ODDS: 'dont_pass_odds',
  COME: 'come',
  DONT_COME: 'dont_come',
  COME_ODDS: 'come_odds',
  DONT_COME_ODDS: 'dont_come_odds',
  PLACE_4: 'place_4',
  PLACE_5: 'place_5',
  PLACE_6: 'place_6',
  PLACE_8: 'place_8',
  PLACE_9: 'place_9',
  PLACE_10: 'place_10',
  HARD_4: 'hard_4',
  HARD_6: 'hard_6',
  HARD_8: 'hard_8',
  HARD_10: 'hard_10',
  FIELD: 'field',
  ANY_SEVEN: 'any_seven',
  ANY_CRAPS: 'any_craps',
  YO: 'yo',
  ACES: 'aces',
  ACE_DEUCE: 'ace_deuce',
  BOXCARS: 'boxcars',
  HORN: 'horn',
  BIG_6: 'big_6',
  BIG_8: 'big_8',
}

function win(amount, multiplier) {
  return { result: 'win', payout: amount + Math.floor(amount * multiplier) }
}

function lose() {
  return { result: 'lose', payout: 0 }
}

function push(amount) {
  return { result: 'push', payout: amount }
}

function pending() {
  return { result: 'pending', payout: null }
}

function oddsMultiplierForPoint(point, side) {
  const pass = { 4: 2, 5: 3 / 2, 6: 6 / 5, 8: 6 / 5, 9: 3 / 2, 10: 2 }
  const dont = { 4: 1 / 2, 5: 2 / 3, 6: 5 / 6, 8: 5 / 6, 9: 2 / 3, 10: 1 / 2 }
  return side === 'pass' ? pass[point] : dont[point]
}

function placeMultiplier(number) {
  if (number === 4 || number === 10) return 9 / 5
  if (number === 5 || number === 9) return 7 / 5
  return 7 / 6 // 6 or 8
}

export function getPayout(betType, amount, target, die1, die2, gameState) {
  const total = die1 + die2

  switch (betType) {
    case BET_TYPES.PASS_LINE: {
      if (gameState.phase === 'come_out') {
        if (total === 7 || total === 11) return win(amount, 1)
        if (total === 2 || total === 3 || total === 12) return lose()
        return pending()
      }
      if (total === gameState.point) return win(amount, 1)
      if (total === 7) return lose()
      return pending()
    }

    case BET_TYPES.DONT_PASS: {
      if (gameState.phase === 'come_out') {
        if (total === 2 || total === 3) return win(amount, 1)
        if (total === 12) return push(amount)
        if (total === 7 || total === 11) return lose()
        return pending()
      }
      if (total === 7) return win(amount, 1)
      if (total === gameState.point) return lose()
      return pending()
    }

    case BET_TYPES.PASS_ODDS: {
      const point = target ?? gameState.point
      if (!point) return pending()
      if (total === point) return win(amount, oddsMultiplierForPoint(point, 'pass'))
      if (total === 7) return lose()
      return pending()
    }

    case BET_TYPES.DONT_PASS_ODDS: {
      const point = target ?? gameState.point
      if (!point) return pending()
      if (total === 7) return win(amount, oddsMultiplierForPoint(point, 'dont'))
      if (total === point) return lose()
      return pending()
    }

    case BET_TYPES.COME: {
      if (target === null) {
        if (total === 7 || total === 11) return win(amount, 1)
        if (total === 2 || total === 3 || total === 12) return lose()
        return { result: 'come_point_set', payout: null }
      }
      if (total === target) return win(amount, 1)
      if (total === 7) return lose()
      return pending()
    }

    case BET_TYPES.DONT_COME: {
      if (target === null) {
        if (total === 2 || total === 3) return win(amount, 1)
        if (total === 12) return push(amount)
        if (total === 7 || total === 11) return lose()
        return { result: 'come_point_set', payout: null }
      }
      if (total === 7) return win(amount, 1)
      if (total === target) return lose()
      return pending()
    }

    case BET_TYPES.COME_ODDS: {
      if (!target) return pending()
      if (total === target) return win(amount, oddsMultiplierForPoint(target, 'pass'))
      if (total === 7) return lose()
      return pending()
    }

    case BET_TYPES.DONT_COME_ODDS: {
      if (!target) return pending()
      if (total === 7) return win(amount, oddsMultiplierForPoint(target, 'dont'))
      if (total === target) return lose()
      return pending()
    }

    case BET_TYPES.PLACE_4:
    case BET_TYPES.PLACE_5:
    case BET_TYPES.PLACE_6:
    case BET_TYPES.PLACE_8:
    case BET_TYPES.PLACE_9:
    case BET_TYPES.PLACE_10: {
      const number = parseInt(betType.split('_')[1], 10)
      if (total === number) return win(amount, placeMultiplier(number))
      if (total === 7) return lose()
      return pending()
    }

    case BET_TYPES.HARD_4:
    case BET_TYPES.HARD_6:
    case BET_TYPES.HARD_8:
    case BET_TYPES.HARD_10: {
      const number = parseInt(betType.split('_')[1], 10)
      const multiplier = (number === 4 || number === 10) ? 7 : 9
      if (die1 === die2 && total === number) return win(amount, multiplier)
      if ((total === number && die1 !== die2) || total === 7) return lose()
      return pending()
    }

    case BET_TYPES.FIELD: {
      if ([5, 6, 7, 8].includes(total)) return lose()
      if (total === 2 || total === 12) return win(amount, 2)
      return win(amount, 1)
    }

    case BET_TYPES.ANY_SEVEN:
      return total === 7 ? win(amount, 4) : lose()

    case BET_TYPES.ANY_CRAPS:
      return [2, 3, 12].includes(total) ? win(amount, 7) : lose()

    case BET_TYPES.YO:
      return total === 11 ? win(amount, 15) : lose()

    case BET_TYPES.ACES:
      return total === 2 ? win(amount, 30) : lose()

    case BET_TYPES.ACE_DEUCE:
      return total === 3 ? win(amount, 15) : lose()

    case BET_TYPES.BOXCARS:
      return total === 12 ? win(amount, 30) : lose()

    case BET_TYPES.HORN: {
      if (![2, 3, 11, 12].includes(total)) return lose()
      const unit = amount / 4
      // winning component payout (30:1 for 2/12, 15:1 for 3/11) - 3 losing units
      const netGain = (total === 2 || total === 12)
        ? unit * 30 - unit * 3
        : unit * 15 - unit * 3
      return { result: 'win', payout: amount + netGain }
    }

    case BET_TYPES.BIG_6:
      if (total === 6) return win(amount, 1)
      if (total === 7) return lose()
      return pending()

    case BET_TYPES.BIG_8:
      if (total === 8) return win(amount, 1)
      if (total === 7) return lose()
      return pending()

    default:
      throw new Error(`Unknown bet type: ${betType}`)
  }
}
