import { describe, it, expect } from 'vitest'
import * as protocol from '../../../shared/protocol.js'

describe('shared protocol', () => {
  it('exports all required message type constants as strings', () => {
    const required = [
      'JOIN_TABLE',
      'TABLE_STATE',
      'PLACE_BET',
      'BET_PLACED',
      'REMOVE_BET',
      'READY_FOR_ROLL',
      'ROLL_START',
      'ROLL_RESOLVED',
      'CHIP_UPDATE',
      'ERROR',
    ]
    for (const key of required) {
      expect(protocol[key], `${key} must be defined`).toBeDefined()
      expect(typeof protocol[key], `${key} must be a string`).toBe('string')
    }
  })
})
