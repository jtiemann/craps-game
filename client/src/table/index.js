import * as THREE from 'three'

const TABLE_WOOD = 0x3d2005
const RAIL_PAD   = 0x7a5a14   // tan/leather rail cushion
const BET_HOVER  = 0xffcc00

// Felt dimensions (Three.js units). Aspect matches the source design (2400×864 ≈ 25:9),
// i.e. an authentic wide double-layout craps table.
const DW = 2400          // design canvas width  (source coordinate space)
const DH = 864           // design canvas height
const FW = 16            // felt width  in Three.js units
const FD = FW * DH / DW  // felt depth  (5.76) — locked to the design aspect ratio
const FRONT_EXT = FD * 0.1

// ── Design layout constants (ported from "Craps Felt Texture.dc.html") ─────────
const S    = 1.6                          // per-cell scale used by the source design
const OFFX = 48, OFFY = 32                // betting-area container offset within the felt
const LINE = 'rgba(248,244,232,0.92)'     // ivory rule colour
const GOLD = '#f4c542'
const FELT_GRADIENT = ['#0f7a4d', '#0b5d3b', '#084a30']  // radial felt (green)

// Region id → server bet type. Mirrored (…R) regions inherit the base id's type.
const REGION_BET = {
  place4: 'place_4', place5: 'place_5', place6: 'place_6',
  place8: 'place_8', place9: 'place_9', place10: 'place_10',
  dontcome: 'dont_come', come: 'come', field: 'field',
  dontpass: 'dont_pass', pass: 'pass_line', big6: 'big_6', big8: 'big_8',
  seven: 'any_seven', anycraps: 'any_craps',
  horn2: 'aces', horn12: 'boxcars', horn3: 'ace_deuce', horn11: 'yo',
  hard4: 'hard_4', hard10: 'hard_10', hard6: 'hard_6', hard8: 'hard_8',
  eleven: 'yo', craps: 'any_craps', elevenB: 'yo', crapsB: 'any_craps',
}

// ── Cell definitions (base units; multiplied by S and offset into the felt) ─────
// The first 13 cells form one half of the table and are mirrored to the far end.
function buildCells() {
  const cells = []
  const mk = (id, x, y, w, h, label, sub, opt = {}) =>
    cells.push({ id, x, y, w, h, label, sub, opt })

  const pn = [[4, '4'], [5, '5'], [6, 'SIX'], [8, '8'], [9, 'NINE'], [10, '10']]
  pn.forEach((p, i) => mk('place' + p[0], 24 + i * 85, 16, 81, 98, p[1], '', { ls: 34, lw: 700 }))
  mk('dontcome', 24, 120, 81, 150, "DON'T COME", 'BAR', { ls: 15, lw: 600 })
  mk('come', 109, 120, 425, 150, 'COME', '', { ls: 42, lw: 700 })
  mk('field', 24, 280, 510, 58, 'FIELD', '2 · 3 · 4 · 9 · 10 · 11 · 12', { ls: 20, ss: 12, bc: GOLD, fg: GOLD, lw: 700 })
  mk('dontpass', 24, 346, 510, 28, "DON'T PASS BAR", '', { ls: 14, lw: 600 })
  mk('pass', 24, 380, 510, 42, 'PASS LINE', '', { ls: 25, lw: 700, bc: GOLD, fg: GOLD })
  mk('big6', 24, 430, 78, 44, 'BIG 6', '', { ls: 15, lw: 700 })
  mk('big8', 106, 430, 78, 44, 'BIG 8', '', { ls: 15, lw: 700 })

  // Mirror the half onto the opposite end (same bet, other side of the table).
  cells.slice().forEach((c) => {
    mk(c.id + 'R', 1440 - c.x - c.w, c.y, c.w, c.h, c.label, c.sub, c.opt)
  })

  // Centre proposition cluster (single, not mirrored)
  mk('seven', 558, 18, 324, 40, 'SEVEN', '4 TO 1', { ls: 22, lw: 700, bc: GOLD, fg: GOLD, round: 6 })
  mk('anycraps', 558, 392, 324, 40, 'ANY CRAPS', '7 TO 1', { ls: 20, lw: 700, round: 6 })
  mk('horn2', 566, 66, 64, 52, '', '2 · 30:1', { graphic: { a: 1, b: 1, size: 27 }, ss: 10, round: 6 })
  mk('horn12', 810, 66, 64, 52, '', '12 · 30:1', { graphic: { a: 6, b: 6, size: 27 }, ss: 10, round: 6 })
  mk('horn3', 566, 322, 64, 52, '', '3 · 15:1', { graphic: { a: 1, b: 2, size: 27 }, ss: 10, round: 6 })
  mk('horn11', 810, 322, 64, 52, '', '11 · 15:1', { graphic: { a: 5, b: 6, size: 27 }, ss: 10, round: 6 })
  mk('hard4', 624, 148, 86, 68, 'HARD 4', '7 : 1', { graphic: { a: 2, b: 2, size: 30 }, ss: 11, ls: 12, lw: 600, round: 6 })
  mk('hard10', 718, 148, 86, 68, 'HARD 10', '7 : 1', { graphic: { a: 5, b: 5, size: 30 }, ss: 11, ls: 12, lw: 600, round: 6 })
  mk('hard6', 624, 226, 86, 68, 'HARD 6', '9 : 1', { graphic: { a: 3, b: 3, size: 30 }, ss: 11, ls: 12, lw: 600, round: 6 })
  mk('hard8', 718, 226, 86, 68, 'HARD 8', '9 : 1', { graphic: { a: 4, b: 4, size: 30 }, ss: 11, ls: 12, lw: 600, round: 6 })
  mk('eleven', 586, 150, 30, 30, 'E', '', { ls: 15, lw: 700, round: 99, bc: GOLD, fg: GOLD })
  mk('craps', 824, 150, 30, 30, 'C', '', { ls: 15, lw: 700, round: 99 })
  mk('elevenB', 586, 254, 30, 30, 'E', '', { ls: 15, lw: 700, round: 99, bc: GOLD, fg: GOLD })
  mk('crapsB', 824, 254, 30, 30, 'C', '', { ls: 15, lw: 700, round: 99 })

  // Resolve each cell to absolute felt-canvas geometry + its bet type.
  return cells.map((c) => {
    const base = c.id.endsWith('R') ? c.id.slice(0, -1) : c.id
    return {
      ...c,
      betType: REGION_BET[base],
      left: OFFX + c.x * S, top: OFFY + c.y * S,
      cw: c.w * S, ch: c.h * S,
    }
  })
}

const CELLS = buildCells()

// ── Canvas helpers (operate in design space, 2400×864) ─────────────────────────
function rrPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// One die face, ported from the design's pip() (ivory die, dark pips)
function drawPip(ctx, cx, cy, face, size) {
  const map = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
  const set = new Set(map[face] || [])
  const pad = size * 0.1
  const cell = (size - 2 * pad) / 3
  const dot = size * 0.165
  ctx.fillStyle = '#f7f5ee'
  rrPath(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.16)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  for (let i = 0; i < 9; i++) {
    if (!set.has(i)) continue
    const dx = cx - size / 2 + pad + cell * ((i % 3) + 0.5)
    const dy = cy - size / 2 + pad + cell * (Math.floor(i / 3) + 0.5)
    ctx.beginPath(); ctx.arc(dx, dy, dot / 2, 0, Math.PI * 2); ctx.fill()
  }
}
function drawDicePair(ctx, cx, cy, a, b, size) {
  const gap = 4
  drawPip(ctx, cx - (size + gap) / 2, cy, a, size)
  drawPip(ctx, cx + (size + gap) / 2, cy, b, size)
}

function drawCell(ctx, c) {
  const { left, top, cw, ch, opt } = c
  const cx = left + cw / 2
  // Border only — the felt shows through the cell background.
  ctx.strokeStyle = opt.bc || LINE
  ctx.lineWidth = 2 * S
  rrPath(ctx, left, top, cw, ch, (opt.round || 4) * S)
  ctx.stroke()

  // Vertically-centred stack: [dice] → [label] → [sub]
  const labelPx = (opt.ls || 16) * S
  const subPx = (opt.ss || 9) * S
  const items = []
  if (opt.graphic) items.push({ t: 'g', h: opt.graphic.size })
  if (c.label) items.push({ t: 'l', h: labelPx })
  if (c.sub) items.push({ t: 's', h: subPx })
  const gap = 3
  const total = items.reduce((s, it) => s + it.h, 0) + gap * Math.max(0, items.length - 1)
  let y = top + ch / 2 - total / 2

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const it of items) {
    const midY = y + it.h / 2
    if (it.t === 'g') {
      drawDicePair(ctx, cx, midY, opt.graphic.a, opt.graphic.b, opt.graphic.size)
    } else if (it.t === 'l') {
      ctx.fillStyle = opt.fg || LINE
      ctx.font = `${opt.lw || 600} ${labelPx}px 'Oswald', system-ui, sans-serif`
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${0.5 * S}px`
      ctx.fillText(c.label.toUpperCase(), cx, midY)
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    } else {
      ctx.fillStyle = opt.fg || LINE
      ctx.globalAlpha = 0.82
      ctx.font = `500 ${subPx}px 'Oswald', system-ui, sans-serif`
      ctx.fillText(c.sub.toUpperCase(), cx, midY)
      ctx.globalAlpha = 1
    }
    y += it.h + gap
  }
}

// Subtle fractal-ish noise tile, drawn over the felt at low opacity (design uses feTurbulence)
function noisePattern(ctx) {
  const n = document.createElement('canvas')
  n.width = n.height = 140
  const nc = n.getContext('2d')
  const img = nc.createImageData(140, 140)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  nc.putImageData(img, 0, 0)
  return ctx.createPattern(n, 'repeat')
}

function drawFelt(ctx) {
  ctx.clearRect(0, 0, DW, DH)

  // Radial felt gradient (green), centred slightly above middle like the design.
  const g = ctx.createRadialGradient(DW / 2, DH * 0.35, 0, DW / 2, DH * 0.35, DW * 0.72)
  g.addColorStop(0, FELT_GRADIENT[0])
  g.addColorStop(0.55, FELT_GRADIENT[1])
  g.addColorStop(1, FELT_GRADIENT[2])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, DW, DH)

  // Noise
  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.fillStyle = noisePattern(ctx)
  ctx.fillRect(0, 0, DW, DH)
  ctx.restore()

  // Outer apron border
  ctx.strokeStyle = 'rgba(244,197,66,0.5)'
  ctx.lineWidth = 3
  rrPath(ctx, 20, 20, DW - 40, DH - 40, 60)
  ctx.stroke()

  // Centre proposition frame
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 5
  rrPath(ctx, OFFX + 877, OFFY + 13, 550, 694, 22)
  ctx.stroke()

  for (const c of CELLS) drawCell(ctx, c)
}

function buildFeltTexture() {
  const RES = 2
  const canvas = document.createElement('canvas')
  canvas.width = DW * RES
  canvas.height = DH * RES
  const ctx = canvas.getContext('2d')
  ctx.scale(RES, RES)

  const tex = new THREE.CanvasTexture(canvas)
  const paint = () => { drawFelt(ctx); tex.needsUpdate = true }
  paint()

  // Repaint once the Oswald webfont is ready (canvas can't wait on it synchronously).
  if (document.fonts?.load) {
    Promise.all([
      document.fonts.load("700 40px 'Oswald'"),
      document.fonts.load("500 20px 'Oswald'"),
    ]).then(paint).catch(() => {})
  }
  return tex
}

// ── Pyramid-bump back-wall texture ────────────────────────────────────────────
function buildPyramidTexture(wallW, wallH) {
  const T  = 32
  const H  = T / 2
  const tile = document.createElement('canvas')
  tile.width = tile.height = T
  const tc = tile.getContext('2d')
  const faces = [
    { pts: [[0,0],[T,0],[H,H]], color: '#4a6b50' },
    { pts: [[T,0],[T,T],[H,H]], color: '#3a5540' },
    { pts: [[T,T],[0,T],[H,H]], color: '#2a3d2e' },
    { pts: [[0,T],[0,0],[H,H]], color: '#3e5944' },
  ]
  for (const f of faces) {
    tc.fillStyle = f.color
    tc.beginPath(); tc.moveTo(...f.pts[0]); tc.lineTo(...f.pts[1]); tc.lineTo(...f.pts[2]); tc.closePath(); tc.fill()
  }
  tc.strokeStyle = '#1e2820'; tc.lineWidth = 0.8
  tc.beginPath(); tc.moveTo(H,H); tc.lineTo(0,0); tc.moveTo(H,H); tc.lineTo(T,0)
  tc.moveTo(H,H); tc.lineTo(T,T); tc.moveTo(H,H); tc.lineTo(0,T); tc.stroke()
  const tex = new THREE.CanvasTexture(tile)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(wallW / 0.22, wallH / 0.22)
  return tex
}

// ── Dealer ON/OFF point puck (one per half of the layout) ─────────────────────
function createPointPuck(group, side) {
  const face = (label, bg, fg) => {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const x = c.getContext('2d')
    x.fillStyle = bg; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill()
    x.strokeStyle = fg; x.lineWidth = 7; x.beginPath(); x.arc(64, 64, 51, 0, Math.PI * 2); x.stroke()
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'
    x.font = `700 ${label.length > 2 ? 36 : 46}px 'Oswald', system-ui, sans-serif`
    x.fillText(label, 64, 68)
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t
  }
  const onTex  = face('ON',  '#f5f2e9', '#0b5d3b')
  const offTex = face('OFF', '#141414', '#e8e8e8')
  const sideMat = new THREE.MeshLambertMaterial({ color: 0x141414 })
  const geo  = new THREE.CylinderGeometry(0.34, 0.34, 0.12, 40)
  const puck = new THREE.Mesh(geo, [sideMat, new THREE.MeshBasicMaterial({ map: offTex }), new THREE.MeshLambertMaterial({ color: 0x141414 })])
  const rest = side === 'R'
    ? { x:  FW / 2 - 1.0, z: -FD / 2 + 0.75 }
    : { x: -FW / 2 + 1.0, z: -FD / 2 + 0.75 }
  puck.userData = { onTex, offTex, sideMat, side, rest }
  puck.position.set(rest.x, 0.17, rest.z)
  group.add(puck)
  return puck
}

// ── 3D table construction ─────────────────────────────────────────────────────
export function createTable(scene) {
  const group = new THREE.Group()

  // Outer wooden frame (rectangular body; oval back is added separately)
  const rimMat = new THREE.MeshLambertMaterial({ color: TABLE_WOOD })
  const rimGeo = new THREE.BoxGeometry(FW + 3.0, 0.85, FD + 1.0)
  const rim    = new THREE.Mesh(rimGeo, rimMat)
  rim.position.set(0, -0.42, 0.8)
  group.add(rim)

  // Dark inner recess
  const bedGeo = new THREE.BoxGeometry(FW + 0.6, 0.25, FD + 0.6 + FRONT_EXT)
  const bedMat = new THREE.MeshLambertMaterial({ color: 0x081208 })
  const bed    = new THREE.Mesh(bedGeo, bedMat)
  bed.position.set(0, -0.08, FRONT_EXT / 2)
  group.add(bed)

  // Padded rail strips (front + sides; back rail is curved, added below)
  const padMat = new THREE.MeshLambertMaterial({ color: RAIL_PAD })
  const padW   = 0.55
  const railLen = FD - 0.2 + FRONT_EXT
  const rails  = [
    [FW + 1.2, padW,   0,                            (FD / 2 + padW / 2 + 0.05 + FRONT_EXT)],  // front
    [padW,     railLen, -(FW / 2 + padW / 2 + 0.05), 0.4 + FRONT_EXT / 2                   ],  // left side
    [padW,     railLen,  (FW / 2 + padW / 2 + 0.05), 0.4 + FRONT_EXT / 2                   ],  // right side
  ]
  for (const [w, d, px, pz] of rails) {
    const g = new THREE.BoxGeometry(w, 0.28, d)
    const m = new THREE.Mesh(g, padMat)
    m.position.set(px, 0.18, pz)
    group.add(m)
  }

  // Canvas-textured felt surface
  const feltTex = buildFeltTexture()
  feltTex.anisotropy = 16
  const feltGeo = new THREE.PlaneGeometry(FW, FD)
  const feltMat = new THREE.MeshBasicMaterial({ map: feltTex })
  const felt    = new THREE.Mesh(feltGeo, feltMat)
  felt.rotation.x = -Math.PI / 2
  felt.position.y = 0.05
  felt.receiveShadow = true
  group.add(felt)

  // ── Oval back end ──────────────────────────────────────────────────────────
  const wallH     = 1.8
  const bumperH   = 0.55
  const ovalHalfW = FW / 2 + 0.5
  const ovalDepth = 2.5

  function makeOvalMesh(geo, mat, scaleX, scaleZ, yPos) {
    const m = new THREE.Mesh(geo, mat)
    m.scale.set(scaleX, 1, scaleZ)
    m.position.set(0, yPos, -FD / 2)
    return m
  }

  const ovalRimGeo = new THREE.CylinderGeometry(1, 1, 0.85, 64, 1, false, Math.PI / 2, Math.PI)
  const ovalRimMat = new THREE.MeshLambertMaterial({ color: TABLE_WOOD })
  group.add(makeOvalMesh(ovalRimGeo, ovalRimMat, ovalHalfW + 1.0, ovalDepth + 0.8, -0.42))

  const ovalPadGeo = new THREE.CylinderGeometry(1, 1, 0.28, 64, 1, false, Math.PI / 2, Math.PI)
  group.add(makeOvalMesh(ovalPadGeo, padMat, ovalHalfW + 0.3, ovalDepth + 0.3, 0.18))

  const pyramidTex = buildPyramidTexture(Math.PI * (ovalHalfW + ovalDepth) / 2, wallH)
  const ovalWallGeo = new THREE.CylinderGeometry(1, 1, wallH, 64, 1, true, Math.PI / 2, Math.PI)
  const ovalWallMat = new THREE.MeshBasicMaterial({ map: pyramidTex, side: THREE.DoubleSide })
  group.add(makeOvalMesh(ovalWallGeo, ovalWallMat, ovalHalfW, ovalDepth, wallH / 2))

  // ── Interior bumper walls (left, right, front) ─────────────────────────────
  const darkMat  = new THREE.MeshLambertMaterial({ color: 0x0f2010 })
  const woodTopM = new THREE.MeshLambertMaterial({ color: TABLE_WOOD })
  const THICK    = 0.55

  function bumperBox(w, h, d, innerFace, px, py, pz) {
    const innerMat = new THREE.MeshBasicMaterial({ map: buildPyramidTexture(Math.max(w, d), h) })
    const mats = [darkMat, darkMat, woodTopM, darkMat, darkMat, darkMat]
    mats[innerFace] = innerMat
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats)
    mesh.position.set(px, py, pz)
    group.add(mesh)
  }

  bumperBox(THICK, bumperH, FD + FRONT_EXT, 0, -FW / 2 + THICK / 2, bumperH / 2, FRONT_EXT / 2)
  bumperBox(THICK, bumperH, FD + FRONT_EXT, 1,  FW / 2 - THICK / 2, bumperH / 2, FRONT_EXT / 2)
  bumperBox(FW, bumperH, THICK, 5, 0, bumperH / 2, FD / 2 - THICK / 2 + FRONT_EXT)

  // ── Chip rail groove ───────────────────────────────────────────────────────
  const chipRailMat = new THREE.MeshLambertMaterial({ color: 0x140804 })
  const chipRailY   = 0.34

  const fcrGeo = new THREE.BoxGeometry(FW + 1.2, 0.07, 0.72)
  const frontCR = new THREE.Mesh(fcrGeo, chipRailMat)
  frontCR.position.set(0, chipRailY, FD / 2 + 1.15 + FRONT_EXT)
  group.add(frontCR)

  for (const xOff of [-(FW / 2 + 1.15), FW / 2 + 1.15]) {
    const scrGeo = new THREE.BoxGeometry(0.72, 0.07, FD + 0.2 + FRONT_EXT)
    const sideCR = new THREE.Mesh(scrGeo, chipRailMat)
    sideCR.position.set(xOff, chipRailY, FRONT_EXT / 2)
    group.add(sideCR)
  }

  const chipColors = [0xff2222, 0x22aa44, 0x1144cc, 0xdddddd, 0x222222, 0xff8800]
  for (let i = -5; i <= 5; i++) {
    const col = chipColors[Math.abs(i) % chipColors.length]
    const chipMat = new THREE.MeshLambertMaterial({ color: col })
    const stackHeight = 4 + Math.floor(Math.abs(i * 0.7 + 1))
    for (let s = 0; s < stackHeight; s++) {
      const cg = new THREE.CylinderGeometry(0.2, 0.2, 0.07, 16)
      const cm = new THREE.Mesh(cg, chipMat)
      cm.position.set(i * 1.3, chipRailY + 0.05 + s * 0.075, FD / 2 + 1.15 + FRONT_EXT)
      group.add(cm)
    }
  }

  // ── Invisible collision boxes for raycasting, aligned to the felt art ──────
  // UV (design canvas) → world:  x = (u-0.5)·FW,  z = (v-0.5)·FD  (canvas top = far −z)
  const betMeshes = []
  for (const c of CELLS) {
    const u = (c.left + c.cw / 2) / DW
    const v = (c.top + c.ch / 2) / DH
    const geo  = new THREE.BoxGeometry((c.cw / DW) * FW, 0.06, (c.ch / DH) * FD)
    const mat  = new THREE.MeshBasicMaterial({
      color: BET_HOVER, transparent: true, opacity: 0, depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set((u - 0.5) * FW, 0.09, (v - 0.5) * FD)
    mesh.userData = { regionId: c.id, betType: c.betType, label: c.betType }
    group.add(mesh)
    betMeshes.push(mesh)
  }

  // Dealer point pucks — one per half of the layout (start OFF at their resting spots)
  const pointPucks = [createPointPuck(group, 'L'), createPointPuck(group, 'R')]

  group.position.z = -0.9
  scene.add(group)
  return { group, betMeshes, pointPucks }
}

// Toggle hover highlight on a bet area mesh
export function highlightBetArea(mesh, on) {
  mesh.material.opacity = on ? 0.3 : 0
}

// Place or remove stacked chip markers on a bet area
export function setChipMarker(mesh, count) {
  mesh.children.filter(c => c.userData.isChip).forEach(c => {
    c.geometry.dispose(); c.material.dispose(); mesh.remove(c)
  })
  const palette = [0xffd700, 0xff4444, 0x4488ff, 0x44dd44, 0xff8800]
  for (let i = 0; i < Math.min(count, 5); i++) {
    const geo  = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 20)
    const mat  = new THREE.MeshLambertMaterial({ color: palette[i % palette.length] })
    const chip = new THREE.Mesh(geo, mat)
    chip.position.set(0, 0.12 + i * 0.07, 0)
    chip.userData.isChip = true
    mesh.add(chip)
  }
}

// Move/flip a dealer puck: OFF at its resting spot during come-out, ON the point number
// on its own half of the layout otherwise.
export function updatePointPuck(puck, phase, point, betMeshes) {
  if (!puck) return
  const on = phase === 'point' && !!point
  puck.material[1].map = on ? puck.userData.onTex : puck.userData.offTex
  puck.material[1].needsUpdate = true
  puck.userData.sideMat.color.set(on ? 0xf5f2e9 : 0x141414)
  if (on) {
    const rid = puck.userData.side === 'R' ? `place${point}R` : `place${point}`
    const box = betMeshes.find(b => b.userData.regionId === rid)
    if (box) puck.position.set(box.position.x, 0.17, box.position.z - 0.26)
  } else {
    const { rest } = puck.userData
    puck.position.set(rest.x, 0.17, rest.z)
  }
}

// Show come/dont_come on-point pucks on the place-number area of the half where the
// bet was placed. `sideOf(bet)` returns 'L' or 'R'; defaults to 'L'. The local player's
// pucks (mySocketId) get a gold ring; other players' pucks are drawn smaller and translucent.
export function updateComePucks(betMeshes, bets, sideOf, mySocketId) {
  for (const mesh of betMeshes) {
    mesh.children.filter(c => c.userData.isPuck).forEach(c => {
      c.traverse(o => { o.geometry?.dispose(); o.material?.dispose() })
      mesh.remove(c)
    })
  }
  // Local player's pucks first so the per-number cap never hides them behind other players'
  const ordered = [...bets].sort((a, b) => (b.socketId === mySocketId) - (a.socketId === mySocketId))
  for (const bet of ordered) {
    if (!bet.target || (bet.type !== 'come' && bet.type !== 'dont_come')) continue
    const side = sideOf ? sideOf(bet) : 'L'
    const rid  = side === 'R' ? `place${bet.target}R` : `place${bet.target}`
    const mesh = betMeshes.find(m => m.userData.regionId === rid)
    if (!mesh) continue
    const existing = mesh.children.filter(c => c.userData.isPuck)
    if (existing.length >= 3) continue
    const color = bet.type === 'come' ? 0xf0f0f0 : 0x8b0000
    const mine  = bet.socketId === mySocketId
    const r     = mine ? 0.1 : 0.075
    const geo   = new THREE.CylinderGeometry(r, r, 0.05, 16)
    const mat   = new THREE.MeshLambertMaterial({ color, transparent: !mine, opacity: mine ? 1 : 0.5 })
    const puck  = new THREE.Mesh(geo, mat)
    if (mine) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 8, 20), new THREE.MeshBasicMaterial({ color: 0xf4c542 }))
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.025
      puck.add(ring)
    }
    puck.position.set(-0.15 + existing.length * 0.14, 0.2, -0.12)
    puck.userData.isPuck = true
    mesh.add(puck)
  }
}
