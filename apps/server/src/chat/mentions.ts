const MENTION_PATTERN = /@([a-z0-9][a-z0-9-]{1,29})/g;

export function extractMentionHandles(body: string): string[] {
  const handles = new Set<string>();
  for (const match of body.matchAll(MENTION_PATTERN)) {
    handles.add(match[1]!);
  }
  return Array.from(handles);
}
