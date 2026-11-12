import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectVideo } from "./video-info.js";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

function box(type: string, body: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, body]);
}

/** MP4 minimal : ftyp, puis moov avec un mvhd version 0 et une piste vidéo. */
function syntheticMp4(timescale: number, duration: number): Buffer {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(timescale, 12);
  mvhd.writeUInt32BE(duration, 16);
  const hdlr = Buffer.alloc(24);
  hdlr.write("vide", 8, "latin1");
  const trak = box("trak", box("mdia", box("hdlr", hdlr)));
  return Buffer.concat([
    box("ftyp", Buffer.from("isom\0\0\0\0isomiso2", "latin1")),
    box("moov", Buffer.concat([box("mvhd", mvhd), trak])),
  ]);
}

describe("inspectVideo", () => {
  it("lit la durée et la piste vidéo d'un WebM et d'un MP4 enregistrés par un navigateur", () => {
    const webm = inspectVideo(fixture("clip.webm"), "video/webm");
    expect(webm.hasVideoTrack).toBe(true);
    expect(webm.durationMs).toBeGreaterThan(1000);
    expect(webm.durationMs).toBeLessThan(2000);
    const mp4 = inspectVideo(fixture("clip.mp4"), "video/mp4");
    expect(mp4.hasVideoTrack).toBe(true);
    expect(mp4.durationMs).toBeGreaterThan(1000);
    expect(mp4.durationMs).toBeLessThan(2000);
  });

  it("voit qu'un fichier de son seul n'a pas de piste vidéo", () => {
    expect(inspectVideo(fixture("voice.mp4"), "video/mp4").hasVideoTrack).toBe(false);
    expect(inspectVideo(fixture("voice.webm"), "video/webm").hasVideoTrack).toBe(false);
  });

  it("lit la durée déclarée dans mvhd", () => {
    expect(inspectVideo(syntheticMp4(1000, 61_000), "video/mp4")).toEqual({
      durationMs: 61_000,
      hasVideoTrack: true,
    });
    expect(inspectVideo(syntheticMp4(90_000, 90_000 * 12), "video/mp4").durationMs).toBe(12_000);
  });

  it("rend une durée nulle quand le conteneur ne la donne pas", () => {
    expect(inspectVideo(syntheticMp4(1000, 0), "video/mp4").durationMs).toBeNull();
    expect(inspectVideo(Buffer.from("pas une video"), "video/mp4")).toEqual({
      durationMs: null,
      hasVideoTrack: false,
    });
    expect(inspectVideo(Buffer.alloc(0), "video/webm")).toEqual({
      durationMs: null,
      hasVideoTrack: false,
    });
  });
});
