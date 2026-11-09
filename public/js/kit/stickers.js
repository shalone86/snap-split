// Stickers shared by every app on the same website, for the Sticker World (angelio.org/stickers/),
// where kids place the stickers they've earned in little play scenes.
//
//   localStorage["angelio:stickers"] = { "<app>/<level>": { e: "🦄", big: true, t: 1700000000000 } }
//
// One sticker per level: a mini one when the level had mistakes, giant when it had none.
// A mini sticker grows into a giant one when the level is played again with no mistakes.

const KEY = "angelio:stickers";
export const STICKER_WORLD = "https://angelio.org/stickers/"; // set to "" in your own app to hide the link

export function shareSticker(app, level, e, big) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    const k = `${app}/${level}`, old = all[k];
    all[k] = { e: old?.e ?? e, big: !!(big || old?.big), t: old?.t ?? Date.now() };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* storage blocked */ }
}
