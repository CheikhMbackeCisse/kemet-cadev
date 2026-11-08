import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectVoice } from "./detect-voice.js";

// Enregistrements d'une seconde et demie faits par Chromium avec MediaRecorder
// (micro simulé), tels qu'un navigateur les envoie.
const webm = readFileSync(new URL("./fixtures/voice.webm", import.meta.url));
const mp4 = readFileSync(new URL("./fixtures/voice.mp4", import.meta.url));

function replaceOnce(data: Buffer, from: Buffer, to: Buffer): Buffer {
  const index = data.indexOf(from);
  if (index < 0) throw new Error("motif introuvable dans le fichier de test");
  const copy = Buffer.from(data);
  to.copy(copy, index);
  return copy;
}

/** Élément EBML dont la taille tient sur un octet. */
function ebml(id: number[], ...body: Buffer[]): Buffer {
  const content = Buffer.concat(body);
  return Buffer.concat([Buffer.from(id), Buffer.from([0x80 | content.length]), content]);
}

function webmWithTrackTypes(...types: number[][]): Buffer {
  const header = ebml([0x1a, 0x45, 0xdf, 0xa3], ebml([0x42, 0x82], Buffer.from("webm")));
  const entries = types.map((type) => ebml([0xae], ebml([0x83], Buffer.from(type))));
  const tracks = ebml([0x16, 0x54, 0xae, 0x6b], ...entries);
  const segment = Buffer.concat([
    Buffer.from([0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
    tracks,
    ebml([0x1f, 0x43, 0xb6, 0x75]),
  ]);
  return Buffer.concat([header, segment]);
}

/** Page Ogg qui ouvre un flux (somme de contrôle non vérifiée ici). */
function oggFirstPage(serial: number, packet: Buffer): Buffer {
  const header = Buffer.alloc(27);
  header.write("OggS", 0, "latin1");
  header[5] = 0x02;
  header.writeUInt32LE(serial, 14);
  header[26] = 1;
  return Buffer.concat([header, Buffer.from([packet.length]), packet]);
}

const OPUS_HEAD = Buffer.concat([Buffer.from("OpusHead"), Buffer.from([1, 1, 0x38, 0x01, 0x80, 0xbb, 0, 0, 0, 0, 0])]);

describe("detectVoice", () => {
  it("accepte un WebM/Opus de MediaRecorder et le sert en audio/webm", async () => {
    expect(await detectVoice(webm)).toEqual({ mimeType: "audio/webm" });
  });

  it("accepte un MP4/AAC de MediaRecorder (Safari) et le sert en audio/mp4", async () => {
    expect(await detectVoice(mp4)).toEqual({ mimeType: "audio/mp4" });
  });

  it("refuse un WebM dont la piste est une vidéo", async () => {
    // TrackType (0x83), taille 1 (0x81), valeur 2 (audio) devient 1 (vidéo).
    const video = replaceOnce(webm, Buffer.from([0x83, 0x81, 0x02]), Buffer.from([0x83, 0x81, 0x01]));
    expect(await detectVoice(video)).toBeNull();
  });

  it("refuse un MP4 dont la piste est une vidéo", async () => {
    const video = replaceOnce(mp4, Buffer.from("soun"), Buffer.from("vide"));
    expect(await detectVoice(video)).toBeNull();
  });

  it("refuse un fichier tronqué avant la description des pistes", async () => {
    expect(await detectVoice(webm.subarray(0, 40))).toBeNull();
  });

  it("refuse une image, un PDF et du texte", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex");
    expect(await detectVoice(png)).toBeNull();
    expect(await detectVoice(Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n"))).toBeNull();
    expect(await detectVoice(Buffer.from("bonjour"))).toBeNull();
  });

  it("lit le type d'une piste WebM sur toute sa taille : une vidéo codée sur deux octets est refusée", async () => {
    expect(await detectVoice(webmWithTrackTypes([0x02]))).toEqual({ mimeType: "audio/webm" });
    expect(await detectVoice(webmWithTrackTypes([0x02], [0x00, 0x01]))).toBeNull();
    // Sous-titres (17) : pas de l'audio, donc refusé aussi.
    expect(await detectVoice(webmWithTrackTypes([0x02], [0x11]))).toBeNull();
  });

  it("refuse un MP4 dont une piste n'est pas du son, quel que soit son gestionnaire", async () => {
    const auxiliary = replaceOnce(mp4, Buffer.from("soun"), Buffer.from("auxv"));
    expect(await detectVoice(auxiliary)).toBeNull();
  });

  it("refuse un MP4 aux boîtes imbriquées sans fin sans épuiser la pile", async () => {
    let nested = Buffer.alloc(0);
    for (let depth = 0; depth < 20_000; depth += 1) {
      const box = Buffer.alloc(8);
      box.writeUInt32BE(8 + nested.length, 0);
      box.write("moov", 4, "latin1");
      nested = Buffer.concat([box, nested]);
    }
    const ftyp = Buffer.from("00000014667479704d344120000000004d344120", "hex");
    await expect(detectVoice(Buffer.concat([ftyp, nested]))).resolves.toBeNull();
  });

  it("accepte un Ogg/Opus et refuse un Ogg qui ajoute un flux vidéo", async () => {
    const opus = oggFirstPage(1, OPUS_HEAD);
    expect(await detectVoice(opus)).toEqual({ mimeType: "audio/ogg" });
    const theora = oggFirstPage(2, Buffer.concat([Buffer.from([0x80]), Buffer.from("theora"), Buffer.alloc(20)]));
    expect(await detectVoice(Buffer.concat([opus, theora]))).toBeNull();
  });
});
