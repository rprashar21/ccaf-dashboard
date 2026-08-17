/**
 * Reduce a callbackUrl to a safe same-origin path.
 *
 * The proxy hands back an absolute URL, so accepting only relative paths would
 * silently drop the destination and always land on the dashboard. Anything
 * cross-origin, protocol-relative, or unparseable falls back to the dashboard
 * rather than becoming an open redirect.
 */
export function safeCallback(callbackUrl: string | undefined): string {
  if (!callbackUrl) return "/dashboard";

  // "//evil.com" is protocol-relative and would leave the origin.
  if (callbackUrl.startsWith("//")) return "/dashboard";
  if (callbackUrl.startsWith("/")) return callbackUrl;

  try {
    const url = new URL(callbackUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "/dashboard";
    return `${url.pathname}${url.search}` || "/dashboard";
  } catch {
    return "/dashboard";
  }
}
