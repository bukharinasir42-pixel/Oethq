/** Strip HTML tags for plain-text previews (SSR-safe). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isHtmlEmpty(html: string): boolean {
  return stripHtml(html).length === 0;
}
