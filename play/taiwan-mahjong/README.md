# Taiwanese Mahjong 台灣麻將 — GoVibeTool Play

Solo 16-tile Taiwanese mahjong against three local bots. Static files only: no build step,
no server, no API calls, no third-party scripts, fonts or images. Works offline.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page: start screen, table, dialogs, plus the readable "About" content |
| `style.css` | All styling (system fonts only) |
| `engine.js` | Rules, win detection, tai scoring, bot AI. Pure logic, runs in the browser and in Node |
| `game.js` | Table UI, turn loop, hints, local stats |
| `sw.js` | Optional offline cache scoped to this folder only |
| `test/` | Node tests (see below) |

Drop the folder in as `/play/taiwan-mahjong/`. It opens straight from `index.html`, or from any static server.

## Look

A tilted 3D felt table on a wooden rim (pure CSS, no images): wall stacks that shrink as tiles are drawn, opponents’ hands standing along three edges, discards in the centre, and tiles with an ivory face on a jade body. Tile faces are inline SVG/text. Your hand sits below the table so tiles stay large enough to tap.

## Rules implemented

- 144 tiles (including 8 flowers), 16 tiles per player, 17th tile completes five sets and a pair.
- Chi (only from the player before you), peng, kong (open, concealed, added), flower replacement from the back of the wall.
- Claim priority: win over peng/kong over chi. Robbing a kong (搶槓).
- Dealer stays on a dealer win or a draw game, with 連莊 streak tai. A round ends once every seat has dealt.
- Tai table: see `TAI_TABLE` in `engine.js`. This is one common casual standard. House rules vary in Taiwan, so edit that table and `scoreHand()` if you want a different one.
- Payout: `base + perTai × tai` (defaults 30 and 10, set in `new Match({base, perTai})`). A discard win is paid by the discarder only. A self-draw is paid by all three.

Not implemented: 人胡/聽牌 declarations, 天聽, 十三么-style special hands, multi-winner ron.
Points are a scoreboard only. There is no wagering.

## Bots

Three levels (Friendly, Standard, Sharp), all local heuristics based on shanten (distance to ready),
tile efficiency, tracking visible tiles, and, for Sharp, defence against opponents with many melds.
Nothing leaves the device.

## Tests

```
node test/engine.test.js     # win detection, shanten, scoring, full bot matches with invariants
node test/fuzz.test.js       # 160 randomised matches with a "human" seat that also sends invalid input
node test/scenarios.test.js  # robbing a kong, added kong, self-draw, 天胡, dealer rotation
```

## Storage

`localStorage` keys `gvt.twmj.settings` and `gvt.twmj.stats` (settings and a personal record). Wrapped in try/catch,
so the game works with storage blocked.
