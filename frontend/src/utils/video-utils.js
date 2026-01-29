/**
 * Video URL parsing and detection utilities
 * Supports YouTube, Vimeo, and direct video URLs
 */

/**
 * Extract YouTube video ID from various URL formats
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/shorts/
 * @param {string} url
 * @returns {string|null}
 */
export function extractYouTubeId(url) {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/ // bare ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract Vimeo video ID from URL
 * Supports: vimeo.com/123456, player.vimeo.com/video/123456
 * @param {string} url
 * @returns {string|null}
 */
export function extractVimeoId(url) {
  if (!url) return null;

  const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  return match ? match[1] : null;
}

/**
 * Parse a video URL and return type, id, and embed URL
 * @param {string} url
 * @returns {{ type: 'youtube'|'vimeo'|'direct'|'unknown', id: string|null, embedUrl: string|null, originalUrl: string }}
 */
export function parseVideoUrl(url) {
  if (!url) {
    return { type: 'unknown', id: null, embedUrl: null, originalUrl: url };
  }

  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    return {
      type: 'youtube',
      id: youtubeId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      originalUrl: url
    };
  }

  const vimeoId = extractVimeoId(url);
  if (vimeoId) {
    return {
      type: 'vimeo',
      id: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      originalUrl: url
    };
  }

  // Check if it's a direct video URL (has video extension or is a blob/data URL)
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) {
    return {
      type: 'direct',
      id: null,
      embedUrl: null,
      originalUrl: url
    };
  }

  // Assume direct if it looks like a URL but no pattern matched
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return {
      type: 'direct',
      id: null,
      embedUrl: null,
      originalUrl: url
    };
  }

  return { type: 'unknown', id: null, embedUrl: null, originalUrl: url };
}

/**
 * Get thumbnail URL for a video
 * @param {'youtube'|'vimeo'|'direct'} type
 * @param {string} id
 * @returns {string|null}
 */
export function getVideoThumbnail(type, id) {
  if (!id) return null;

  if (type === 'youtube') {
    return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  }

  if (type === 'vimeo') {
    // Vimeo thumbnails require an API call, return null for now
    return null;
  }

  return null;
}

/**
 * Validate a video URL
 * @param {string} url
 * @returns {{ valid: boolean, type: string|null, message: string }}
 */
export function validateVideoUrl(url) {
  if (!url || !url.trim()) {
    return { valid: false, type: null, message: 'URL requerida' };
  }

  const trimmed = url.trim();
  const info = parseVideoUrl(trimmed);

  if (info.type === 'youtube') {
    return { valid: true, type: 'youtube', message: 'Video de YouTube detectado' };
  }

  if (info.type === 'vimeo') {
    return { valid: true, type: 'vimeo', message: 'Video de Vimeo detectado' };
  }

  if (info.type === 'direct') {
    return { valid: true, type: 'direct', message: 'URL de video directo' };
  }

  return { valid: false, type: null, message: 'URL no reconocida como video' };
}
