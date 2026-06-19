import * as THREE from 'three'
import { createScene } from './scene/index.js'
import { createTable, highlightBetArea, setChipMarker, updateComePucks } from './table/index.js'
import { createDieMesh } from './dice/mesh.js'
import { throwDice } from './dice/animation.js'
import { createHUD, createAuthUI } from './ui/hud.js'
import { connectSocket } from './ws/socket.js'

const canvas = document.getElementById('canvas')
const { scene, camera } = createScene(canvas)
const { betMeshes } = createTable(scene)
const hud = createHUD()

// Raycaster for bet-area hit-testing
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let hoveredMesh = null

canvas.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(betMeshes)
  const hit = hits[0]?.object ?? null

  if (hoveredMesh && hoveredMesh !== hit) highlightBetArea(hoveredMesh, false)
  if (hit && hit !== hoveredMesh) {
    highlightBetArea(hit, true)
    canvas.style.cursor = hit.userData.betAreaId !== 'seven' ? 'pointer' : 'default'
  }
  if (!hit) canvas.style.cursor = 'default'
  hoveredMesh = hit
})

canvas.addEventListener('pointerleave', () => {
  if (hoveredMesh) { highlightBetArea(hoveredMesh, false); hoveredMesh = null }
  canvas.style.cursor = 'default'
})

// Die meshes (hidden until thrown)
const die1Mesh = createDieMesh(scene, [-0.6, 0.45, 1.5])
const die2Mesh = createDieMesh(scene, [0.6, 0.45, 1.5])
die1Mesh.visible = false
die2Mesh.visible = false

hud.update({ phase: 'connecting…' })

// Debug: expose for coordinate projection in testing
window._debug = { betMeshes, camera }

let myUsername = ''
let animating = false
let socketRef = null
let betAmount = 10

// Refresh all visual bet state from table_state.bets
function updateBetVisuals(bets) {
  const counts = {}
  for (const bet of bets) {
    // On-point come/dont_come bets are represented by pucks on the number — skip chip count
    if ((bet.type === 'come' || bet.type === 'dont_come') && bet.target !== null) continue
    counts[bet.type] = (counts[bet.type] ?? 0) + 1
  }
  for (const mesh of betMeshes) {
    const id = mesh.userData.betAreaId
    setChipMarker(mesh, counts[id] ?? 0)
  }
  updateComePucks(betMeshes, bets)
}

createAuthUI((token, username) => {
  myUsername = username
  hud.update({ phase: 'joining table…' })
  const socket = connectSocket(token)
  socketRef = socket
  window._debug.socket = socket

  // Click on a bet area → raycast + place_bet
  canvas.addEventListener('click', (e) => {
    if (animating) return
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(betMeshes, false)
    if (!hits.length) return
    const { betAreaId } = hits[0].object.userData
    if (!betAreaId || betAreaId === 'seven') return
    socket.emit('place_bet', { bet_type: betAreaId, amount: betAmount })
  })

  // Controls panel
  const controls = document.createElement('div')
  controls.style.cssText = `
    position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
    display:flex;gap:8px;z-index:10;align-items:center;
  `

  // Bet amount selector
  const amountLabel = document.createElement('span')
  amountLabel.style.cssText = 'color:#fff;font:13px monospace;'
  amountLabel.textContent = 'Bet $:'
  const amountInput = document.createElement('input')
  amountInput.type = 'number'
  amountInput.value = '10'
  amountInput.min = '1'
  amountInput.style.cssText = 'width:60px;padding:6px;border-radius:4px;border:none;font:13px monospace;'
  amountInput.addEventListener('input', () => { betAmount = Math.max(1, parseInt(amountInput.value) || 10) })

  const btnRoll = makeBtn('Roll', '#8b2a2a')
  btnRoll.disabled = true
  controls.append(amountLabel, amountInput, btnRoll)
  document.body.appendChild(controls)

  btnRoll.addEventListener('click', () => {
    if (!animating) socket.emit('ready_for_roll')
  })

  socket.on('connect', () => socket.emit('join_table'))
  socket.on('connect_error', (err) => hud.update({ phase: 'error', message: err.message }))

  socket.on('table_state', (state) => {
    const me = state.players.find(p => p.username === myUsername)
    hud.update({ phase: state.phase, point: state.point, chips: me?.chipBalance })
    updateBetVisuals(state.bets)
    const myBets = state.bets.filter(b => b.socketId === socket.id)
    btnRoll.disabled = myBets.length === 0 || state.phase === 'come_out'
  })

  socket.on('bet_placed', ({ table_state }) => {
    const me = table_state.players.find(p => p.username === myUsername)
    hud.update({ phase: table_state.phase, point: table_state.point, chips: me?.chipBalance })
    updateBetVisuals(table_state.bets)
    btnRoll.disabled = false
  })

  socket.on('roll_start', async ({ die1, die2 }) => {
    animating = true
    btnRoll.disabled = true
    await throwDice(die1Mesh, die2Mesh, die1, die2)
    animating = false
  })

  socket.on('roll_resolved', ({ die1, die2, total, event, table_state }) => {
    const me = table_state.players.find(p => p.username === myUsername)
    const eventMsg = {
      natural: `Natural! ${total} wins!`,
      craps: `Craps! ${total} loses.`,
      point_set: `Point is ${table_state.point}`,
      point_made: `Point made! ${total} wins!`,
      seven_out: `Seven out! You lose.`,
      roll: `Rolled ${total}`,
    }[event] || `Rolled ${total}`

    hud.update({
      phase: table_state.phase,
      point: table_state.point,
      chips: me?.chipBalance,
      lastRoll: `${die1} + ${die2} = ${total}`,
      message: eventMsg,
    })

    updateBetVisuals(table_state.bets)
    const myBets = table_state.bets.filter(b => b.socketId === socket.id)
    btnRoll.disabled = myBets.length === 0 || table_state.phase === 'come_out'
  })

  socket.on('chip_update', ({ player_id, chip_balance }) => {
    if (myUsername && socketRef) {
      // HUD chip balance is already updated via roll_resolved table_state
    }
  })

  socket.on('error', (err) => hud.update({ message: `Error: ${err.message}` }))
})

function makeBtn(label, bg) {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = `padding:10px 18px;border-radius:6px;border:none;background:${bg};
    color:#fff;cursor:pointer;font:14px monospace;`
  return b
}
