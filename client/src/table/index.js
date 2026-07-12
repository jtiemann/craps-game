import * as THREE from 'three'

const TABLE_WOOD = 0x3d2005
const RAIL_PAD   = 0x7a5a14   // tan/leather rail cushion
const BET_HOVER  = 0xffcc00

// Felt dimensions (Three.js units)
const FW = 16
const FD = 11
const PX = 128           // canvas pixels per Three.js unit
const CW = FW * PX       // 2048
const CD = FD * PX       // 1408

// Three.js → canvas coordinate helpers
function tx(x) { return (x + FW / 2) * PX }
function tz(z) { return (z + FD / 2) * PX }

// Canvas drawing helpers
function fillR(ctx, x, z, w, d, color) {
  ctx.fillStyle = color
  ctx.fillRect(tx(x) - w * PX / 2, tz(z) - d * PX / 2, w * PX, d * PX)
}
function strokeR(ctx, x, z, w, d, color, lw = 3) {
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.strokeRect(tx(x) - w * PX / 2, tz(z) - d * PX / 2, w * PX, d * PX)
}
function txt(ctx, text, x, z, font, color = '#f0f0e0', align = 'center', baseline = 'middle') {
  ctx.fillStyle = color
  ctx.font = font
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(text, tx(x), tz(z))
}

// ── Casino die face ───────────────────────────────────────────────────────────
const PIP_POS = {
  1: [[0, 0]],
  2: [[-0.42, -0.42], [0.42, 0.42]],
  3: [[-0.42, -0.42], [0, 0], [0.42, 0.42]],
  4: [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]],
  5: [[-0.42, -0.42], [0.42, -0.42], [0, 0], [-0.42, 0.42], [0.42, 0.42]],
  6: [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0], [0.42, 0], [-0.42, 0.42], [0.42, 0.42]],
}

function drawDieFace(ctx, cx, cy, size, value) {
  const r   = size * 0.82
  const pip = size * 0.13
  const rr  = size * 0.18
  ctx.fillStyle   = '#f5edd8'
  ctx.strokeStyle = '#777755'
  ctx.lineWidth   = Math.max(1, size * 0.07)
  ctx.beginPath()
  if (ctx.roundRect) {
    ctx.roundRect(cx - r, cy - r, r * 2, r * 2, rr)
  } else {
    ctx.rect(cx - r, cy - r, r * 2, r * 2)
  }
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#cc1111'
  const spread = r * 0.56
  for (const [px, py] of (PIP_POS[value] ?? [])) {
    ctx.beginPath()
    ctx.arc(cx + px * spread, cy + py * spread, pip, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── Bet area definitions ──────────────────────────────────────────────────────
// Layout mirrors a real Las Vegas table:
//   near player edge (high z) → Pass Line, Don't Pass, Field, Come,
//                                 Don't Come, Place Numbers, Props (low z)

const BET_AREAS = [
  // ─ Free Odds area (behind the Pass Line, between Pass Line and front rail) ─
  { id: 'pass_odds',  x:  0.0, z:  5.3,  w: 14.0, d: 0.4  },
  // ─ Near player edge ──────────────────────────────────────────────────────
  { id: 'pass_line',  x:  0.0, z:  4.65, w: 14.0, d: 1.1  },
  { id: 'dont_pass',  x:  0.0, z:  3.9,  w: 14.0, d: 0.55 },
  // ─ Field & Big 6/8 corner panels ─────────────────────────────────────────
  { id: 'field',      x:  0.0, z:  2.9,  w: 10.0, d: 0.95 },
  { id: 'big_6',      x: -6.3, z:  2.3,  w:  1.5, d: 2.8  },
  { id: 'big_8',      x:  6.3, z:  2.3,  w:  1.5, d: 2.8  },
  // ─ Come / Don't Come ─────────────────────────────────────────────────────
  { id: 'come',       x:  0.0, z:  1.5,  w: 10.0, d: 1.9  },
  { id: 'dont_come',  x:  0.0, z:  0.45, w: 10.0, d: 0.55 },
  // ─ Place numbers strip ────────────────────────────────────────────────────
  { id: 'place_4',    x: -4.5, z: -0.45, w:  1.4, d: 1.1  },
  { id: 'place_5',    x: -3.0, z: -0.45, w:  1.4, d: 1.1  },
  { id: 'place_6',    x: -1.5, z: -0.45, w:  1.4, d: 1.1  },
  { id: 'seven',      x:  0.0, z: -0.45, w:  1.4, d: 1.1  },  // non-bet center
  { id: 'place_8',    x:  1.5, z: -0.45, w:  1.4, d: 1.1  },
  { id: 'place_9',    x:  3.0, z: -0.45, w:  1.4, d: 1.1  },
  { id: 'place_10',   x:  4.5, z: -0.45, w:  1.4, d: 1.1  },
  // ─ Center proposition strip ──────────────────────────────────────────────
  { id: 'any_seven',  x: -2.5, z: -2.0,  w:  3.2, d: 0.88 },
  { id: 'yo',         x: -2.5, z: -3.0,  w:  3.2, d: 0.88 },
  { id: 'any_craps',  x:  2.5, z: -2.0,  w:  3.2, d: 0.88 },
  { id: 'horn',       x:  2.5, z: -3.0,  w:  3.2, d: 0.88 },
  // ─ Hardways ──────────────────────────────────────────────────────────────
  { id: 'hard_10',    x: -5.8, z: -2.0,  w:  2.2, d: 0.88 },
  { id: 'hard_6',     x: -5.8, z: -3.0,  w:  2.2, d: 0.88 },
  { id: 'hard_8',     x:  5.8, z: -2.0,  w:  2.2, d: 0.88 },
  { id: 'hard_4',     x:  5.8, z: -3.0,  w:  2.2, d: 0.88 },
]

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

// ── Canvas layout ─────────────────────────────────────────────────────────────
function buildFeltTexture() {
  const canvas = document.createElement('canvas')
  canvas.width  = CW
  canvas.height = CD
  const ctx = canvas.getContext('2d')

  // Color palette (casino baize green table — bright vivid casino green)
  const GREEN   = '#2d7a40'
  const GREEN_D = '#1f5a2e'
  const GREEN_L = '#357a47'
  const W       = '#f0f0e0'
  const YL      = '#ffd700'
  const RD      = '#8b0000'
  const RD_L    = '#a01515'
  const PROP_BG = '#1a4a24'

  // Base felt
  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, CW, CD)

  // ─── FREE ODDS strip (between front rail and Pass Line) ───────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.font = `italic 14px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('FREE ODDS — click Pass Line or this area to take odds behind the line', tx(0), tz(5.32))

  // ─── PASS LINE ─────────────────────────────────────────────────────────────
  fillR(ctx, 0, 4.65, 14, 1.1, GREEN_L)
  strokeR(ctx, 0, 4.65, 14, 1.1, W, 6)
  strokeR(ctx, 0, 4.65, 13.7, 0.87, W, 1.5)
  txt(ctx, 'PASS   LINE', 0, 4.65, `bold italic 54px 'Times New Roman', Georgia, serif`, W)

  // ─── DON'T PASS BAR ────────────────────────────────────────────────────────
  fillR(ctx, 0, 3.9, 14, 0.55, GREEN_D)
  strokeR(ctx, 0, 3.9, 14, 0.55, W, 4)
  strokeR(ctx, 0, 3.9, 13.7, 0.33, W, 1.5)
  txt(ctx, "DON'T   PASS   BAR", 0, 3.9, `bold 26px Arial, sans-serif`, W)

  // ─── FIELD ─────────────────────────────────────────────────────────────────
  fillR(ctx, 0, 2.9, 10, 0.95, GREEN_L)
  strokeR(ctx, 0, 2.9, 10, 0.95, W, 5)
  strokeR(ctx, 0, 2.9, 9.75, 0.72, W, 1.5)
  txt(ctx, 'FIELD', -3.8, 2.9, `bold italic 30px 'Times New Roman', serif`, W)

  const fieldNums = [
    { n: '2',  cx: -2.5,  special: true  },
    { n: '3',  cx: -1.82 },
    { n: '4',  cx: -1.14 },
    { n: '9',  cx:  0.0  },
    { n: '10', cx:  0.72 },
    { n: '11', cx:  1.46 },
    { n: '12', cx:  2.18, special: true  },
  ]
  for (const f of fieldNums) {
    txt(ctx, f.n, f.cx, 2.83, `bold 28px 'Times New Roman', serif`, f.special ? YL : W)
    if (f.special) {
      ctx.strokeStyle = YL; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(tx(f.cx), tz(2.83), PX * 0.22, 0, Math.PI * 2); ctx.stroke()
    }
  }
  txt(ctx, '2 PAYS DBL',  -2.5,  3.1,  `bold 12px Arial, sans-serif`, YL)
  txt(ctx, '12 PAYS TRP',  2.18, 3.1,  `bold 12px Arial, sans-serif`, YL)

  // ─── BIG 6 / BIG 8 corner panels ───────────────────────────────────────────
  for (const [xPos, num] of [[-6.3, 6], [6.3, 8]]) {
    fillR(ctx, xPos, 2.3, 1.5, 2.8, GREEN_D)
    strokeR(ctx, xPos, 2.3, 1.5, 2.8, W, 3)
    txt(ctx, 'BIG', xPos, 3.28, `bold italic 17px 'Times New Roman', serif`, W)
    txt(ctx, String(num), xPos, 2.55, `bold 50px 'Times New Roman', serif`, YL)
    txt(ctx, 'Pays', xPos, 1.8, `italic 14px Arial, sans-serif`, W)
    txt(ctx, 'Even', xPos, 1.58, `italic 14px Arial, sans-serif`, W)
  }

  // ─── COME ──────────────────────────────────────────────────────────────────
  strokeR(ctx, 0, 1.5, 10, 1.9, W, 5)
  strokeR(ctx, 0, 1.5, 9.75, 1.67, W, 1.5)
  txt(ctx, 'C O M E', 0, 1.5, `bold italic 64px 'Times New Roman', Georgia, serif`, '#d44040')

  // ─── DON'T COME BAR ────────────────────────────────────────────────────────
  fillR(ctx, 0, 0.45, 10, 0.55, GREEN_D)
  strokeR(ctx, 0, 0.45, 10, 0.55, W, 3)
  strokeR(ctx, 0, 0.45, 9.75, 0.33, W, 1.5)
  txt(ctx, "DON'T  COME  BAR", 0, 0.45, `bold 22px Arial, sans-serif`, W)

  // ─── PLACE NUMBERS STRIP ────────────────────────────────────────────────────
  strokeR(ctx, 0, -0.45, 9.8, 1.1, W, 4)
  const placeBoxes = [
    { x: -4.5, lbl: '4',     pay: '9 TO 5', alt: true  },
    { x: -3.0, lbl: '5',     pay: '7 TO 5', alt: false },
    { x: -1.5, lbl: 'SIX',   pay: '7 TO 6', alt: true  },
    { x:  0.0, lbl: null,    pay: null,      alt: false },
    { x:  1.5, lbl: 'EIGHT', pay: '7 TO 6', alt: true  },
    { x:  3.0, lbl: 'NINE',  pay: '7 TO 5', alt: false },
    { x:  4.5, lbl: '10',    pay: '9 TO 5', alt: true  },
  ]
  for (const p of placeBoxes) {
    fillR(ctx, p.x, -0.45, 1.4, 1.1, p.alt ? GREEN_D : GREEN)
    strokeR(ctx, p.x, -0.45, 1.4, 1.1, W, 2)
    if (p.lbl) {
      txt(ctx, p.lbl, p.x, -0.35, `bold 34px 'Times New Roman', serif`, W)
      txt(ctx, p.pay, p.x, -0.63, `bold 13px Arial, sans-serif`, YL)
    } else {
      ctx.strokeStyle = W; ctx.lineWidth = 2; ctx.globalAlpha = 0.3
      ctx.beginPath(); ctx.arc(tx(0), tz(-0.45), PX * 0.38, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 0.35
      txt(ctx, '7', 0, -0.45, `bold 32px Arial`, W)
      ctx.globalAlpha = 1
    }
  }
  txt(ctx, '— PLACE BETS —', 0, -1.08, `bold 20px Arial, sans-serif`, W)

  // ─── PROPOSITION SECTION ────────────────────────────────────────────────────
  // Dark background panel
  fillR(ctx, 0, -2.5, 14, 2.1, PROP_BG)
  strokeR(ctx, 0, -2.5, 14, 2.1, W, 3)

  // Hard-way boxes (left wing: Hard 10 / Hard 6; right wing: Hard 8 / Hard 4)
  function hardway(x, z, dieVal, hardNum, pay) {
    fillR(ctx, x, z, 2.2, 0.88, RD)
    strokeR(ctx, x, z, 2.2, 0.88, W, 2)
    const bH  = 0.88 * PX
    const top = tz(z) - bH / 2
    // Label
    ctx.fillStyle = W
    ctx.font = `bold 13px Arial, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillText(`HARD ${hardNum}`, tx(x), top + 5)
    // Two dice
    const dSz = bH * 0.21
    const dY  = tz(z) + bH * 0.02
    drawDieFace(ctx, tx(x) - PX * 0.33, dY, dSz, dieVal)
    drawDieFace(ctx, tx(x) + PX * 0.33, dY, dSz, dieVal)
    // Pay
    ctx.fillStyle = YL
    ctx.font = `bold 12px Arial, sans-serif`
    ctx.textBaseline = 'bottom'
    ctx.fillText(pay, tx(x), top + bH - 5)
  }

  hardway(-5.8, -2.0, 5, 10, '7 FOR 1')
  hardway(-5.8, -3.0, 3,  6, '9 FOR 1')
  hardway( 5.8, -2.0, 4,  8, '9 FOR 1')
  hardway( 5.8, -3.0, 2,  4, '7 FOR 1')

  // Prop bet boxes (center-left: Any Seven, Yo; center-right: Any Craps, Horn)
  const propBets = [
    { x: -2.5, z: -2.0, top: 'ANY',   bot: 'SEVEN',  pay: '5 FOR 1'  },
    { x: -2.5, z: -3.0, top: 'YO',    bot: '(11)',   pay: '15 FOR 1' },
    { x:  2.5, z: -2.0, top: 'ANY',   bot: 'CRAPS',  pay: '7 FOR 1'  },
    { x:  2.5, z: -3.0, top: 'HORN',  bot: 'BET',    pay: 'VARIOUS'  },
  ]
  for (const p of propBets) {
    fillR(ctx, p.x, p.z, 3.2, 0.88, RD_L)
    strokeR(ctx, p.x, p.z, 3.2, 0.88, W, 2)
    txt(ctx, p.top, p.x, p.z - 0.15, `bold 18px Arial, sans-serif`, W)
    txt(ctx, p.bot, p.x, p.z + 0.05, `bold 18px Arial, sans-serif`, W)
    txt(ctx, p.pay, p.x, p.z + 0.27, `bold 12px Arial, sans-serif`, YL)
  }

  // Decorative "7" in center of prop strip
  ctx.globalAlpha = 0.55
  txt(ctx, '7', 0, -2.5, `bold italic 60px 'Times New Roman', serif`, YL)
  ctx.globalAlpha = 1

  // ─── Back-wall diamond rail markers ─────────────────────────────────────────
  ctx.fillStyle = W; ctx.globalAlpha = 0.18
  for (let dx = -7; dx <= 7; dx += 1.5) {
    const dcx = tx(dx), dcy = tz(-4.4)
    ctx.beginPath()
    ctx.moveTo(dcx, dcy - 18); ctx.lineTo(dcx + 14, dcy)
    ctx.lineTo(dcx, dcy + 18); ctx.lineTo(dcx - 14, dcy)
    ctx.closePath(); ctx.fill()
  }
  ctx.globalAlpha = 1

  return new THREE.CanvasTexture(canvas)
}

// ─── 3D table construction ────────────────────────────────────────────────────
export function createTable(scene) {
  const group = new THREE.Group()

  // Outer wooden frame (rectangular body; oval back is added separately)
  const rimMat = new THREE.MeshLambertMaterial({ color: TABLE_WOOD })
  const rimGeo = new THREE.BoxGeometry(FW + 3.0, 0.85, FD + 1.0)
  const rim    = new THREE.Mesh(rimGeo, rimMat)
  rim.position.set(0, -0.42, 0.8)  // shifted slightly front to leave room for oval
  group.add(rim)

  const FRONT_EXT = FD * 0.1   // 1.1 u of extra plain felt toward player
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
  // Half-ellipse: PI/2 → 3PI/2 arc of a unit cylinder, scaled to (halfW, 1, depth)
  // At theta=PI/2: (1,y,0) → (halfW, y, 0) — right edge of table
  // At theta=PI:   (0,y,-1) → (0, y, -depth) — back tip
  // At theta=3PI/2:(-1,y,0) → (-halfW,y,0) — left edge
  const wallH     = 1.8    // back oval bumper height
  const bumperH   = 0.55   // side + front interior bumper height (low enough to see pass line)
  const ovalHalfW = FW / 2 + 0.5   // 8.5 — matches table half-width + small overlap
  const ovalDepth = 2.5             // how far back the oval protrudes

  function makeOvalMesh(geo, mat, scaleX, scaleZ, yPos) {
    const m = new THREE.Mesh(geo, mat)
    m.scale.set(scaleX, 1, scaleZ)
    m.position.set(0, yPos, -FD / 2)
    return m
  }

  // Wooden oval frame extension
  const ovalRimGeo = new THREE.CylinderGeometry(1, 1, 0.85, 64, 1, false, Math.PI / 2, Math.PI)
  const ovalRimMat = new THREE.MeshLambertMaterial({ color: TABLE_WOOD })
  group.add(makeOvalMesh(ovalRimGeo, ovalRimMat, ovalHalfW + 1.0, ovalDepth + 0.8, -0.42))

  // Padded back rail (follows oval)
  const ovalPadGeo = new THREE.CylinderGeometry(1, 1, 0.28, 64, 1, false, Math.PI / 2, Math.PI)
  group.add(makeOvalMesh(ovalPadGeo, padMat, ovalHalfW + 0.3, ovalDepth + 0.3, 0.18))

  // Pyramid-bump back wall
  const pyramidTex = buildPyramidTexture(Math.PI * (ovalHalfW + ovalDepth) / 2, wallH)
  const ovalWallGeo = new THREE.CylinderGeometry(1, 1, wallH, 64, 1, true, Math.PI / 2, Math.PI)
  const ovalWallMat = new THREE.MeshBasicMaterial({ map: pyramidTex, side: THREE.DoubleSide })
  group.add(makeOvalMesh(ovalWallGeo, ovalWallMat, ovalHalfW, ovalDepth, wallH / 2))


  // ── Interior bumper walls (left, right, front) ─────────────────────────────
  // BoxGeometry so the wood-capped top face is visible from the overhead camera,
  // and the inner pyramid face is visible when orbiting to the side.
  const darkMat  = new THREE.MeshLambertMaterial({ color: 0x0f2010 })
  const woodTopM = new THREE.MeshLambertMaterial({ color: TABLE_WOOD })
  const THICK    = 0.55   // wall depth — top face visible from above

  function bumperBox(w, h, d, innerFace, px, py, pz) {
    // innerFace: 0=+X, 1=-X, 4=+Z, 5=-Z
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

  // ── Chip rail groove (on outer wooden frame, around player side) ────────────
  // Dark rubber-lined trough between the padded rail and outer edge of frame.
  // Players store their chip stacks here.
  const chipRailMat = new THREE.MeshLambertMaterial({ color: 0x140804 })
  const chipRailY   = 0.34

  // Front chip rail
  const fcrGeo = new THREE.BoxGeometry(FW + 1.2, 0.07, 0.72)
  const frontCR = new THREE.Mesh(fcrGeo, chipRailMat)
  frontCR.position.set(0, chipRailY, FD / 2 + 1.15 + FRONT_EXT)
  group.add(frontCR)

  // Side chip rails
  for (const xOff of [-(FW / 2 + 1.15), FW / 2 + 1.15]) {
    const scrGeo = new THREE.BoxGeometry(0.72, 0.07, FD + 0.2 + FRONT_EXT)
    const sideCR = new THREE.Mesh(scrGeo, chipRailMat)
    sideCR.position.set(xOff, chipRailY, FRONT_EXT / 2)
    group.add(sideCR)
  }

  // Chip stacks in rail (decorative — give visual cue that chips go here)
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

  // Invisible collision boxes for raycasting
  const betMeshes = []
  for (const area of BET_AREAS) {
    const geo  = new THREE.BoxGeometry(area.w, 0.06, area.d)
    const mat  = new THREE.MeshBasicMaterial({
      color: BET_HOVER, transparent: true, opacity: 0, depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(area.x, 0.09, area.z)
    mesh.userData = { betAreaId: area.id, label: area.id }
    group.add(mesh)
    betMeshes.push(mesh)
  }

  // Plain-felt extension in front of the pass line (no markings)
  const extFeltGeo = new THREE.PlaneGeometry(FW, FRONT_EXT)
  const extFeltMat = new THREE.MeshBasicMaterial({ color: 0x2d7a40 })
  const extFelt    = new THREE.Mesh(extFeltGeo, extFeltMat)
  extFelt.rotation.x = -Math.PI / 2
  extFelt.position.set(0, 0.05, FD / 2 + FRONT_EXT / 2)
  group.add(extFelt)

  group.position.z = -0.9
  scene.add(group)
  return { group, betMeshes }
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
    const geo  = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20)
    const mat  = new THREE.MeshLambertMaterial({ color: palette[i % palette.length] })
    const chip = new THREE.Mesh(geo, mat)
    chip.position.set(0, 0.14 + i * 0.09, 0)
    chip.userData.isChip = true
    mesh.add(chip)
  }
}

// Show come/dont_come on-point pucks on number strip areas
export function updateComePucks(betMeshes, bets) {
  for (const mesh of betMeshes) {
    mesh.children.filter(c => c.userData.isPuck).forEach(c => {
      c.geometry.dispose(); c.material.dispose(); mesh.remove(c)
    })
  }
  const areaMap = Object.fromEntries(betMeshes.map(m => [m.userData.betAreaId, m]))
  for (const bet of bets) {
    if (!bet.target || (bet.type !== 'come' && bet.type !== 'dont_come')) continue
    const mesh = areaMap[`place_${bet.target}`]
    if (!mesh) continue
    const existing = mesh.children.filter(c => c.userData.isPuck)
    if (existing.length >= 3) continue
    const color = bet.type === 'come' ? 0xf0f0f0 : 0x8b0000
    const geo   = new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16)
    const mat   = new THREE.MeshLambertMaterial({ color })
    const puck  = new THREE.Mesh(geo, mat)
    puck.position.set(-0.2 + existing.length * 0.18, 0.22, -0.2)
    puck.userData.isPuck = true
    mesh.add(puck)
  }
}
