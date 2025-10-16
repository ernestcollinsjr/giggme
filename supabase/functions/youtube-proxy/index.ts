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
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    
    if (!YOUTUBE_API_KEY) {
      throw new Error('YouTube API key not configured');
    }

    console.log('Processing YouTube URL:', url);

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
      
      videoId = videoId.split('&')[0].split('?')[0];
    } catch (error) {
      console.error('Error parsing URL:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid YouTube URL',
          originalUrl: url,
          canonicalUrl: url 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!videoId || videoId.length < 10) {
      // Attempt to resolve from YouTube search URLs like /results?search_query=...
      try {
        const urlObj = new URL(url);
        const q = urlObj.searchParams.get('search_query') || urlObj.searchParams.get('q');
        if (q) {
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(q)}&key=${YOUTUBE_API_KEY}`;
          console.log('Searching YouTube API for query:', q);
          const sRes = await fetch(searchUrl);
          if (!sRes.ok) {
            console.error('YouTube Search API error:', sRes.status, await sRes.text());
            throw new Error(`YouTube Search API error: ${sRes.status}`);
          }
          const sData = await sRes.json();
          if (sData.items && sData.items.length > 0 && sData.items[0].id && sData.items[0].id.videoId) {
            videoId = sData.items[0].id.videoId;
            console.log('Resolved search to videoId:', videoId);
          }
        }
      } catch (e) {
        console.error('Search resolution failed:', e);
      }

      if (!videoId || videoId.length < 10) {
        console.log('Could not extract video ID, returning original URL');
        return new Response(
          JSON.stringify({ 
            error: 'Could not extract video ID',
            originalUrl: url,
            canonicalUrl: url 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Fetch video metadata from YouTube API
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,status`;
    
    console.log('Fetching from YouTube API:', apiUrl);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error('YouTube API error:', response.status, await response.text());
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.log('Video not found or unavailable');
      return new Response(
        JSON.stringify({ 
          error: 'Video not found or unavailable',
          originalUrl: url,
          canonicalUrl: url 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const video = data.items[0];
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    console.log('Video found:', video.snippet.title);

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        originalUrl: url,
        canonicalUrl,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
        available: video.status.uploadStatus === 'processed'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('YouTube proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        originalUrl: null,
        canonicalUrl: null 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});