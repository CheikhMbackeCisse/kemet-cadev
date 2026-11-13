import { QueryClient } from "@tanstack/react-query";
import type { Attachment, PostSummary } from "@kemet/shared";
import { describe, expect, it } from "vitest";
import { feedQueryKey, postQueryKey, type FeedData } from "./feedQuery.js";
import { postVideo, updatePostInCaches, videoPostsAround } from "./videoPosts.js";

function attachment(kind: Attachment["kind"], removed = false): Attachment {
  return { id: `${kind}-file`, kind, removed } as Attachment;
}

function post(
  id: string,
  attachments: Attachment[] = [],
  deletedAt: string | null = null,
): PostSummary {
  return {
    id,
    attachments,
    deletedAt,
    utileCount: 0,
    reactedByMe: false,
  } as unknown as PostSummary;
}

function feed(posts: PostSummary[]): FeedData {
  return { posts, projects: [], nextCursor: null };
}

const video = () => [attachment("video")];

describe("vidéo d'un post", () => {
  it("rend la vidéo seulement si elle est encore lisible", () => {
    expect(postVideo(post("a", video()))?.kind).toBe("video");
    expect(postVideo(post("b", [attachment("image")]))).toBeNull();
    expect(postVideo(post("c", [attachment("video", true)]))).toBeNull();
    expect(postVideo(post("d", video(), "2026-11-12T10:00:00.000Z"))).toBeNull();
    expect(postVideo(post("e"))).toBeNull();
  });
});

describe("vidéos de la vue plein écran", () => {
  it("garde l'ordre du fil qui contient le post ouvert, sans les autres posts", () => {
    const other = feed([post("x", video())]);
    const current = feed([
      post("a", video()),
      post("b"),
      post("c", video()),
      post("d", [attachment("image")]),
    ]);
    expect(videoPostsAround([other, undefined, current], "c").map((item) => item.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("ne rend rien quand aucun fil en cache ne contient le post", () => {
    expect(videoPostsAround([feed([post("a", video())])], "z")).toEqual([]);
  });
});

describe("mise à jour depuis la vue plein écran", () => {
  it("change le post dans chaque fil en cache et sur sa page", () => {
    const client = new QueryClient();
    client.setQueryData(feedQueryKey("pour-toi"), feed([post("a", video()), post("b")]));
    client.setQueryData(postQueryKey("a"), post("a", video()));
    updatePostInCaches(client, "a", { utileCount: 3, reactedByMe: true });
    const cached = client.getQueryData<FeedData>(feedQueryKey("pour-toi"))!;
    expect(cached.posts[0]).toMatchObject({ utileCount: 3, reactedByMe: true });
    expect(cached.posts[1]).toMatchObject({ utileCount: 0 });
    expect(client.getQueryData<PostSummary>(postQueryKey("a"))).toMatchObject({
      reactedByMe: true,
    });
  });
});
