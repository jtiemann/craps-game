import { createScene } from './scene/index.js'
import { createTable } from './table/index.js'
import { createHUD, createAuthUI } from './ui/hud.js'
import { connectSocket } from './ws/socket.js'

const canvas = document.getElementById('canvas')
const { scene } = createScene(canvas)
const { betMeshes } = createTable(scene)
const hud = createHUD()

hud.update({ phase: 'connecting…' })

createAuthUI((token, username) => {
  hud.update({ phase: 'joining table…' })
  const socket = connectSocket(token)

  socket.on('connect', () => {
    socket.emit('join_table')
  })

  socket.on('connect_error', (err) => {
    hud.update({ phase: 'error', message: err.message })
  })

  socket.on('table_state', (state) => {
    hud.update({
      phase: state.phase,
      point: state.point,
      chips: state.players.find(p => p.username === username)?.chipBalance,
    })
  })

  socket.on('error', (err) => {
    hud.update({ message: err.message })
  })
})
