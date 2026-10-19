/**
 * Utility to reliably extract all URLs (markdown and bare) from text content.
 */
export function extractUrls(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const urls: Set<string> = new Set();

  // 1. Extract markdown links: [label](url)
  const markdownRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi;
  let mdMatch: RegExpExecArray | null;
  while ((mdMatch = markdownRegex.exec(text)) !== null) {
    if (mdMatch[2]) {
      urls.add(mdMatch[2].trim());
    }
  }

  // 2. Extract bare URLs (http:// or https://)
  const bareUrlRegex = /https?:\/\/[^\s<>"'()[\]]+/gi;
  let bareMatch: RegExpExecArray | null;
  while ((bareMatch = bareUrlRegex.exec(text)) !== null) {
    if (bareMatch[0]) {
      // Strip trailing punctuation like .,;:
      const cleanUrl = bareMatch[0].replace(/[.,;:!?]+$/, '').trim();
      urls.add(cleanUrl);
    }
  }

  return Array.from(urls);
}

/**
 * Safely parse a hostname from a URL string, returning lowercase hostname or null.
 */
export function extractHostname(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}
