import * as THREE from 'three'
import { getFaceUpEuler } from './mesh.js'

const THROW_DURATION = 2200   // ms total animation
const TUMBLE_REVOLUTIONS = 4  // full rotations during flight

function easeOutBounce(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t
  if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75 }
  if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375 }
  t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

function lerp(a, b, t) { return a + (b - a) * t }

export function throwDice(die1Mesh, die2Mesh, targetFace1, targetFace2) {
  return new Promise(resolve => {
    const startTime = performance.now()

    // Start positions (off-table)
    const start1 = new THREE.Vector3(-4, 0.5, 5)
    const start2 = new THREE.Vector3(-3.5, 0.5, 5.5)
    // Land positions (on table felt, near center)
    const land1 = new THREE.Vector3(-0.6, 0.45, 1.5)
    const land2 = new THREE.Vector3( 0.6, 0.45, 1.5)

    const [rx1, ry1, rz1] = getFaceUpEuler(targetFace1)
    const [rx2, ry2, rz2] = getFaceUpEuler(targetFace2)

    die1Mesh.position.copy(start1)
    die2Mesh.position.copy(start2)
    die1Mesh.visible = true
    die2Mesh.visible = true

    function tick(now) {
      const elapsed = now - startTime
      const rawT = Math.min(elapsed / THROW_DURATION, 1)
      const tPos = easeInOut(rawT)
      const tBounce = easeOutBounce(rawT)
      const height = Math.sin(rawT * Math.PI) * 3.5  // arc

      // Position
      die1Mesh.position.x = lerp(start1.x, land1.x, tPos)
      die1Mesh.position.z = lerp(start1.z, land1.z, tPos)
      die1Mesh.position.y = lerp(start1.y, land1.y, tBounce) + height * (1 - rawT)

      die2Mesh.position.x = lerp(start2.x, land2.x, tPos)
      die2Mesh.position.z = lerp(start2.z, land2.z, tPos)
      die2Mesh.position.y = lerp(start2.y, land2.y, tBounce) + height * (1 - rawT)

      // Rotation: tumble during flight, snap to final face on land
      const tumble = rawT * TUMBLE_REVOLUTIONS * Math.PI * 2
      const snapT = Math.max(0, (rawT - 0.7) / 0.3) // snap in last 30%
      die1Mesh.rotation.x = lerp(tumble, rx1, snapT)
      die1Mesh.rotation.y = lerp(tumble * 0.7, ry1, snapT)
      die1Mesh.rotation.z = lerp(tumble * 0.4, rz1, snapT)

      die2Mesh.rotation.x = lerp(tumble * 0.9, rx2, snapT)
      die2Mesh.rotation.y = lerp(tumble * 1.1, ry2, snapT)
      die2Mesh.rotation.z = lerp(tumble * 0.6, rz2, snapT)

      if (rawT < 1) {
        requestAnimationFrame(tick)
      } else {
        die1Mesh.rotation.set(rx1, ry1, rz1)
        die2Mesh.rotation.set(rx2, ry2, rz2)
        resolve()
      }
    }

    requestAnimationFrame(tick)
  })
}
