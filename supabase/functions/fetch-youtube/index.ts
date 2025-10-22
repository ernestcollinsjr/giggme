import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      console.error('[fetch-youtube] YOUTUBE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'YouTube API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract video ID from various YouTube URL formats
    let videoId = '';
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname.toLowerCase().replace('www.', '');
      
      if (host === 'youtu.be') {
        videoId = urlObj.pathname.substring(1).split('?')[0];
      } else if (host.includes('youtube.com')) {
        if (urlObj.pathname === '/watch') {
          videoId = urlObj.searchParams.get('v') || '';
        } else if (urlObj.pathname.startsWith('/shorts/')) {
          videoId = urlObj.pathname.split('/')[2] || '';
        } else if (urlObj.pathname.startsWith('/embed/')) {
          videoId = urlObj.pathname.split('/')[2] || '';
        }
      }

      // If we couldn't extract a video ID, try search
      if (!videoId && urlObj.searchParams.get('search_query')) {
        const searchQuery = urlObj.searchParams.get('search_query');
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(searchQuery!)}&key=${apiKey}`;
        
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        
        if (searchData.items && searchData.items.length > 0) {
          videoId = searchData.items[0].id.videoId;
        }
      }
    } catch (e) {
      console.error('[fetch-youtube] URL parsing error:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid YouTube URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Could not extract video ID from URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch video details from YouTube API
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}&key=${apiKey}`;
    console.log('[fetch-youtube] Fetching video details for:', videoId);

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('[fetch-youtube] YouTube API error:', data);
      return new Response(
        JSON.stringify({ error: 'YouTube API error', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.items || data.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const video = data.items[0];
    const status = video.status;

    // Check if video is available
    if (!status.embeddable || status.privacyStatus === 'private') {
      return new Response(
        JSON.stringify({ 
          error: 'Video unavailable',
          reason: !status.embeddable ? 'not embeddable' : 'private video'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return video metadata
    const result = {
      videoId,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fetch-youtube] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
