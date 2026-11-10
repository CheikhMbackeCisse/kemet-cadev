import { QueryClient } from "@tanstack/react-query";
import type { PostSummary } from "@kemet/shared";
import { describe, expect, it } from "vitest";
import {
  feedQueryKey,
  forgetPost,
  mergeFreshFirstPage,
  postFromFeedCache,
  postQueryKey,
  type FeedData,
} from "./feedQuery.js";

function post(id: string): PostSummary {
  return { id } as PostSummary;
}

function feed(ids: string[], nextCursor: string | null): FeedData {
  return { posts: ids.map(post), projects: [], nextCursor };
}

describe("mise à jour du fil en arrière-plan", () => {
  it("prend la page fraîche telle quelle quand rien de plus n'était chargé", () => {
    const fresh = feed(["c", "a"], "a");
    expect(mergeFreshFirstPage(fresh, feed(["a", "b"], "b"))).toBe(fresh);
    expect(mergeFreshFirstPage(fresh, undefined)).toBe(fresh);
  });

  it("garde les pages chargées ensuite, sans doublon, et leur curseur", () => {
    const merged = mergeFreshFirstPage(feed(["n", "a"], "a"), feed(["a", "b", "c", "d"], "d"));
    expect(merged.posts.map((item) => item.id)).toEqual(["n", "a", "c", "d"]);
    expect(merged.nextCursor).toBe("d");
  });

  it("retrouve un post dans n'importe quel fil déjà en cache", () => {
    const client = new QueryClient();
    client.setQueryData(feedQueryKey("abonnements", false), feed(["x", "y"], null));
    expect(postFromFeedCache(client, "y")?.id).toBe("y");
    expect(postFromFeedCache(client, "z")).toBeUndefined();
  });
});

describe("post supprimé", () => {
  it("disparaît de tous les fils en cache et sa page sera relue", () => {
    const client = new QueryClient();
    client.setQueryData(feedQueryKey("pour-toi", false), feed(["x", "y"], null));
    client.setQueryData(feedQueryKey("abonnements", false), feed(["y"], null));
    client.setQueryData(postQueryKey("y"), post("y"));
    forgetPost(client, "y");
    expect(postFromFeedCache(client, "y")).toBeUndefined();
    expect(client.getQueryData<FeedData>(feedQueryKey("pour-toi", false))?.posts).toHaveLength(1);
    expect(client.getQueryState(postQueryKey("y"))?.isInvalidated).toBe(true);
  });
});
