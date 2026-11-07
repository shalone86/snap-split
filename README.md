# 🧲 Snap & Split

Live at **https://snap.shalonely.com**

PreK math (ages 3–5): **count**, **put together** and **take apart** with friendly blocks, up to 10. Everything is read aloud, so no reading is needed.

- **Count:** blocks sit in a ten-frame. Tapping a block counts it out loud ("one, two, three…") and puts a number on it. Then pick the number.
- **Snap (adding):** a blue group and a yellow group. Kids tap the blocks and they snap together into a ten-frame. The colors stay, so the 3 and the 2 are still visible inside the 5.
- **Split (taking away):** kids tap blocks to take them away. Each one moves to the "take away" box (both parts stay visible), and what's left slides back to the start of the ten-frame.
- **Answer buttons** show the number and its dots. A wrong answer gets "count them one at a time"; after a second try the answer is shown.
- **Number sentences** (3 + 2 = 5) appear after each problem, in the blocks' colors. Grown-ups can turn them off.
- **Levels:** Count to 5 → Snap to 5 → Split from 5 → Count to 10 → Snap to 10 → Split from 10 → Snap or split. Five problems each, with stars and stickers.
- **Free play:** add blue and yellow blocks, snap them, split them.

Built from the learning-app template (`public/js/kit/`): read-aloud voice with device fallback, sounds, motion, zoom-proof answer bar, offline, PNG icons, and the Cloudflare Worker.

## Run and deploy

```bash
npm install
npm test                                  # problem generator checks
python3 -m http.server -d public 8787     # or: npx wrangler dev
npx wrangler deploy                       # → https://snap-split.<you>.workers.dev
```

For a custom domain, uncomment the `routes` line in `wrangler.jsonc` (and add a comma after `"workers_dev": true`).

| Path | What |
|---|---|
| `public/js/problems.js` | Levels, problem generator, answer choices, number sentences (tested) |
| `public/js/app.js` | Home, levels (count / snap / split), free play, grown-ups page |
| `public/css/app.css` | Blocks, plates, ten-frame |
| `public/js/kit/`, `public/css/base.css` | From the template (shared by all the apps) |

## Run your own copy

This is open source (MIT). You don't need to code to use it, just visit [angelio.org/snap/](https://angelio.org/snap/).
If you do code and want your own copy, or want to change it for your class:

```bash
git clone https://github.com/shalone86/snap-split.git && cd snap-split
npm install
npm test
python3 -m http.server -d public 8787     # open http://localhost:8787 (uses the device's voice)
npx wrangler deploy                       # optional: your own Cloudflare Worker with the nicer voice
```

Before deploying your own copy, change `"name"` in `wrangler.jsonc` and remove the `routes` and
`vars` lines (those belong to angelio.org). Building a new app? Start from
[shalone86/app-template](https://github.com/shalone86/app-template). Fixes and question corrections
are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md).

The code is MIT licensed ([LICENSE](LICENSE)). The name "Angelio" and its logo are not part of the license.
