import * as THREE from 'three'

const FELT_GREEN = 0x1a7a3c
const TABLE_WOOD = 0x5c3a1e
const LINE_WHITE = 0xffffff
const LINE_OPACITY = 0.85
const BET_HOVER = 0xffff00

// Bet area definitions: [id, x, z, w, d, label]
const BET_AREAS = [
  // Pass Line — runs across the bottom edge (z ~ 3.8)
  { id: 'pass_line', x: 0, z: 3.8, w: 14, d: 0.9, label: 'PASS LINE', color: 0x1a7a3c },
  // Don't Pass
  { id: 'dont_pass', x: 0, z: 4.95, w: 14, d: 0.6, label: "DON'T PASS BAR", color: 0x155a2c },
  // Come
  { id: 'come', x: 0, z: 0.5, w: 10, d: 1.0, label: 'COME', color: 0x1a7a3c },
  // Number strip: 4 5 6 7 8 9 10
  { id: 'place_4',  x: -4.5, z: -1.2, w: 1.4, d: 1.8, label: '4',  color: 0x155a2c },
  { id: 'place_5',  x: -3.0, z: -1.2, w: 1.4, d: 1.8, label: '5',  color: 0x1a7a3c },
  { id: 'place_6',  x: -1.5, z: -1.2, w: 1.4, d: 1.8, label: '6',  color: 0x155a2c },
  { id: 'seven',    x:  0.0, z: -1.2, w: 1.4, d: 1.8, label: '7',  color: 0x1a7a3c },
  { id: 'place_8',  x:  1.5, z: -1.2, w: 1.4, d: 1.8, label: '8',  color: 0x155a2c },
  { id: 'place_9',  x:  3.0, z: -1.2, w: 1.4, d: 1.8, label: '9',  color: 0x1a7a3c },
  { id: 'place_10', x:  4.5, z: -1.2, w: 1.4, d: 1.8, label: '10', color: 0x155a2c },
  // Field
  { id: 'field', x: 0, z: 2.2, w: 10, d: 1.1, label: 'FIELD  2 3 4 9 10 11 12', color: 0x1a7a3c },
  // Props (right side)
  { id: 'any_seven', x:  6.2, z: -0.5, w: 1.2, d: 0.9, label: 'ANY 7',  color: 0x8b0000 },
  { id: 'yo',        x:  6.2, z:  0.6, w: 1.2, d: 0.9, label: 'YO 11',  color: 0x8b0000 },
  { id: 'any_craps', x:  6.2, z:  1.7, w: 1.2, d: 0.9, label: 'ANY CRAPS', color: 0x8b0000 },
  { id: 'horn',      x:  6.2, z:  2.8, w: 1.2, d: 0.9, label: 'HORN',   color: 0x8b0000 },
]

export function createTable(scene) {
  const group = new THREE.Group()

  // Table rim (wood surround)
  const rimGeo = new THREE.BoxGeometry(18, 0.4, 13)
  const rimMat = new THREE.MeshLambertMaterial({ color: TABLE_WOOD })
  const rim = new THREE.Mesh(rimGeo, rimMat)
  rim.position.y = -0.2
  rim.receiveShadow = true
  group.add(rim)

  // Felt surface
  const feltGeo = new THREE.BoxGeometry(16, 0.05, 11)
  const feltMat = new THREE.MeshLambertMaterial({ color: FELT_GREEN })
  const felt = new THREE.Mesh(feltGeo, feltMat)
  felt.position.y = 0.03
  felt.receiveShadow = true
  group.add(felt)

  // Bet areas (flat quads slightly above felt)
  const betMeshes = []
  for (const area of BET_AREAS) {
    const geo = new THREE.BoxGeometry(area.w, 0.02, area.d)
    const mat = new THREE.MeshLambertMaterial({ color: area.color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(area.x, 0.06, area.z)
    mesh.userData = { betAreaId: area.id, label: area.label, baseMat: mat }
    group.add(mesh)
    betMeshes.push(mesh)

    // Border line
    const edgesGeo = new THREE.EdgesGeometry(geo)
    const edgesMat = new THREE.LineBasicMaterial({ color: LINE_WHITE, transparent: true, opacity: LINE_OPACITY })
    const edges = new THREE.LineSegments(edgesGeo, edgesMat)
    mesh.add(edges)

    // Label sprite
    const sprite = makeTextSprite(area.label, 0.32)
    sprite.position.set(0, 0.08, 0)
    mesh.add(sprite)
  }

  scene.add(group)
  return { group, betMeshes }
}

function makeTextSprite(text, scale) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 512, 64)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 28px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 32)

  const texture = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(scale * (512 / 64), scale, 1)
  return sprite
}

export function highlightBetArea(mesh, on) {
  mesh.material.color.setHex(on ? BET_HOVER : mesh.userData.baseMat.color.getHex())
}

// Place or remove a chip stack marker on a bet area mesh.
// count: number of bets on this area; 0 removes the marker.
export function setChipMarker(mesh, count) {
  const toRemove = mesh.children.filter(c => c.userData.isChip)
  toRemove.forEach(c => { c.geometry.dispose(); c.material.dispose(); mesh.remove(c) })

  for (let i = 0; i < Math.min(count, 4); i++) {
    const chipGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16)
    const chipMat = new THREE.MeshLambertMaterial({ color: 0xffd700 })
    const chip = new THREE.Mesh(chipGeo, chipMat)
    chip.position.set(0, 0.12 + i * 0.11, 0)
    chip.userData.isChip = true
    mesh.add(chip)
  }
}

// Show on-point come/dont_come pucks on number strip areas.
// bets: full bets array from table_state; betMeshes: all bet area meshes.
export function updateComePucks(betMeshes, bets) {
  for (const mesh of betMeshes) {
    const toRemove = mesh.children.filter(c => c.userData.isPuck)
    toRemove.forEach(c => { c.geometry.dispose(); c.material.dispose(); mesh.remove(c) })
  }

  const areaMap = {}
  for (const mesh of betMeshes) areaMap[mesh.userData.betAreaId] = mesh

  for (const bet of bets) {
    if (!bet.target || (bet.type !== 'come' && bet.type !== 'dont_come')) continue
    const mesh = areaMap[`place_${bet.target}`]
    if (!mesh) continue
    const existingPucks = mesh.children.filter(c => c.userData.isPuck)
    if (existingPucks.length >= 3) continue
    const color = bet.type === 'come' ? 0xfafafa : 0x8b0000
    const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.06, 16)
    const mat = new THREE.MeshLambertMaterial({ color })
    const puck = new THREE.Mesh(geo, mat)
    puck.position.set(-0.25 + existingPucks.length * 0.2, 0.24, -0.25)
    puck.userData.isPuck = true
    mesh.add(puck)
  }
}
