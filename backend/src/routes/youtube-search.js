import express from 'express';
import yts from 'yt-search';

const router = express.Router();

/**
 * POST /api/youtube/search
 * Search YouTube for videos matching a query
 * No API key required - uses yt-search library
 */
router.post('/search', async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }

    const results = await yts(query.trim());

    const videos = results.videos
      .slice(0, Math.min(maxResults, 10))
      .map(v => ({
        id: v.videoId,
        title: v.title,
        url: v.url,
        thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
        duration: v.timestamp,
        durationSeconds: v.seconds,
        author: v.author?.name || '',
        views: v.views
      }));

    res.json({
      success: true,
      videos,
      totalResults: results.videos.length
    });
  } catch (error) {
    console.error('[YouTube Search] Error:', error);
    res.status(500).json({ error: 'YouTube search failed' });
  }
});

export default router;
