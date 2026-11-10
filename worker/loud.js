// Make voice clips a steady, comfortable loudness. Aura-2 clips come out quiet (and some voices
// quieter than others), so they're hard to hear next to the sound effects. This raises a 16-bit
// PCM WAV so its loudest moment is just under full scale (at most 4× louder).

const TARGET_PEAK = 0.93 * 32767;
const MAX_GAIN = 4;

/** Returns a louder copy of a 16-bit PCM WAV (ArrayBuffer), or the original if it isn't one. */
export function louder(buf) {
  const v = new DataView(buf);
  if (buf.byteLength < 44 || v.getUint32(0) !== 0x52494646 /* RIFF */ || v.getUint32(8) !== 0x57415645 /* WAVE */) return buf;
  // Find the "fmt " and "data" chunks.
  let pos = 12, bits = 0, dataStart = -1, dataLen = 0;
  while (pos + 8 <= buf.byteLength) {
    const id = v.getUint32(pos), size = v.getUint32(pos + 4, true);
    if (id === 0x666d7420 /* fmt  */) bits = v.getUint16(pos + 22, true);
    if (id === 0x64617461 /* data */) { dataStart = pos + 8; dataLen = Math.min(size, buf.byteLength - dataStart); break; }
    pos += 8 + size + (size % 2);
  }
  if (bits !== 16 || dataStart < 0) return buf;
  const out = buf.slice(0);
  const s = new Int16Array(out, dataStart, Math.floor(dataLen / 2));
  let peak = 0;
  for (let i = 0; i < s.length; i++) { const a = Math.abs(s[i]); if (a > peak) peak = a; }
  if (!peak) return buf;
  const gain = Math.min(MAX_GAIN, TARGET_PEAK / peak);
  if (gain <= 1.02) return buf;
  for (let i = 0; i < s.length; i++) s[i] = Math.max(-32768, Math.min(32767, Math.round(s[i] * gain)));
  return out;
}
