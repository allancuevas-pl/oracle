/**
 * Parse a hosted video URL (YouTube / Vimeo / Loom) into an embeddable form.
 * Pure — no React, no Convex. Returns { provider, embedUrl } or null when the
 * URL isn't a recognised embeddable host (caller should fall back to a link-out).
 */
export function parseVideoUrl(raw) {
  if (!raw) return null;
  const url = raw.trim();

  // YouTube: watch?v=, youtu.be/, /embed/, /shorts/
  const yt =
    url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${yt[1]}` };

  // Vimeo: vimeo.com/<digits> (optionally /<hash> for unlisted)
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/);
  if (vimeo) {
    const h = vimeo[2] ? `?h=${vimeo[2]}` : '';
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeo[1]}${h}` };
  }

  // Loom: loom.com/share/<id> or /embed/<id>
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  if (loom) return { provider: 'loom', embedUrl: `https://www.loom.com/embed/${loom[1]}` };

  return null;
}

/** True when a string looks like an http(s) URL we can store as a link video. */
export function isLikelyUrl(s) {
  return /^https?:\/\/.+\..+/i.test((s || '').trim());
}
