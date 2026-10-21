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
| `sw.js` | Not shipped on the site: the site's own worker (`/sw.js`) caches the four game files instead |
| `test/` | Node tests (see below) |

Drop the folder in as `/play/taiwan-mahjong/`. It opens straight from `index.html`, or from any static server.

## Look

A tilted 3D felt table on a wooden rim (pure CSS, no images): wall stacks that shrink as tiles are drawn, opponents’ hands standing along three edges, discards in the centre, and tiles with an ivory face on a jade body. Tile faces are inline SVG/text. Your hand sits below the table so tiles stay large enough to tap.

## Rules implemented

- 144 tiles (including 8 flowers), 16 tiles per player, 17th tile completes five sets and a pair.
- Chi (only from the player before you), peng, kong (open, concealed, added), flower replacement from the back of the wall.
- Claim priority: win over peng/kong over chi. Robbing a kong (搶槓). By default the nearest winner in turn order takes a discard; the optional house rule (setup screen or menu) lets several players win on the same discard, and the discarder pays each winner.
- Dealer stays on a dealer win or a draw game, with 連莊 streak tai. A round ends once every seat has dealt.
- Tai table: see `TAI_TABLE` in `engine.js`. Values follow MahJongo's published Taiwan table (https://mahjongo.com/taiwan) where it defines them; see "Rules source and open questions" below. House rules vary in Taiwan, so edit that table and `scoreHand()` if you want a different one.
- Flower wins: all eight flowers (八仙過海) win at once and all three opponents pay; seven flowers when another player draws the eighth (七搶一) wins at once and that player pays. 8 tai each.
- 人胡 (8 tai): a non-dealer who has not yet drawn wins on another player's discard in the first go-around, before any meld. 天胡 is 24, 地胡 16.
- Payout: `base + perTai × tai` (defaults 30 and 10, set in `new Match({base, perTai})`). A discard win is paid by the discarder only. A self-draw is paid by all three.

Not implemented (not defined by the reference table, so not guessed): 聽牌 / Ready declarations and the Earth Ready and Dealing Flowers bonuses,
天聽, and 十三么-style special hands. Points are a scoreboard only. There is no wagering.

## Rules source and open questions

Tai values and rules were aligned to https://mahjongo.com/taiwan (a published, current table; many Taiwanese households differ). Where that page gives a value but not
the exact trigger (人胡, 七搶一, 八仙過海), the usual convention is used and noted above. Kept from the original engine although the page does not list them:
平胡 (2, now only off a discard), 兩暗刻 (1), and the dealer-streak and 莊家 handling. 花槓 was removed because the page says no bonus is given for completing a flower set.
The payout (`30 + 10 × tai`) is a fixed scoreboard setting.

## Change from the supplied ZIP

`engine.js` is no longer byte-identical to the originally supplied file: it was extended (not rewritten) with the tai values above, 人胡, the flower wins and the
multiple-winners option. `game.js` gained the option's toggle, the result dialog for several winners and flower wins, and lost the optional service-worker
registration (the page registers the site worker instead). `style.css` is scoped under `.twmj` and has a phone-landscape layout.

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
