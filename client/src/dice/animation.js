import * as THREE from 'three'
import { getFaceUpEuler } from './mesh.js'
import { playBounce, playDiceThrow } from '../audio/index.js'

// ── Physics constants ─────────────────────────────────────────────────────────
const GRAVITY    = -18     // units/s² (stronger than real for punchy feel)
const DT         = 1 / 120 // simulation sub-step (s)
const Y_FLOOR    = 0.45    // floor level — die center at rest
const REST_FLOOR = 0.48    // floor restitution
const REST_WALL  = 0.60    // bumper wall restitution
const FRIC_FLOOR = 0.72    // lateral speed fraction kept after floor bounce
const ANG_DAMP   = 1.1     // angular velocity exponential decay rate
const MIN_VY     = 0.70    // min |vy| to trigger a bounce; below → rest on floor

// ── Collision bounds (die-center limits) ─────────────────────────────────────
// Directional checks prevent false triggers on the way in / out of the table.
const X_LIM   =  7.4   // ±x: inner faces of left/right bumpers
const Z_BACK  = -4.8   // inner face of back pyramid bumper
const Z_FRONT =  7.0   // emergency backstop (dice start outside table front)

const THROW_MS  = 4000  // total animation duration (ms)
const SETTLE_AT = 0.82  // fraction at which physics hands off to settle/snap

function rand(lo, hi) { return lo + Math.random() * (hi - lo) }

// Create initial physics state for one die (shooter's hand, front-left)
function makeDieState(x0) {
  return {
    pos: { x: x0,              y: rand(0.9, 1.3), z: 5.5 },
    vel: { x: rand(-2.0, 2.0), y: rand(6.0, 9.0), z: rand(-10.5, -7.5) },
    angVel: { x: rand(-28, 28), y: rand(-18, 18), z: rand(-22, 22) },
    rot:    { x: rand(0, Math.PI * 2), y: rand(0, Math.PI * 2), z: rand(0, Math.PI * 2) },
  }
}

const DIE_DIAM  = 0.82   // min center-to-center distance before overlap (0.8 + small pad)
const REST_DIE  = 0.60   // die-to-die restitution

// Elastic collision between two equal-mass dice.
// Returns impulse magnitude (for sound), or 0 if no contact.
function resolveInterDieCollision(a, b) {
  const dx = b.pos.x - a.pos.x
  const dy = b.pos.y - a.pos.y
  const dz = b.pos.z - a.pos.z
  const distSq = dx*dx + dy*dy + dz*dz
  if (distSq >= DIE_DIAM * DIE_DIAM || distSq < 1e-6) return 0

  const dist = Math.sqrt(distSq)
  // Collision normal: unit vector from a toward b
  const nx = dx / dist, ny = dy / dist, nz = dz / dist

  // Relative velocity of a w.r.t. b along the normal
  const relVN = (a.vel.x - b.vel.x) * nx
              + (a.vel.y - b.vel.y) * ny
              + (a.vel.z - b.vel.z) * nz

  if (relVN <= 0) return 0  // already separating

  const impulse = relVN * (1 + REST_DIE) / 2  // equal mass

  a.vel.x -= impulse * nx;  a.vel.y -= impulse * ny;  a.vel.z -= impulse * nz
  b.vel.x += impulse * nx;  b.vel.y += impulse * ny;  b.vel.z += impulse * nz

  // Push apart to fully resolve penetration
  const push = (DIE_DIAM - dist) / 2
  a.pos.x -= nx * push;  a.pos.y -= ny * push;  a.pos.z -= nz * push
  b.pos.x += nx * push;  b.pos.y += ny * push;  b.pos.z += nz * push

  // Keep dice above the floor after push
  if (a.pos.y < Y_FLOOR) a.pos.y = Y_FLOOR
  if (b.pos.y < Y_FLOOR) b.pos.y = Y_FLOOR

  // Glancing blow → random spin
  const spin = impulse * 2.0
  a.angVel.x += rand(-spin, spin);  a.angVel.z += rand(-spin, spin)
  b.angVel.x += rand(-spin, spin);  b.angVel.z += rand(-spin, spin)

  return impulse
}

// Returns { type: 'floor'|'wall', speed } on collision this step, else null.
function stepDie(s, dt) {
  // Gravity
  s.vel.y += GRAVITY * dt

  // Integrate position
  s.pos.x += s.vel.x * dt
  s.pos.y += s.vel.y * dt
  s.pos.z += s.vel.z * dt

  let collision = null

  // ── Floor ─────────────────────────────────────────────────────────────────
  if (s.pos.y < Y_FLOOR) {
    const impact = Math.abs(s.vel.y)
    s.pos.y = Y_FLOOR
    if (impact > MIN_VY) {
      s.vel.y  = impact * REST_FLOOR
      s.vel.x *= FRIC_FLOOR
      s.vel.z *= FRIC_FLOOR
      s.angVel.x += s.vel.z * 2.2
      s.angVel.z -= s.vel.x * 2.2
      collision = { type: 'floor', speed: impact }
    } else {
      s.vel.y = 0
    }
  }

  // ── Side bumpers (directional: only when moving outward) ─────────────────
  if (s.pos.x < -X_LIM && s.vel.x < 0) {
    const impact = Math.abs(s.vel.x)
    s.pos.x  = -X_LIM
    s.vel.x  = impact * REST_WALL
    s.angVel.y += rand(3, 9)
    s.angVel.z += rand(-6, 6)
    collision = { type: 'wall', speed: impact }
  } else if (s.pos.x > X_LIM && s.vel.x > 0) {
    const impact = Math.abs(s.vel.x)
    s.pos.x  = X_LIM
    s.vel.x  = -impact * REST_WALL
    s.angVel.y -= rand(3, 9)
    s.angVel.z += rand(-6, 6)
    collision = { type: 'wall', speed: impact }
  }

  // ── Back pyramid bumper (only when moving toward back) ───────────────────
  if (s.pos.z < Z_BACK && s.vel.z < 0) {
    const impact = Math.abs(s.vel.z)
    s.pos.z  = Z_BACK
    s.vel.z  = impact * REST_WALL
    s.angVel.x += rand(-12, 12)
    s.angVel.y += rand(-8,   8)
    s.angVel.z += rand(-10, 10)
    collision = { type: 'wall', speed: impact }
  }

  // ── Front backstop (only if die bounces all the way back) ────────────────
  if (s.pos.z > Z_FRONT && s.vel.z > 0) {
    s.pos.z = Z_FRONT
    s.vel.z = -Math.abs(s.vel.z) * REST_WALL
  }

  // ── Integrate rotation ────────────────────────────────────────────────────
  s.rot.x += s.angVel.x * dt
  s.rot.y += s.angVel.y * dt
  s.rot.z += s.angVel.z * dt

  // Exponential angular damping (air resistance + internal friction)
  const d = Math.exp(-ANG_DAMP * dt)
  s.angVel.x *= d
  s.angVel.y *= d
  s.angVel.z *= d

  return collision
}

export function throwDice(die1Mesh, die2Mesh, targetFace1, targetFace2) {
  return new Promise(resolve => {
    // Two dice start side-by-side in the shooter's hand (front-left)
    const s1 = makeDieState(rand(-4.2, -2.5))
    const s2 = makeDieState(rand(-2.0, -0.3))

    // Target quaternions for the correct face-up orientation
    const [rx1, ry1, rz1] = getFaceUpEuler(targetFace1)
    const [rx2, ry2, rz2] = getFaceUpEuler(targetFace2)
    const qTarget1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx1, ry1, rz1))
    const qTarget2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx2, ry2, rz2))

    die1Mesh.visible = true
    die2Mesh.visible = true

    playDiceThrow()

    let elapsed      = 0
    let lastFrameNow = null

    function tick(now) {
      if (lastFrameNow === null) lastFrameNow = now
      const frameDt = Math.min((now - lastFrameNow) / 1000, 0.04)  // cap at 40 ms
      lastFrameNow  = now
      elapsed      += frameDt
      const t = Math.min(elapsed / (THROW_MS / 1000), 1)

      if (t < SETTLE_AT) {
        // ── Pure physics ───────────────────────────────────────────────────
        const steps  = Math.max(1, Math.round(frameDt / DT))
        const stepDt = frameDt / steps
        // Collect first collision per die per frame to drive sounds
        let c1 = null, c2 = null, dieHit = 0
        for (let i = 0; i < steps; i++) {
          const r1 = stepDie(s1, stepDt)
          const r2 = stepDie(s2, stepDt)
          const imp = resolveInterDieCollision(s1, s2)
          if (r1 && !c1) c1 = r1
          if (r2 && !c2) c2 = r2
          if (imp > dieHit) dieHit = imp
        }
        if (c1) playBounce(c1.type, c1.speed)
        if (c2) playBounce(c2.type, c2.speed)
        if (dieHit > 1.0) playBounce('wall', dieHit * 1.2)

        die1Mesh.position.set(s1.pos.x, s1.pos.y, s1.pos.z)
        die2Mesh.position.set(s2.pos.x, s2.pos.y, s2.pos.z)
        die1Mesh.rotation.set(s1.rot.x, s1.rot.y, s1.rot.z)
        die2Mesh.rotation.set(s2.rot.x, s2.rot.y, s2.rot.z)

      } else {
        // ── Settle / snap phase ────────────────────────────────────────────
        const p    = (t - SETTLE_AT) / (1 - SETTLE_AT)   // 0 → 1
        const ease = p * p * (3 - 2 * p)                  // smoothstep

        // Drain all velocity proportionally — die glides to a stop
        const vMul = 1 - ease * 0.96
        s1.vel.x *= vMul; s1.vel.y *= vMul; s1.vel.z *= vMul
        s2.vel.x *= vMul; s2.vel.y *= vMul; s2.vel.z *= vMul
        s1.angVel.x *= vMul; s1.angVel.y *= vMul; s1.angVel.z *= vMul
        s2.angVel.x *= vMul; s2.angVel.y *= vMul; s2.angVel.z *= vMul

        const steps  = Math.max(1, Math.round(frameDt / DT))
        const stepDt = frameDt / steps
        for (let i = 0; i < steps; i++) {
          stepDie(s1, stepDt); stepDie(s2, stepDt)
          resolveInterDieCollision(s1, s2)
        }

        // Lerp y toward floor; x/z coast from physics
        die1Mesh.position.set(s1.pos.x, s1.pos.y + (Y_FLOOR - s1.pos.y) * ease, s1.pos.z)
        die2Mesh.position.set(s2.pos.x, s2.pos.y + (Y_FLOOR - s2.pos.y) * ease, s2.pos.z)

        // Slerp rotation from live physics state toward the server-determined face
        const qCur1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(s1.rot.x, s1.rot.y, s1.rot.z))
        const qCur2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(s2.rot.x, s2.rot.y, s2.rot.z))
        die1Mesh.quaternion.slerpQuaternions(qCur1, qTarget1, ease)
        die2Mesh.quaternion.slerpQuaternions(qCur2, qTarget2, ease)
      }

      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        // Lock to exact final state
        die1Mesh.position.y = Y_FLOOR
        die2Mesh.position.y = Y_FLOOR
        die1Mesh.quaternion.copy(qTarget1)
        die2Mesh.quaternion.copy(qTarget2)
        resolve()
      }
    }

    requestAnimationFrame(tick)
  })
}
