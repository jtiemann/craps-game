// Synthesised dice sounds (Web Audio API) + croupier announcements (SpeechSynthesis).
// AudioContext is created lazily on first use — browsers require a user gesture first.

let _ctx = null
let _noiseBuffer = null

function getCtx() {
  if (!_ctx) _ctx = new AudioContext()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

// 2 s of cached white noise, reused for all synth sounds
function getNoiseBuf() {
  if (_noiseBuffer) return _noiseBuffer
  const c = getCtx()
  const len = c.sampleRate * 2
  _noiseBuffer = c.createBuffer(1, len, c.sampleRate)
  const d = _noiseBuffer.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return _noiseBuffer
}

// Play a filtered noise burst — the building block for all die sounds
function noiseBurst({ when = 0, dur = 0.08, freq = 1200, q = 3, vol = 0.25, filterType = 'bandpass' }) {
  const c = getCtx()
  const t = c.currentTime + when

  const src = c.createBufferSource()
  src.buffer = getNoiseBuf()
  src.loop = true

  const filt = c.createBiquadFilter()
  filt.type = filterType
  filt.frequency.value = freq
  filt.Q.value = q

  const gain = c.createGain()
  gain.gain.setValueAtTime(0.001, t)
  gain.gain.linearRampToValueAtTime(vol, t + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)

  src.connect(filt)
  filt.connect(gain)
  gain.connect(c.destination)
  src.start(t)
  src.stop(t + dur + 0.02)
}

// ── Public sound API ──────────────────────────────────────────────────────────

// Felt surface bounce: soft, low-mid thud
export function playFeltBounce(impactSpeed) {
  if (impactSpeed < 1.2) return
  const vol  = Math.min(0.30, 0.06 + impactSpeed * 0.022)
  const dur  = Math.min(0.13, 0.035 + impactSpeed * 0.006)
  const freq = 600 + impactSpeed * 25
  noiseBurst({ dur, freq, q: 2.0, vol, filterType: 'lowpass' })
}

// Pyramid bumper bounce: hard crack + low body thud
export function playWallBounce(impactSpeed) {
  if (impactSpeed < 1.2) return
  const vol  = Math.min(0.40, 0.08 + impactSpeed * 0.028)
  const dur  = Math.min(0.09, 0.025 + impactSpeed * 0.004)
  // Sharp high-mid crack
  noiseBurst({ dur, freq: 2400 + impactSpeed * 60, q: 4.5, vol, filterType: 'bandpass' })
  // Low body resonance underneath
  noiseBurst({ dur: 0.07, freq: 180, q: 1.2, vol: vol * 0.55, filterType: 'lowpass' })
}

export function playBounce(type, speed) {
  if (type === 'floor') playFeltBounce(speed)
  else if (type === 'wall') playWallBounce(speed)
}

// Cup-shake / initial throw — 6 overlapping rattles over ~0.45 s
export function playDiceThrow() {
  for (let i = 0; i < 7; i++) {
    const when = i * 0.055 + Math.random() * 0.025
    const vol  = Math.max(0.02, 0.18 - i * 0.02)
    noiseBurst({
      when,
      dur:  0.055 + Math.random() * 0.03,
      freq: 1400 + Math.random() * 600,
      q:    3.5,
      vol,
      filterType: 'bandpass',
    })
  }
}

// ── Croupier (Web Speech API) ─────────────────────────────────────────────────

const NAMES = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six',
  7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Eleven', 12: 'Twelve',
}

function croupierPhrase(event, total) {
  const n = NAMES[total] ?? String(total)
  switch (event) {
    case 'natural':
      return total === 7 ? 'Seven! Natural! Winner!' : 'Eleven! Natural! Winner!'
    case 'craps':
      if (total === 2)  return 'Two — snake eyes! Craps!'
      if (total === 12) return 'Twelve — boxcars! Craps!'
      return `${n}! Craps!`
    case 'point_set':
      return `${n}. The point is ${n.toLowerCase()}.`
    case 'point_made':
      return `${n}! Winner! Point made!`
    case 'seven_out':
      return 'Seven out! Line away!'
    case 'roll':
      return `${n}.`
    default:
      return null
  }
}

// Preferred voices by name fragment, in priority order
const VOICE_PREFS = ['Daniel', 'Alex', 'Fred', 'Tom', 'David', 'James']

function pickVoice() {
  const all = window.speechSynthesis?.getVoices() ?? []
  const en  = all.filter(v => v.lang.startsWith('en'))
  return en.find(v => VOICE_PREFS.some(p => v.name.includes(p))) ?? en[0] ?? null
}

export function announceCroupier(event, total) {
  if (!window.speechSynthesis) return
  const text = croupierPhrase(event, total)
  if (!text) return

  window.speechSynthesis.cancel()

  const utter = new SpeechSynthesisUtterance(text)
  utter.rate   = 0.88
  utter.pitch  = 0.82
  utter.volume = 0.95

  const go = () => {
    const v = pickVoice()
    if (v) utter.voice = v
    window.speechSynthesis.speak(utter)
  }

  if (window.speechSynthesis.getVoices().length > 0) {
    go()
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', go, { once: true })
  }
}
