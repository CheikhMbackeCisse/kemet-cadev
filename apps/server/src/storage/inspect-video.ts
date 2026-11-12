// Durée d'une vidéo lue dans son conteneur, sans décoder une seule image et
// sans outil externe (aucune conversion sur le serveur, pas de ffmpeg).

function u32(data: Buffer, offset: number): number {
  return data.readUInt32BE(offset);
}

function u64(data: Buffer, offset: number): number {
  return Number(data.readBigUInt64BE(offset));
}

interface Box {
  type: string;
  start: number;
  end: number;
}

/** Boîtes ISO BMFF (MP4) entre `start` et `end` : taille sur 32 bits, 64 bits, ou jusqu'à la fin. */
function* boxes(data: Buffer, start: number, end: number): Generator<Box> {
  let offset = start;
  while (offset + 8 <= end) {
    let size = u32(data, offset);
    const type = data.toString("latin1", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) return;
      size = u64(data, offset + 8);
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) return;
    yield { type, start: offset + header, end: offset + size };
    offset += size;
  }
}

function child(data: Buffer, parent: Box, type: string): Box | undefined {
  for (const box of boxes(data, parent.start, parent.end)) if (box.type === type) return box;
  return undefined;
}

/** `mvhd` : échelle de temps et durée de la présentation entière. */
function mvhdDuration(data: Buffer, mvhd: Box): { timescale: number; duration: number } | null {
  const version = data[mvhd.start];
  if (version === 1 && mvhd.start + 32 <= mvhd.end) {
    return { timescale: u32(data, mvhd.start + 20), duration: u64(data, mvhd.start + 24) };
  }
  if (version === 0 && mvhd.start + 20 <= mvhd.end) {
    return { timescale: u32(data, mvhd.start + 12), duration: u32(data, mvhd.start + 16) };
  }
  return null;
}

/** `mehd` d'un MP4 fragmenté (enregistrement de navigateur) : durée totale des fragments. */
function mehdDuration(data: Buffer, mehd: Box): number | null {
  const version = data[mehd.start];
  if (version === 1 && mehd.start + 12 <= mehd.end) return u64(data, mehd.start + 4);
  if (version === 0 && mehd.start + 8 <= mehd.end) return u32(data, mehd.start + 4);
  return null;
}

/** Vrai si une piste du MP4 est de la vidéo ('vide' dans hdlr), et pas seulement du son. */
function mp4HasVideoTrack(data: Buffer, moov: Box): boolean {
  for (const trak of boxes(data, moov.start, moov.end)) {
    if (trak.type !== "trak") continue;
    const mdia = child(data, trak, "mdia");
    const hdlr = mdia && child(data, mdia, "hdlr");
    if (hdlr && hdlr.start + 12 <= hdlr.end && data.toString("latin1", hdlr.start + 8, hdlr.start + 12) === "vide") {
      return true;
    }
  }
  return false;
}

function inspectMp4(data: Buffer): VideoInfo {
  const moov = [...boxes(data, 0, data.length)].find((box) => box.type === "moov");
  if (!moov) return { durationMs: null, hasVideoTrack: false };
  return { durationMs: mp4DurationMs(data, moov), hasVideoTrack: mp4HasVideoTrack(data, moov) };
}

function mp4DurationMs(data: Buffer, moov: Box): number | null {
  const mvhd = child(data, moov, "mvhd");
  const header = mvhd && mvhdDuration(data, mvhd);
  if (!header || header.timescale === 0) return null;
  let duration = header.duration;
  if (duration === 0 || duration === 0xffffffff) {
    const mvex = child(data, moov, "mvex");
    const mehd = mvex && child(data, mvex, "mehd");
    duration = (mehd && mehdDuration(data, mehd)) ?? 0;
  }
  return duration > 0 ? Math.round((duration / header.timescale) * 1000) : null;
}

// Identifiants EBML (Matroska / WebM) utiles ici.
const SEGMENT = 0x18538067;
const TRACKS = 0x1654ae6b;
const TRACK_ENTRY = 0xae;
const TRACK_TYPE = 0x83;
const TRACK_TYPE_VIDEO = 1;
const INFO = 0x1549a966;
const TIMECODE_SCALE = 0x2ad7b1;
const DURATION = 0x4489;
const CLUSTER = 0x1f43b675;
const CLUSTER_TIMECODE = 0xe7;
const SIMPLE_BLOCK = 0xa3;
const BLOCK_GROUP = 0xa0;
const BLOCK = 0xa1;

function readVint(data: Buffer, offset: number, marker: boolean): { value: number; length: number; unknown: boolean } | null {
  const first = data[offset];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length += 1;
  if (length > 8 || offset + length > data.length) return null;
  let value = marker ? first : first & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let index = 1; index < length; index += 1) {
    const byte = data[offset + index]!;
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !marker && allOnes };
}

function readUint(data: Buffer, start: number, end: number): number {
  let value = 0;
  for (let index = start; index < end; index += 1) value = value * 256 + data[index]!;
  return value;
}

/**
 * Durée d'un WebM : l'élément Duration de Info s'il existe ; sinon (fichier
 * enregistré par MediaRecorder ou par Playwright, qui ne l'écrivent pas) le
 * plus grand horodatage de bloc trouvé dans les clusters.
 */
function inspectWebm(data: Buffer): VideoInfo {
  let hasVideoTrack = false;
  let timecodeScale = 1_000_000;
  let declared: number | null = null;
  let clusterTimecode = 0;
  let lastBlock = -1;
  let offset = 0;
  let end = data.length;
  while (offset < end) {
    const id = readVint(data, offset, true);
    if (!id) break;
    const size = readVint(data, offset + id.length, false);
    if (!size) break;
    const bodyStart = offset + id.length + size.length;
    const bodyEnd = size.unknown ? end : Math.min(bodyStart + size.value, end);
    switch (id.value) {
      case SEGMENT:
        end = bodyEnd;
        offset = bodyStart;
        continue;
      case INFO:
      case TRACKS:
      case TRACK_ENTRY:
      case CLUSTER:
      case BLOCK_GROUP:
        // On descend dans l'élément au lieu de le sauter.
        offset = bodyStart;
        continue;
      case TIMECODE_SCALE:
        timecodeScale = readUint(data, bodyStart, bodyEnd) || timecodeScale;
        break;
      case DURATION:
        if (bodyEnd - bodyStart === 4) declared = data.readFloatBE(bodyStart);
        else if (bodyEnd - bodyStart === 8) declared = data.readDoubleBE(bodyStart);
        break;
      case TRACK_TYPE:
        if (readUint(data, bodyStart, bodyEnd) === TRACK_TYPE_VIDEO) hasVideoTrack = true;
        break;
      case CLUSTER_TIMECODE:
        clusterTimecode = readUint(data, bodyStart, bodyEnd);
        break;
      case SIMPLE_BLOCK:
      case BLOCK: {
        const track = readVint(data, bodyStart, false);
        if (track && bodyStart + track.length + 2 <= bodyEnd) {
          const relative = data.readInt16BE(bodyStart + track.length);
          lastBlock = Math.max(lastBlock, clusterTimecode + relative);
        }
        break;
      }
    }
    offset = bodyEnd;
  }
  const units = declared !== null && declared > 0 ? declared : lastBlock;
  return {
    durationMs: units > 0 ? Math.round((units * timecodeScale) / 1_000_000) : null,
    hasVideoTrack,
  };
}

export interface VideoInfo {
  /** `null` si le conteneur ne donne pas la durée. */
  durationMs: number | null;
  /** Faux pour un fichier de son seul, même dans un conteneur vidéo. */
  hasVideoTrack: boolean;
}

/** Durée et présence d'une piste vidéo d'un MP4 ou d'un WebM. */
export function inspectVideo(data: Buffer, mimeType: "video/mp4" | "video/webm"): VideoInfo {
  return mimeType === "video/mp4" ? inspectMp4(data) : inspectWebm(data);
}
