# Craps Game — Project Spec

_Based on confirmed intent (interview-me, 2026-06-19). Revised 2026-07-27 to match the shipped v1._

This is the design-intent document: what the game is and why. For build/run instructions and the
as-built protocol reference, see [`README.md`](README.md).

---

## 1. Objective

A browser-based multiplayer craps game with realistic three.js 3D visuals. Players join a shared table, watch one synchronized staged dice-roll animation, and bet on standard craps outcomes using play-money chips. The house maintains a ~2% edge via a configurable server-authoritative weighted RNG. Real-money chip purchases are a planned later phase (social-casino model: chips bought, never cashed out).

**Target users:** Players joining shared tables for a social craps experience.
**Builder:** Solo developer. Priority: fast, extensible v1 foundation.
**Migration note:** Node.js + Socket.io is the prototype transport; the target backend is Elixir (Phoenix Channels). Architecture must keep game logic pure and transport-agnostic.

---

## 2. Core Features (v1)

### Authentication
- Username/password registration and login
- JWT returned on login, passed in Socket.io `auth` handshake
- In-memory user store for prototype (no DB persistence — acceptable; sessions reset on restart)
- Each user has: `id`, `username`, `chipBalance` (default: 1000 chips)

### Lobby / Table Management
- Players can see available tables and join one
- One table per game loop for v1 (expand later)
- Max players per table: 8
- Players can be spectators (watch without betting) or bettors
- Players may cash out at any time — stakes on unresolved bets are refunded and the seat is released
- A disconnected player's seat and bets are held for 30 seconds to survive a refresh

### Craps Game Loop

**Phase 1 — Come-Out Roll**
- Point is not yet established
- Betting open: Pass Line, Don't Pass, Field, Props, Come, Don't Come
- Roll result:
  - `7` or `11` → Pass Line wins, Don't Pass loses → new come-out
  - `2` or `3` → Pass Line loses, Don't Pass wins → new come-out
  - `12` → Pass Line loses, Don't Pass **pushes** (bars 12) → new come-out
  - `4 5 6 8 9 10` → Point established, move to Phase 2

**Phase 2 — Point Phase**
- Point number displayed; Pass/Don't Pass locked in
- Betting open: Come, Don't Come, Place bets, Field, Props, Hard Ways, Odds (behind Pass/Don't Pass/Come/Don't Come)
- Roll result:
  - Point number → Pass Line wins, Don't Pass loses → return to Come-Out (same shooter keeps the dice)
  - `7` → Pass Line loses (seven-out), Don't Pass wins, all Come/Place bets lose → return to Come-Out
  - Any Come number → resolves or establishes Come point
  - Field/Prop numbers → resolved immediately on each roll

**Shooter rotation**
- Seated players hold the dice in join order; the first player to sit is the opening shooter
- The dice pass to the next seated player on a **seven-out**, and when the current shooter leaves
- A shooter must have a Pass Line or Don't Pass bet down before they may roll
- A shooter who doesn't roll within **3 minutes** is cashed out automatically so the table can't stall

### Bet Menu (Full Standard Set)

**Multi-roll bets** (persist until resolved):

| Bet | Wins when | Payout |
|-----|-----------|--------|
| Pass Line | 7/11 come-out, or point before 7 | 1:1 |
| Don't Pass | 2/3 come-out (12 pushes), or 7 before point | 1:1 |
| Pass Odds (4/10) | Point before 7 | 2:1 |
| Pass Odds (5/9) | Point before 7 | 3:2 |
| Pass Odds (6/8) | Point before 7 | 6:5 |
| Don't Pass Odds (4/10) | 7 before point | 1:2 |
| Don't Pass Odds (5/9) | 7 before point | 2:3 |
| Don't Pass Odds (6/8) | 7 before point | 5:6 |
| Come | 7/11 on next roll, or come-point before 7 | 1:1 |
| Don't Come | 2/3 on next roll (12 pushes), or 7 before come-point | 1:1 |
| Come/Don't Come Odds | Same as pass odds, applied to come-point | same as pass odds |
| Place 4 / Place 10 | Number before 7 | 9:5 |
| Place 5 / Place 9 | Number before 7 | 7:5 |
| Place 6 / Place 8 | Number before 7 | 7:6 |
| Hard 4 / Hard 10 | Pair before 7 or easy version | 7:1 |
| Hard 6 / Hard 8 | Pair before 7 or easy version | 9:1 |

**Single-roll bets** (resolved on the very next roll):

| Bet | Wins on | Payout |
|-----|---------|--------|
| Field | 2, 3, 4, 9, 10, 11 (1:1); 12 (2:1); 2 (2:1) | varies |
| Any Seven | 7 | 4:1 |
| Any Craps | 2, 3, 12 | 7:1 |
| Yo (11) | 11 | 15:1 |
| Aces (2) | 2 | 30:1 |
| Ace-Deuce (3) | 3 | 15:1 |
| Boxcars (12) | 12 | 30:1 |
| Horn | 2, 3, 11, 12 (split 4-way) | varies per component |
| Big 6 / Big 8 | 6 or 8 before 7 | 1:1 |

### Dice / RNG

- **Server-authoritative**: server generates dice result before animation begins
- **Weighted RNG**: configurable per-outcome weight table. `server/src/game/rng.js` supplies the weighted-draw mechanism and a `FAIR_WEIGHTS` baseline (1/36 per combination); the live table owns its own weights (`HOUSE_WEIGHTS` in `server/src/rooms/table.js`), currently favoring 7 by a factor of 1.12. Production weights to be tuned to yield ~2% overall house edge across the standard bet mix. The weight table is a server-side secret — never exposed to clients.
- **Interaction note**: Standard craps rules already build in bet-specific edges (1.41%–16.7%). The dice bias is a secondary tuning lever; calibrate weights carefully to avoid inverting edges on don't-side bets.

### Three.js Animation

- Server sends `rollResult: { die1: N, die2: N }` to all players in the room before animation begins
- Client stages the throw: apply initial position/velocity/spin, run physics briefly for visual realism, then smoothly guide dice to land on the server-predetermined faces (no free-physics outcome)
- All clients receive the same result and animate simultaneously on a synchronized start signal
- Camera path: dramatic arc following dice throw, settling on result close-up

### Multiplayer Sync (Socket.io → JSON protocol)

All messages are plain JSON. No Socket.io-specific RPC patterns (to ease Elixir port).

Key events (client → server):
- `join_table` — identity comes from the handshake JWT, not the payload
- `join_as_spectator`
- `place_bet` `{ bet_type, amount, target? }` (target for place/come/hardway and odds bets)
- `ready_for_roll` (shooter signals ready)
- `cash_out` (leave the table; unresolved stakes refunded)
- `remove_bet` `{ bet_id }` — reserved in the protocol, not yet implemented

Key events (server → client):
- `table_state` `{ id, phase, point, shooter_socket_id, players, spectators, bets }` — full state
- `bet_placed` `{ bet, table_state }`
- `roll_start` `{ die1, die2, total, timestamp }` — result + sync timestamp for animation
- `roll_resolved` `{ die1, die2, total, event, resolved, updates, table_state }`
- `chip_update` `{ player_id, chip_balance }`
- `cashed_out` `{ reason: 'left' | 'timeout', chip_balance }`
- `reconnected` — full table state, to the reconnecting socket only
- `error` `{ code, message }`

The as-built payloads and the full error-code list are tabulated in [`README.md`](README.md#protocol).

---

## 3. Project Structure

As built (the original spec anticipated a `game/rules.js` and a `ws/handlers.js`; validation ended up
in `rooms/table.js` and socket wiring stayed in `server/index.js`):

```
craps-game/
├── server/
│   ├── src/
│   │   ├── game/                 # pure functions, no I/O — the Elixir port target
│   │   │   ├── state.js          # phase state machine (come-out ↔ point)
│   │   │   ├── bets.js           # bet definitions + payout table
│   │   │   ├── resolution.js     # resolve all bets against a roll
│   │   │   └── rng.js            # weighted dice RNG + FAIR_WEIGHTS baseline
│   │   ├── rooms/
│   │   │   └── table.js          # roster, bet validation + collection, shooter
│   │   │                         #   rotation, cash-out, house weight table
│   │   ├── auth/
│   │   │   ├── index.js          # register, login, JWT sign/verify, in-memory user store
│   │   │   └── routes.js         # POST /auth/register, POST /auth/login
│   │   └── ws/
│   │       └── authMiddleware.js # Socket.io handshake auth
│   ├── package.json
│   └── index.js                  # express + socket.io bootstrap, event wiring,
│                                 #   reconnect holds, idle-shooter timeout
├── client/
│   ├── src/
│   │   ├── main.js               # bootstrap, auth UI, socket event handlers, bet UI
│   │   ├── scene/index.js        # three.js renderer, camera, lighting
│   │   ├── table/index.js        # table mesh, felt, betting areas, point puck
│   │   ├── dice/
│   │   │   ├── mesh.js           # dice geometry, face textures
│   │   │   └── animation.js      # throw staging, physics blend, face-landing guide
│   │   ├── ui/hud.js             # chip balance, bets, shooter indicator, outcome flash
│   │   ├── audio/index.js        # synthesized SFX + croupier voice
│   │   └── ws/socket.js          # Socket.io client wrapper, event dispatch
│   ├── index.html
│   └── vite.config.js
├── shared/
│   └── protocol.js               # message type constants shared by server and client
├── README.md
└── SPEC.md
```

**Key constraint:** `server/src/game/` must be pure functions with no imports from `ws/`, `rooms/`, or any I/O. This makes the Elixir port a direct translation of logic rather than a disentanglement.

---

## 4. Commands

```bash
# Development
npm run dev          # server (nodemon) + client (vite) concurrently
npm run dev:server   # server only
npm run dev:client   # client (Vite) only

# Testing
npm test             # unit tests (game logic only — no socket, no three.js)
npm run test:watch   # watch mode

# Build
npm run build        # Vite production bundle to client/dist/
npm start            # production server (API + socket.io; does not yet serve client/dist/)
```

---

## 5. Code Style

- **Language**: JavaScript (ES modules), no TypeScript for prototype speed — annotate complex types with JSDoc where non-obvious
- **Server**: Node.js 20+, ES modules (`"type": "module"` in package.json)
- **Client**: Vite, plain JS (no framework — three.js + vanilla DOM for UI overlays)
- **Formatting**: Prettier defaults (2-space indent, single quotes)
- **Naming**: camelCase for variables/functions, PascalCase for classes/constructors, SCREAMING_SNAKE for constants
- **No comments** unless the why is non-obvious (hidden constraint, subtle invariant, craps-rule quirk)
- **Game logic**: pure functions, no side effects, easy to test in isolation — this is the Elixir migration path
- **Message protocol**: all socket messages use snake_case keys (matches Elixir/Phoenix convention for the port)

---

## 6. Testing Strategy

**Unit test: game logic only** (no socket, no browser, no three.js)

- `game/state.js` — phase transitions (come-out → point → resolution)
- `game/bets.js` + `game/resolution.js` — all payout calculations, edge cases (bars 12 on don't pass, hard way vs easy), come-point tracking per player
- `game/rng.js` — weighted distribution matches target over large samples (within tolerance)
- `auth/` — registration, bcrypt hashing, login, JWT verification

**Room / integration tests** (Node.js, no browser):

- `rooms/table.js` — roster management, per-phase bet validation and rejection, shooter rotation on seven-out and on departure, cash-out refunds
- Simulated Socket.io client connects, authenticates, joins table, places pass line + field bets, receives `roll_start`, receives `roll_resolved` with correct payouts

**Not automated for v1:**

- Three.js visual correctness (dice land on correct face, animation timing) — verify manually
- Cross-browser rendering — verify manually

**Test runner**: Vitest (shared config between server unit tests and future client tests)

---

## 7. Boundaries

### Always
- Server is the sole source of truth for dice outcomes — never compute or trust client-side dice results
- Keep `server/src/game/` free of all I/O, socket, and framework imports (pure functions only)
- Use snake_case keys in all socket messages (Phoenix/Elixir compatibility)
- Validate all incoming bets server-side before applying to game state
- Never expose the dice weight table to clients

### Ask First
- Changes to payout tables or RNG weights (affects house edge math)
- Adding new bet types (requires rules + payout logic + table UI changes in concert)
- Auth scheme changes (switching from JWT to sessions, adding OAuth)
- Multiplayer protocol changes (affects both sides simultaneously)

### Never
- Store credentials in plaintext (hash passwords with bcrypt)
- Generate dice results client-side
- Couple game logic modules to Socket.io or any transport
- Use Socket.io `.on('*')` wildcards or room broadcast patterns that don't translate to Phoenix Channels

---

## 8. Out of Scope (v1)

- Real-money chip purchases / payment processing
- Persistent database (in-memory store is acceptable for prototype)
- Mobile app wrapper
- Regulatory/licensing compliance
- Full visual polish
- Multiple simultaneous tables
- Serving the built client from the Node server (separate static host for now)
- `remove_bet` — reserved in the protocol, no handler yet

**Delivered ahead of plan** (originally listed as out of scope for v1): shooter rotation, the odds
bet UI, and synthesized sound design.

---

## 9. Known Prototype Gaps

Acceptable locally, must be closed before any public deployment:

- `POST /admin/give-chips` is unauthenticated
- `JWT_SECRET` falls back to `dev_secret_change_in_prod` when unset
- Socket.io CORS is pinned to `http://localhost:5173`
- Users, chip balances, and table state are in-memory — everything resets on restart
