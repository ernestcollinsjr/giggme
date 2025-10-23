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

    // Extract video ID from various YouTube URL formats
    let videoId = '';
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname.toLowerCase().replace('www.', '');
      
      console.log('[fetch-youtube] Parsing URL:', { url, host, pathname: urlObj.pathname });
      
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

    console.log('[fetch-youtube] Scraping video page for:', videoId);

    // Scrape the YouTube page to get video metadata
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!pageResponse.ok) {
      console.error('[fetch-youtube] Failed to fetch YouTube page:', pageResponse.status);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch video page' }),
        { status: pageResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await pageResponse.text();
    
    // Extract title from various possible meta tags
    let title = '';
    let channelTitle = '';
    
    // Try to extract from og:title meta tag
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    if (titleMatch) {
      title = titleMatch[1];
    }
    
    // Try to extract channel name from various sources
    const channelMatch = html.match(/<link itemprop="name" content="([^"]+)"/);
    if (channelMatch) {
      channelTitle = channelMatch[1];
    } else {
      // Alternative: try to get from author meta tag
      const authorMatch = html.match(/<link itemprop="url" href="[^"]*">\s*<meta itemprop="name" content="([^"]+)"/);
      if (authorMatch) {
        channelTitle = authorMatch[1];
      }
    }
    
    // If we couldn't find the data through meta tags, try JSON-LD
    if (!title || !channelTitle) {
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">({[^<]+})<\/script>/);
      if (jsonLdMatch) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1]);
          if (!title && jsonLd.name) {
            title = jsonLd.name;
          }
          if (!channelTitle && jsonLd.author) {
            channelTitle = jsonLd.author;
          }
        } catch (e) {
          console.log('[fetch-youtube] Failed to parse JSON-LD:', e);
        }
      }
    }

    if (!title) {
      return new Response(
        JSON.stringify({ error: 'Could not extract video title' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fetch-youtube] Successfully scraped:', { title, channelTitle });

    // Return video metadata
    const result = {
      videoId,
      title: title,
      channelTitle: channelTitle || 'Unknown Channel',
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
