Pair Riddle — Two-player seed-driven web riddles

This repository contains a lightweight two-player riddle game:

- Server: Node.js + Express serving static files and providing seed-based room links.
- Client: Single-file React app in `public/room.html` (loads per-level logic from `public/levels/<level>/logic.js`).
- Levels: Each level lives in `public/levels/<level>/` and includes `player1.json`, `player2.json`, and `logic.js`.
- Deterministic generation: server creates time-bucketed seeds; client uses a deterministic PRNG and seeded shuffle to present matching puzzles to both players without sockets.

How to run locally

1. Install dependencies (if not present):

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open a room link (example):

- `http://localhost:3000/room.html?seed=...&player=player1&theme=rune`

Or use the convenience redirect routes (which calculate a seed for a 3-minute bucket):

- `/rune/<team>/<player>`

Notes

- Level logic and riddle data are stored under `public/levels/`.
- Use the debug answer `test` to bypass checks during development.

