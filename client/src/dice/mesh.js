import * as THREE from 'three'

// Standard die: 1 opposite 6, 2 opposite 5, 3 opposite 4
// Face-up euler rotations so the given number faces +Y (camera-up)
// To show face value N on top (+Y world), rotate so that face's local normal → +Y.
// FACE_NUMBERS = [3,4,1,6,5,2]: slots +X,-X,+Y,-Y,+Z,-Z hold those pip counts.
// 1@+Y: no rotation; 2@-Z: Rx+90°; 3@+X: Rz+90°; 4@-X: Rz-90°; 5@+Z: Rx-90°; 6@-Y: Rx180°
const FACE_UP_EULER = {
  1: [0, 0, 0],
  2: [ Math.PI / 2, 0, 0],
  3: [0, 0,  Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [-Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
}

// Pip positions on a normalized [0,1] grid
const L = 0.28, R = 0.72, T = 0.28, M = 0.5, B = 0.72
const PIP_LAYOUTS = {
  1: [[M, M]],
  2: [[R, T], [L, B]],
  3: [[R, T], [M, M], [L, B]],
  4: [[L, T], [R, T], [L, B], [R, B]],
  5: [[L, T], [R, T], [M, M], [L, B], [R, B]],
  6: [[L, T], [R, T], [L, M], [R, M], [L, B], [R, B]],
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function makePipTexture(pips) {
  const size = 128
  const r = 10
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#f5f5f0'
  roundedRect(ctx, 2, 2, size - 4, size - 4, 14)
  ctx.fill()

  // Border
  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 2
  roundedRect(ctx, 2, 2, size - 4, size - 4, 14)
  ctx.stroke()

  // Pips
  ctx.fillStyle = '#1a1a1a'
  for (const [nx, ny] of PIP_LAYOUTS[pips]) {
    ctx.beginPath()
    ctx.arc(nx * size, ny * size, r, 0, Math.PI * 2)
    ctx.fill()
  }

  return new THREE.CanvasTexture(canvas)
}

// BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
// With FACE_UP_EULER[1]=(0,0,0): 1 is on +Y, 6 on -Y, 2 on -Z, 5 on +Z, 3 on +X, 4 on -X
const FACE_NUMBERS = [3, 4, 1, 6, 5, 2]  // index = face slot, value = pip count

function makeDiceMaterials() {
  return FACE_NUMBERS.map(n =>
    new THREE.MeshLambertMaterial({ map: makePipTexture(n) })
  )
}

export function createDieMesh(scene, position) {
  const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8)
  const mats = makeDiceMaterials()
  const mesh = new THREE.Mesh(geo, mats)
  mesh.position.set(...position)
  mesh.castShadow = true
  scene.add(mesh)
  return mesh
}

export function setDiceFace(mesh, face) {
  const [rx, ry, rz] = FACE_UP_EULER[face]
  mesh.rotation.set(rx, ry, rz)
}

export function getFaceUpEuler(face) {
  return FACE_UP_EULER[face]
}
