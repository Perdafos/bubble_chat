import { NextResponse } from 'next/server';

async function getLiveIdFromChannel(channelId) {
  const url = `https://www.youtube.com/channel/${channelId}/live`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    next: { revalidate: 60 } // Cache channel live ID lookup for 1 minute
  });
  const html = await res.text();
  
  const match = html.match(/"videoId":"([^"]+)"/);
  if (match && match[1]) {
    return match[1];
  }
  
  const match2 = html.match(/watch\?v=([^"]+)"/);
  if (match2 && match2[1]) {
    return match2[1].split('\\')[0].split('&')[0];
  }
  
  throw new Error("Could not find active live stream for this channel.");
}

async function getLiveChatMessages(liveId) {
  const url = `https://www.youtube.com/live_chat?v=${liveId}`;
  
  // Cache-busting request
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    cache: 'no-store' // Do not cache messages so we always get the latest
  });
  const html = await res.text();
  
  // Try to parse the json variable
  const regex = /window\["ytInitialData"\]\s*=\s*({.+?});/s;
  const match = html.match(regex);
  
  if (match && match[1]) {
    return parseYtData(JSON.parse(match[1]));
  }
  
  const regex2 = /ytInitialData\s*=\s*({.+?});/s;
  const match2 = html.match(regex2);
  if (match2 && match2[1]) {
    return parseYtData(JSON.parse(match2[1]));
  }
  
  return [];
}

function parseYtData(data) {
  try {
    const actions = data?.contents?.liveChatRenderer?.actions || [];
    const messages = [];
    
    for (const action of actions) {
      const item = action.addChatItemAction?.item?.liveChatTextMessageRenderer;
      if (!item) continue;
      
      const id = item.id;
      const username = item.authorName?.simpleText || 'YouTube User';
      const avatar = item.authorPhoto?.thumbnails?.[0]?.url || '';
      const messageText = item.message?.runs?.map(run => run.text || '').join('') || '';
      const timestamp = parseInt(item.timestampUsec) / 1000 || Date.now();
      
      messages.push({
        id,
        platform: 'youtube',
        username,
        displayName: username,
        message: messageText,
        color: '#ff4e50', // YouTube Accent Color
        avatar,
        timestamp
      });
    }
    
    return messages;
  } catch (err) {
    console.error('Error parsing YouTube data:', err);
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'channelId';
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing ID parameter' }, { status: 400 });
  }

  try {
    let liveId = id;
    if (type === 'channelId') {
      liveId = await getLiveIdFromChannel(id);
    }
    
    const messages = await getLiveChatMessages(liveId);
    return NextResponse.json({ success: true, liveId, messages });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
