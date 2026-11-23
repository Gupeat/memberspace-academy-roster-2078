// Minimal EBML probe for the MediaRecorder WebM we produce. It does not need
// ffprobe: it reads the Segment/Info/Cluster structure, every SimpleBlock's
// cluster-relative timestamp, and reports the last frame timestamp. The file
// intentionally has no Duration element, so players may show Infinity until
// the end is reached.
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
    lastClusterTimestampMs: 0,
    lastFrameStartMs: 0,
    frameDeltaMs: 0,
    durationMs: 0,
    durationKnown: false,
    metric: "last-frame-start",
  };
  const frameStarts = [];
  let clusterTimestampTicks = 0;
  let lastClusterTicks = 0;

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
        clusterTimestampTicks = 0;
        walk(data, childEnd);
      } else if (id.value === 0xE7) {
        clusterTimestampTicks = buffer.readUIntBE(data, Math.min(size.value, 6));
        lastClusterTicks = Math.max(lastClusterTicks, clusterTimestampTicks);
      } else if (id.value === 0xA3 || id.value === 0xA1) {
        // SimpleBlock/Block: track vint, int16 cluster-relative timecode, flags, payload.
        const track = vint(buffer, data, false);
        if (data + track.length + 2 <= childEnd) {
          const relativeMs = buffer.readInt16BE(data + track.length);
          result.frames += 1;
          frameStarts.push(clusterTimestampTicks + relativeMs);
        }
      } else if (id.value === 0xA0) {
        walk(data, childEnd);
      } else if (id.value === 0x2AD7B1) {
        result.timecodeScale = buffer.readUIntBE(data, Math.min(size.value, 6));
      } else if ([0x1A45DFA3, 0x114D9B74, 0x1549A966, 0x1654AE6B, 0x1C53BB6B, 0x1254C367].includes(id.value)) {
        walk(data, childEnd);
      }
      offset = childEnd;
    }
  }

  walk(0, buffer.length);
  const scale = result.timecodeScale || 1_000_000;
  const toMs = (ticks) => Math.round((ticks * scale) / 1_000_000);
  frameStarts.sort((a, b) => a - b);
  result.lastClusterTimestampMs = toMs(lastClusterTicks);
  if (frameStarts.length > 0) {
    result.lastFrameStartMs = toMs(frameStarts[frameStarts.length - 1]);
    if (frameStarts.length > 1) {
      result.frameDeltaMs = result.lastFrameStartMs - toMs(frameStarts[frameStarts.length - 2]);
    }
    result.durationMs = result.lastFrameStartMs;
  }
  return result;
}
