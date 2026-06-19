import * as THREE from 'three'

// Face index → rotation (euler XY) that places that number face-up on a standard die
// Standard die: 1 opposite 6, 2 opposite 5, 3 opposite 4
// With 1 on top: euler (0,0,0); 2 on top: (-PI/2, 0, 0); 3 on top: (0, PI/2, 0)
// 4 on top: (0, -PI/2, 0); 5 on top: (PI/2, 0, 0); 6 on top: (PI, 0, 0)
const FACE_UP_EULER = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0,  Math.PI / 2, 0],
  4: [0, -Math.PI / 2, 0],
  5: [ Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
}

function makeDiceMaterial() {
  // Use a simple white box — dot painting deferred to T12 polish
  return new THREE.MeshLambertMaterial({ color: 0xf5f5f0 })
}

export function createDieMesh(scene, position) {
  const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8)
  const mat = makeDiceMaterial()
  const mesh = new THREE.Mesh(geo, mat)
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
