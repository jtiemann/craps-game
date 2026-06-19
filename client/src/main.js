import { createScene } from './scene/index.js'
import { createTable } from './table/index.js'
import { createDieMesh } from './dice/mesh.js'
import { throwDice } from './dice/animation.js'
import { createHUD, createAuthUI } from './ui/hud.js'
import { connectSocket } from './ws/socket.js'

const canvas = document.getElementById('canvas')
const { scene } = createScene(canvas)
const { betMeshes } = createTable(scene)
const hud = createHUD()

// Create dice meshes (hidden until thrown)
const die1Mesh = createDieMesh(scene, [-0.6, 0.45, 1.5])
const die2Mesh = createDieMesh(scene, [0.6, 0.45, 1.5])
die1Mesh.visible = false
die2Mesh.visible = false

hud.update({ phase: 'connecting…' })

let myUsername = ''
let animating = false

createAuthUI((token, username) => {
  myUsername = username
  hud.update({ phase: 'joining table…' })
  const socket = connectSocket(token)

  // Controls panel
  const controls = document.createElement('div')
  controls.style.cssText = `
    position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
    display:flex;gap:8px;z-index:10;
  `
  const btnPassLine = makeBtn('Bet $10 Pass Line', '#2a7a4c')
  const btnRoll = makeBtn('Roll', '#8b2a2a')
  btnRoll.disabled = true
  controls.append(btnPassLine, btnRoll)
  document.body.appendChild(controls)

  btnPassLine.addEventListener('click', () => {
    socket.emit('place_bet', { bet_type: 'pass_line', amount: 10 })
  })
  btnRoll.addEventListener('click', () => {
    if (!animating) socket.emit('ready_for_roll')
  })

  socket.on('connect', () => socket.emit('join_table'))

  socket.on('connect_error', (err) => hud.update({ phase: 'error', message: err.message }))

  socket.on('table_state', (state) => {
    const me = state.players.find(p => p.username === myUsername)
    hud.update({ phase: state.phase, point: state.point, chips: me?.chipBalance })
    btnRoll.disabled = state.bets.filter(b => b.socketId === socket.id).length === 0
  })

  socket.on('bet_placed', ({ table_state }) => {
    const me = table_state.players.find(p => p.username === myUsername)
    hud.update({ phase: table_state.phase, point: table_state.point, chips: me?.chipBalance })
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

    btnRoll.disabled = (table_state.bets.filter(b => b.socketId === socket.id).length === 0)
    if (table_state.phase === 'come_out') {
      btnRoll.disabled = true // bets cleared, must re-bet
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
