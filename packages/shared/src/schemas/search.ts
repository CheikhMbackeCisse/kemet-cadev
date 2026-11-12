import { z } from "zod";

export const SEARCH_QUERY_MAX_LENGTH = 60;
export const SPACE_SEARCH_LIMIT = 20;
export const PEOPLE_SEARCH_LIMIT = 10;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(SEARCH_QUERY_MAX_LENGTH),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
