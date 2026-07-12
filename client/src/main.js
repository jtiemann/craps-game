import * as THREE from 'three'
import { createScene } from './scene/index.js'
import { createTable, highlightBetArea, setChipMarker, updateComePucks, updatePointPuck } from './table/index.js'
import { createDieMesh } from './dice/mesh.js'
import { throwDice } from './dice/animation.js'
import { createHUD, createAuthUI } from './ui/hud.js'
import { connectSocket } from './ws/socket.js'
import { announceCroupier } from './audio/index.js'

const canvas = document.getElementById('canvas')
const { scene, camera, controls } = createScene(canvas)
const { betMeshes, pointPucks } = createTable(scene)

// Region tracking so a bet shows only on the region where it was placed (the layout
// mirrors every bet to both halves, so betType alone can't tell the two apart).
const betRegion = new Map()          // bet.id -> regionId it was placed on
let pendingRegions = []              // {betType, target, regionId} recorded at click time
const primaryRegionByType = new Map()
for (const m of betMeshes) {
  if (!primaryRegionByType.has(m.userData.betType)) primaryRegionByType.set(m.userData.betType, m.userData.regionId)
}
function reconcileBetRegions(bets) {
  const ids = new Set(bets.map(b => b.id))
  for (const id of [...betRegion.keys()]) if (!ids.has(id)) betRegion.delete(id)
  const myId = socketRef?.id
  for (const bet of bets) {
    if (bet.socketId !== myId || betRegion.has(bet.id)) continue
    const i = pendingRegions.findIndex(p => p.betType === bet.type && (p.target ?? null) === (bet.target ?? null))
    if (i >= 0) { betRegion.set(bet.id, pendingRegions[i].regionId); pendingRegions.splice(i, 1) }
  }
}
// Region a bet renders on: where the local player clicked, else a default half so
// other players' / reconnected bets still appear.
function regionOf(bet) {
  return betRegion.get(bet.id) ?? primaryRegionByType.get(bet.type) ?? null
}
const hud = createHUD()

// Raycaster for bet-area hit-testing
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let hoveredMesh = null
// dragMoved: true from first move-with-button-held until the next pointerdown.
// This lets the 'click' event (which fires after pointerup) still see that a drag occurred.
let dragMoved = false

canvas.addEventListener('pointerdown', () => { dragMoved = false })
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons !== 0) { dragMoved = true }

  if (dragMoved) {
    if (hoveredMesh) { highlightBetArea(hoveredMesh, false); hoveredMesh = null }
    canvas.style.cursor = 'grabbing'
    return
  }

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(betMeshes)
  const hit = hits[0]?.object ?? null

  if (hoveredMesh && hoveredMesh !== hit) highlightBetArea(hoveredMesh, false)
  if (hit && hit !== hoveredMesh) {
    highlightBetArea(hit, true)
    canvas.style.cursor = 'pointer'
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
let isSpectator = false
let currentTableState = null

// Refresh all visual bet state from table_state.bets, keyed by region so each bet
// shows only on the half where it was placed.
function updateBetVisuals(bets) {
  reconcileBetRegions(bets)
  const counts = {}
  for (const bet of bets) {
    // On-point come/dont_come bets are represented by pucks on the number — skip chip count
    if ((bet.type === 'come' || bet.type === 'dont_come') && bet.target !== null) continue
    const region = regionOf(bet)
    if (!region) continue
    counts[region] = (counts[region] ?? 0) + 1
  }
  for (const mesh of betMeshes) setChipMarker(mesh, counts[mesh.userData.regionId] ?? 0)
  updateComePucks(betMeshes, bets, (bet) => (regionOf(bet) ?? '').endsWith('R') ? 'R' : 'L')
}

createAuthUI((token, username, spectate = false) => {
  myUsername = username
  isSpectator = spectate
  hud.update({ phase: spectate ? 'watching…' : 'joining table…' })
  const socket = connectSocket(token)
  socketRef = socket
  window._debug.socket = socket

  // Click on a bet area → raycast + place_bet (spectators cannot bet; ignore orbit drags)
  canvas.addEventListener('click', (e) => {
    if (animating || isSpectator || dragMoved) return
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(betMeshes, false)
    if (!hits.length) return
    const region = hits[0].object.userData.betType
    const clickedRegionId = hits[0].object.userData.regionId
    if (!region) return

    // Smart odds routing — detect when the player should be placing odds instead
    const myBets = (currentTableState?.bets ?? []).filter(b => b.socketId === socket.id)
    const phase  = currentTableState?.phase
    let betType  = region
    let target   = null

    if (region === 'pass_line' &&
        phase === 'point' && myBets.some(b => b.type === 'pass_line')) {
      // Player has a pass line bet in point phase — route to free odds behind the line
      betType = 'pass_odds'
    } else if (region === 'dont_pass' && phase === 'point' &&
               myBets.some(b => b.type === 'dont_pass')) {
      // Player has a don't pass bet in point phase — route to lay odds
      betType = 'dont_pass_odds'
    } else if (region.startsWith('place_')) {
      // If a come bet has moved to this number, clicking adds come odds
      const num = parseInt(region.split('_')[1])
      if (myBets.some(b => b.type === 'come' && b.target === num)) {
        betType = 'come_odds'
        target  = num
      }
    }

    // Remember which region this click targeted so the chip renders only there
    pendingRegions.push({ betType, target, regionId: clickedRegionId })
    if (pendingRegions.length > 40) pendingRegions.shift()

    socket.emit('place_bet', { bet_type: betType, amount: betAmount, ...(target !== null ? { target } : {}) })
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

  const rollStatus = document.createElement('div')
  rollStatus.style.cssText = `
    position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
    color:#ffcc00;font:12px monospace;text-align:center;z-index:10;pointer-events:none;
  `

  if (isSpectator) {
    const watchLabel = document.createElement('span')
    watchLabel.style.cssText = 'color:#aaa;font:13px monospace;font-style:italic;'
    watchLabel.textContent = 'Watching'
    controls.append(watchLabel)
  } else {
    controls.append(amountLabel, amountInput, btnRoll)
    document.body.appendChild(rollStatus)
    btnRoll.addEventListener('click', () => {
      if (!animating) socket.emit('ready_for_roll')
    })
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && !btnRoll.disabled && !animating &&
          document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        socket.emit('ready_for_roll')
      }
    })
  }
  document.body.appendChild(controls)

  const joinEvent = isSpectator ? 'join_as_spectator' : 'join_table'
  socket.on('connect', () => socket.emit(joinEvent))
  if (socket.connected) socket.emit(joinEvent)
  socket.on('reconnected', (state) => { hud.showFlash('Reconnected!', '#4af'); applyTableState(state) })
  socket.on('connect_error', (err) => hud.update({ phase: 'error' }))

  function applyTableState(state) {
    currentTableState = state
    const me = state.players.find(p => p.username === myUsername)
    const shooter = state.players.find(p => p.socketId === state.shooter_socket_id)
    hud.update({
      phase: state.phase, point: state.point, chips: me?.chipBalance,
      shooter: shooter?.username, bets: state.bets, mySocketId: socket.id,
    })
    updateBetVisuals(state.bets)
    for (const p of pointPucks) updatePointPuck(p, state.phase, state.point, betMeshes)
    if (!isSpectator) {
      const amShooter = state.shooter_socket_id === socket.id
      const myBets = state.bets.filter(b => b.socketId === socket.id)
      const hasLineBet = myBets.some(b => b.type === 'pass_line' || b.type === 'dont_pass')
      btnRoll.disabled = !amShooter || !hasLineBet
      updateRollStatus(amShooter, hasLineBet, shooter, myBets, state.phase)
    }
  }

  function updateRollStatus(amShooter, hasLineBet, shooter, myBets, phase) {
    if (!amShooter) {
      const msg = `Waiting for ${shooter?.username ?? 'shooter'} to roll`
      btnRoll.title = msg; rollStatus.textContent = msg
    } else if (!hasLineBet) {
      btnRoll.title = "Place a Pass Line or Don't Pass bet first"
      rollStatus.textContent = 'Place a Pass Line bet, then click Roll'
    } else {
      btnRoll.title = ''
      // Odds hint — shown when player can benefit from taking free odds
      const hasPassLine = myBets.some(b => b.type === 'pass_line')
      const hasPassOdds = myBets.some(b => b.type === 'pass_odds')
      const hasDontPass = myBets.some(b => b.type === 'dont_pass')
      const hasDontPassOdds = myBets.some(b => b.type === 'dont_pass_odds')
      if (phase === 'point' && hasPassLine && !hasPassOdds) {
        rollStatus.textContent = 'Click Pass Line to add Free Odds behind the bet'
      } else if (phase === 'point' && hasDontPass && !hasDontPassOdds) {
        rollStatus.textContent = "Click Don't Pass to add Lay Odds"
      } else {
        rollStatus.textContent = ''
      }
    }
  }

  socket.on('table_state', applyTableState)
  socket.on('bet_placed', ({ table_state }) => applyTableState(table_state))

  let pendingResolved = null

  socket.on('roll_start', async ({ die1, die2, timestamp }) => {
    animating = true
    btnRoll.disabled = true
    try {
      const delay = Math.max(0, timestamp - Date.now())
      if (delay > 0) await new Promise(r => setTimeout(r, delay))
      await throwDice(die1Mesh, die2Mesh, die1, die2)
    } finally {
      animating = false
      if (pendingResolved) {
        applyRollResolved(pendingResolved)
        pendingResolved = null
      }
    }
  })

  function applyRollResolved({ die1, die2, total, event, table_state }) {
    announceCroupier(event, total)
    currentTableState = table_state
    const me = table_state.players.find(p => p.username === myUsername)
    const shooter = table_state.players.find(p => p.socketId === table_state.shooter_socket_id)

    const MSG = {
      natural:     ['Winner!',                      '#2aff80'],
      craps:       ['Loser',                        '#ff4444'],
      point_set:   [`Point is ${table_state.point}`, '#ffcc00'],
      point_made:  ['Winner!',                      '#2aff80'],
      seven_out:   ['Seven Out — Loser',            '#ff4444'],
      roll:        [`Point remains ${table_state.point}`, '#aaaaaa'],
    }
    const [msg, color] = MSG[event] ?? []
    if (msg) hud.showFlash(msg, color)

    hud.update({
      phase: table_state.phase,
      point: table_state.point,
      chips: me?.chipBalance,
      shooter: shooter?.username,
      bets: table_state.bets,
      mySocketId: socket.id,
    })

    updateBetVisuals(table_state.bets)
    for (const p of pointPucks) updatePointPuck(p, table_state.phase, table_state.point, betMeshes)
    if (!isSpectator) {
      const amShooter = table_state.shooter_socket_id === socket.id
      const myBets = table_state.bets.filter(b => b.socketId === socket.id)
      const hasLineBet = myBets.some(b => b.type === 'pass_line' || b.type === 'dont_pass')
      btnRoll.disabled = !amShooter || !hasLineBet
      updateRollStatus(amShooter, hasLineBet, shooter, myBets, table_state.phase)
    }
  }

  socket.on('roll_resolved', (data) => {
    if (animating) {
      pendingResolved = data
    } else {
      applyRollResolved(data)
    }
  })

  socket.on('chip_update', ({ player_id, chip_balance }) => {
    if (myUsername && socketRef) {
      // HUD chip balance is already updated via roll_resolved table_state
    }
  })

  socket.on('error', (err) => hud.showFlash(err.message || 'Error', '#ff4444'))
})

function makeBtn(label, bg) {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = `padding:10px 18px;border-radius:6px;border:none;background:${bg};
    color:#fff;cursor:pointer;font:14px monospace;`
  return b
}
