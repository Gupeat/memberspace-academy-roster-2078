// Minimal EBML probe for the MediaRecorder WebM we produce. It does not need
// ffprobe: it reads the Segment/Info/Cluster structure and reports the number
// of video blocks plus the last cluster timestamp. The file intentionally has
// no Duration element, so players may show Infinity until the end is reached.
const UNKNOWN_SIZE = 0xffffffffffffff;

function vint(buffer, offset, keepMarker) {
  const first = buffer[offset];
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && !(first & mask)) {
    length += 1;
    mask >>= 1;
  }
  if (length > 8) throw new Error("bad EBML variable integer at " + offset);
  let value = keepMarker ? first : first & (mask - 1);
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + buffer[offset + index];
  }
  return { value, length };
}

export function probeWebm(buffer) {
  const result = {
    bytes: buffer.length,
    timecodeScale: 0,
    clusters: 0,
    frames: 0,
    lastTimestampMs: 0,
    durationKnown: false,
  };

  function walk(start, end) {
    let offset = start;
    while (offset < end) {
      const id = vint(buffer, offset, true);
      const size = vint(buffer, offset + id.length, false);
      const data = offset + id.length + size.length;
      const childEnd = size.value >= UNKNOWN_SIZE ? end : Math.min(end, data + size.value);
      if (data > end) break;
      if (id.value === 0x18538067) {
        walk(data, childEnd);
      } else if (id.value === 0x1F43B675) {
        result.clusters += 1;
        walk(data, childEnd);
      } else if (id.value === 0xE7) {
        result.lastTimestampMs = buffer.readUIntBE(data, Math.min(size.value, 6));
      } else if (id.value === 0xA3 || id.value === 0xA0) {
        result.frames += 1;
      } else if (id.value === 0x2AD7B1) {
        result.timecodeScale = buffer.readUIntBE(data, Math.min(size.value, 6));
      } else if ([0x1A45DFA3, 0x114D9B74, 0x1549A966, 0x1654AE6B, 0x1C53BB6B, 0x1254C367].includes(id.value)) {
        walk(data, childEnd);
      }
      offset = childEnd;
    }
  }

  walk(0, buffer.length);
  result.durationMs = result.lastTimestampMs;
  return result;
}
