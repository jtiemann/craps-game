import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.setSize(window.innerWidth, window.innerHeight)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200)
  camera.position.set(0, 3, 10)
  camera.lookAt(0, 0, 0)

  // Orbit controls — left-drag to orbit, right-drag to pan, scroll to zoom
  const controls = new OrbitControls(camera, canvas)
  controls.target.set(0, 0, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 5
  controls.maxDistance = 60
  controls.maxPolarAngle = Math.PI / 2.05   // prevent going below the table
  controls.update()

  // Ambient + directional lights (bright overhead casino lighting)
  scene.add(new THREE.AmbientLight(0xffffff, 1.2))
  const dir = new THREE.DirectionalLight(0xffffff, 1.0)
  dir.position.set(0, 20, 8)
  dir.castShadow = true
  scene.add(dir)
  const fill = new THREE.DirectionalLight(0xffffff, 0.4)
  fill.position.set(0, 10, -8)
  scene.add(fill)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  function render() {
    requestAnimationFrame(render)
    controls.update()
    renderer.render(scene, camera)
  }
  render()

  return { scene, camera, renderer, controls }
}
