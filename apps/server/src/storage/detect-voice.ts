import { fileTypeFromBuffer } from "file-type";

export interface DetectedVoice {
  /** Type servi au lecteur : toujours audio, quel que soit le conteneur. */
  mimeType: "audio/webm" | "audio/mp4" | "audio/ogg";
}

interface TrackCount {
  audio: number;
  /** Toute piste qui n'est pas de l'audio : vidéo, sous-titres, données, ou type illisible. */
  other: number;
}

// Identifiants EBML (Matroska / WebM) utiles ici.
const EBML_SEGMENT = 0x18538067;
const EBML_TRACKS = 0x1654ae6b;
const EBML_TRACK_ENTRY = 0xae;
const EBML_TRACK_TYPE = 0x83;
const EBML_CLUSTER = 0x1f43b675;
const EBML_TRACK_AUDIO = 2;

/** Entier de longueur variable EBML ; `marker` garde le bit de longueur (identifiants). */
function readVint(data: Buffer, offset: number, marker: boolean): { value: number; length: number; unknown: boolean } | null {
  const first = data[offset];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length += 1;
  if (length > 8 || offset + length > data.length) return null;
  let value = marker ? first : first & (0xff >> length);
  let allOnes = value === (0xff >> length);
  for (let index = 1; index < length; index += 1) {
    const byte = data[offset + index]!;
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !marker && allOnes };
}

/** Entier non signé EBML, de 1 à 8 octets ; `null` pour une taille impossible. */
function readUint(data: Buffer, start: number, end: number): number | null {
  const size = end - start;
  if (size < 1 || size > 8 || end > data.length) return null;
  let value = 0;
  for (let index = start; index < end; index += 1) value = value * 256 + data[index]!;
  return value;
}

/**
 * Pistes d'un WebM, lues dans l'élément Tracks. Un enregistrement de
 * MediaRecorder annonce souvent un Segment de taille inconnue : il court
 * alors jusqu'à la fin du fichier.
 */
function countWebmTracks(data: Buffer): TrackCount | null {
  const count: TrackCount = { audio: 0, other: 0 };
  let offset = 0;
  let end = data.length;
  let entries = 0;
  let types = 0;
  while (offset < end) {
    const id = readVint(data, offset, true);
    if (!id) return null;
    const size = readVint(data, offset + id.length, false);
    if (!size) return null;
    const bodyStart = offset + id.length + size.length;
    const bodyEnd = size.unknown ? end : Math.min(bodyStart + size.value, end);
    if (id.value === EBML_SEGMENT || id.value === EBML_TRACKS || id.value === EBML_TRACK_ENTRY) {
      // On descend dans l'élément au lieu de le sauter.
      if (id.value === EBML_TRACK_ENTRY) entries += 1;
      if (id.value === EBML_SEGMENT) end = bodyEnd;
      offset = bodyStart;
      continue;
    }
    if (id.value === EBML_TRACK_TYPE) {
      // Un entier EBML peut tenir sur plusieurs octets : `00 01` est une vidéo.
      const type = size.unknown ? null : readUint(data, bodyStart, bodyStart + size.value);
      types += 1;
      if (type === EBML_TRACK_AUDIO) count.audio += 1;
      else count.other += 1;
    }
    // Les pistes sont toujours décrites avant les premières données.
    if (id.value === EBML_CLUSTER) break;
    if (size.unknown) return null;
    offset = bodyEnd;
  }
  // Une piste sans type déclaré n'est pas présumée audio.
  if (entries === 0) return null;
  count.other += Math.max(0, entries - types);
  return count;
}

// moov, trak et mdia : trois niveaux suffisent pour atteindre `hdlr`.
const MP4_MAX_DEPTH = 8;

/** Pistes d'un MP4 : le type de chaque `trak` est dans moov/trak/mdia/hdlr. */
function countMp4Tracks(data: Buffer): TrackCount | null {
  const count: TrackCount = { audio: 0, other: 0 };
  const containers = new Set(["moov", "trak", "mdia"]);
  let sawMoov = false;
  // Gestionnaire trouvé dans le `trak` en cours de lecture.
  let handler: string | null = null;

  function walk(start: number, end: number, depth: number): boolean {
    if (depth > MP4_MAX_DEPTH) return false;
    let offset = start;
    while (offset + 8 <= end) {
      let size = data.readUInt32BE(offset);
      const type = data.toString("latin1", offset + 4, offset + 8);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > end) return false;
        size = Number(data.readBigUInt64BE(offset + 8));
        header = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < header || offset + size > end) return false;
      if (type === "moov") sawMoov = true;
      if (type === "trak") {
        handler = null;
        if (!walk(offset + header, offset + size, depth + 1)) return false;
        // Un `trak` sans gestionnaire, ou d'un autre type que le son, est refusé.
        if (handler === "soun") count.audio += 1;
        else count.other += 1;
      } else if (containers.has(type)) {
        if (!walk(offset + header, offset + size, depth + 1)) return false;
      } else if (type === "hdlr" && offset + header + 12 <= offset + size) {
        // version et drapeaux (4 octets), pre_defined (4), puis handler_type.
        handler = data.toString("latin1", offset + header + 8, offset + header + 12);
      }
      offset += size;
    }
    return true;
  }

  if (!walk(0, data.length, 0) || !sawMoov) return null;
  return count;
}

const OGG_CAPTURE = Buffer.from("OggS");
const OGG_BEGINNING_OF_STREAM = 0x02;
const OGG_AUDIO_HEADERS = [Buffer.from("OpusHead"), Buffer.concat([Buffer.from([1]), Buffer.from("vorbis")])];

/**
 * Flux d'un Ogg : chacun s'ouvre par une page marquée « début de flux »,
 * toutes placées en tête du fichier. Chaque flux doit être de l'Opus ou du
 * Vorbis, sans quoi un flux vidéo (Theora) passerait derrière le premier.
 */
function countOggStreams(data: Buffer): TrackCount | null {
  const count: TrackCount = { audio: 0, other: 0 };
  let offset = 0;
  while (offset + 27 <= data.length && data.subarray(offset, offset + 4).equals(OGG_CAPTURE)) {
    const headerType = data[offset + 5]!;
    if ((headerType & OGG_BEGINNING_OF_STREAM) === 0) break;
    const segments = data[offset + 26]!;
    const tableEnd = offset + 27 + segments;
    if (tableEnd > data.length) return null;
    let bodySize = 0;
    for (let index = offset + 27; index < tableEnd; index += 1) bodySize += data[index]!;
    const body = data.subarray(tableEnd, tableEnd + bodySize);
    if (OGG_AUDIO_HEADERS.some((magic) => body.subarray(0, magic.length).equals(magic))) count.audio += 1;
    else count.other += 1;
    offset = tableEnd + bodySize;
  }
  return count.audio + count.other > 0 ? count : null;
}

function isAudioOnly(count: TrackCount | null): boolean {
  return count !== null && count.audio > 0 && count.other === 0;
}

/**
 * Message vocal tel que l'enregistre le navigateur : WebM/Opus (Chrome,
 * Firefox, Android), MP4/AAC (Safari, iPhone) ou Ogg/Opus (anciens Firefox),
 * gardé tel quel, sans conversion. Le type vient du contenu ; un WebM ou un
 * MP4 ou un Ogg n'est accepté qu'avec au moins une piste audio et aucune
 * autre piste, quel que soit son type.
 * `null` sinon.
 */
export async function detectVoice(data: Buffer): Promise<DetectedVoice | null> {
  const sniffed = await fileTypeFromBuffer(data);
  if (!sniffed) return null;
  // file-type ajoute parfois le codec : "audio/ogg; codecs=opus".
  switch (sniffed.mime.split(";")[0]) {
    case "video/webm":
    case "audio/webm":
      return isAudioOnly(countWebmTracks(data)) ? { mimeType: "audio/webm" } : null;
    case "video/mp4":
    case "audio/mp4":
    case "audio/x-m4a":
      return isAudioOnly(countMp4Tracks(data)) ? { mimeType: "audio/mp4" } : null;
    case "audio/ogg":
    case "audio/opus":
      return isAudioOnly(countOggStreams(data)) ? { mimeType: "audio/ogg" } : null;
    default:
      return null;
  }
}
