# Tycoon

A 3D property-trading board game for the browser: the classic rules, the house rules and modes of the
modern digital editions, a living animated world around the board, bots, pass & play and online rooms
served from your own computer.

Not affiliated with Hasbro or Marmalade Game Studio. Names, board, cards, tokens and mascot are original.

## Run it

Needs Node 18 or newer.

```sh
npm install
npm start          # builds the game and serves it on http://localhost:8080
```

The server prints the addresses to use:

- **On this Mac:** http://localhost:8080
- **Friends on the same Wi-Fi:** the `http://192.168.x.x:8080` line. The first time, macOS may ask whether
  `node` may accept incoming connections; allow it.
- **Friends anywhere else:** in a second terminal run `npx cloudflared tunnel --url localhost:8080`
  and share the `https://….trycloudflare.com` address it prints (no account needed). The tunnel lasts
  while that terminal is open.

`PORT=9000 npm start` uses another port. `npm run serve` serves the last build without rebuilding.

## Play on a phone with no network

Bots and Pass & Play run entirely on the phone, so they work on a plane. Every push to `main` publishes the game to
https://gaurav25122000.github.io/tycoon/ (`.github/workflows/pages.yml`).

1. While online, open https://gaurav25122000.github.io/tycoon/ on the phone.
2. Add it to the home screen: in Safari tap Share, then Add to Home Screen; in Chrome tap ⋮, then Add to Home screen.
3. Open Tycoon from the home screen once, still online, and wait for the title screen. The phone now keeps the game.
4. Check it: turn on airplane mode, close the app fully and open it again.

On the plane pick *Pass & Play*, add players (up to 4) and hand the phone over at each "Pass to …" screen. The game
saves itself, so *Continue game* picks it up if the phone closes the app. Online rooms still need the server and a
network. Phones keep a game for offline play only from an https address, so the `http://192.168.x.x` address can't.

## Playing

- **Play vs bots:** up to 3 bots, each Easy, Medium or Hard.
- **Pass & Play:** up to 4 people on one device; a "Pass to …" screen hands over between turns.
- **Online:** *Quick match* joins any open game on the server or opens one; *Private game* gets a
  4-letter code to share; *Open game* is listed for anyone on the server. The host can add bots, pick
  the board and the rules, and remove players. A reload or dropped connection rejoins the same seat.
- **Boards:** Living City, Neon 2121, Snowdrop Valley, Enchanted Forest, Coral Kingdom.
- **Rules:** Classic (official rules, building on your own turn), Quick Mode, or House Rules: Chill
  Zone Bonus (free parking), Skip Spaces, Start Bonus, No Jail Rent, No Auctions, Auction Only, Quick
  End, Quick Hotels, Quick Jail, Starting Title Deeds, Speed Die, plus
  Build Evenly, Build Where You Land or Land and Build (one house per landing, no set needed),
  Housing Shortage (the bank's last house and hotel always go to auction, open to everyone; one won
  at auction is kept and built free later), Classic Income
  Tax, First Lap, starting cash, a turn timer and a game time limit. The full rules (when you can
  build, hotels, jail, mortgages, bankruptcy) are under *How to play* on the title screen and *Menu →
  Rules* in a game, worded for that game's house rules.
- **Controls:** tap Roll, tap the dice or press Space. A turn ends by itself when there is nothing left
  to build, or after 5 seconds without a tap (an open panel other than a trade holds it). Drag to orbit,
  scroll or pinch to zoom, right-drag to pan, tap any square (or a property in a player's list) for its deed.
- **Camera:** *Follow* moves with the play; *Tabletop* holds the whole board still, seen from above
  without the streets, and pinch or scroll zooms in (drag to look around). Pick one in the Menu or
  with the top-view button; the other top button recentres.
- Local games save themselves; *Continue game* on the title screen picks up where you left off.
  Stats and achievements are kept in the browser.

## Develop

```sh
npm run dev        # Vite dev server on :5173 (local modes)
npm run serve      # in a second terminal, for online rooms (Vite proxies /ws to :8080)
npm test           # rules tests and 1,000 bot-only games (SIM_GAMES=100 npm test for a quick run)
```

Browser checks drive Chromium through Playwright and save screenshots:

```sh
npx vite build
node scripts/e2e.mjs flowsDesktop flowsPhone extras offers diceCheck themes adaptive offline
TYCOON_BOT_PACE=0.15 SCENARIO_SECONDS=570 node scripts/e2e.mjs online
node scripts/e2e.mjs onlineAuction   # two live players and a bot: no auction closes early on the slower screen
SCENARIO_SECONDS=570 node scripts/e2e.mjs gameBots   # also gamePass, gameQuick, gameSpeed: whole games through the UI
```

It looks for Playwright's Chromium in `~/Library/Caches/ms-playwright/chromium-1228`; set `CHROME` to
another Chrome binary if needed. `SHOTS` sets the screenshot folder, `TYCOON_BOT_PACE=0.15` speeds up
server-side bots, `SCENARIO_SECONDS` raises the per-scenario time limit.

## Layout

| Path | What |
|---|---|
| `src/engine.js` | The rules: pure state transitions shared by the browser and the server |
| `src/bots.js` | Bot decisions, pacing, and the "raise it for me" plan |
| `src/net.js` | Local and online game controllers |
| `src/present.js` | Turns the engine's effect log into animation, sound and HUD moments |
| `src/scene/` | three.js world: board, tokens, physics dice, landmarks, city themes, effects, camera, and the 3D renders the menus and HUD show (tokens, dice, boards, trophy, mascot, icons, emotes, house and hotel pieces, landmarks) |
| `src/ui/` | HUD, menus, mascot |
| `src/sw.js` | Keeps the game on the device for offline play; `vite.config.js` fills in each build's file list |
| `src/fonts/`, `public/` | Bundled fonts, the home screen icon and manifest |
| `server.js` | Static files plus WebSocket rooms; rooms are saved to `data/rooms.json` |
| `test/` | Rules tests and the bot simulation |
| `scripts/` | Browser end-to-end checks |
