'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

// SVG Platform Icons
const ICONS = {
  twitch: (
    <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.507 9.388.507 9.388.507s7.518 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23a7.25 7.25 0 0 0 3.97 2.65v3.9c-1.12-.13-2.23-.55-3.21-1.16-.92-.58-1.71-1.39-2.28-2.33v7.41c.02 1.34-.34 2.67-1.04 3.79a6.83 6.83 0 0 1-5.18 3.2c-1.37.13-2.77-.07-4.04-.6a6.82 6.82 0 0 1-3.64-4.83c-.34-1.33-.23-2.73.31-4a6.82 6.82 0 0 1 4.54-3.96c.72-.18 1.47-.23 2.21-.16V12.1a3.03 3.03 0 0 0-2.4 1.13c-.63.8-.93 1.83-.83 2.85.1 1.02.63 1.95 1.48 2.5a3.06 3.06 0 0 0 3.39-.02 3.03 3.03 0 0 0 1.36-2.52V0h.01Z" />
    </svg>
  )
};

// Username HSL pastel color generator
function getUsernameColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 90%, 72%)`;
}

function OverlayContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState([]);
  
  // Ref to track seen message IDs to avoid duplicates in polling
  const seenIdsRef = useRef(new Set());
  const isFirstYtFetchRef = useRef(true);
  const tmiClientRef = useRef(null);
  const wsRef = useRef(null);

  // Parse configurations from query parameters
  const twitchChannel = searchParams.get('twitch') || '';
  const youtubeId = searchParams.get('youtube') || '';
  const youtubeType = searchParams.get('youtubeType') || 'channelId';
  const tiktokUsername = searchParams.get('tiktok') || '';
  
  // Decide whether to try local WebSocket connection first (default is true unless offline specified)
  const isLocalMode = searchParams.get('local') !== 'false';

  // Helper to add message with a self-destruct timer
  const addMessage = (msg) => {
    if (seenIdsRef.current.has(msg.id)) return;
    seenIdsRef.current.add(msg.id);

    const messageId = msg.id;
    
    // Append message to state
    setMessages((prev) => {
      const updated = [...prev, { ...msg, exiting: false }];
      if (updated.length > 40) updated.shift();
      return updated;
    });

    // Start transition timer (fade out after 11.5 seconds)
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, exiting: true } : m))
      );
      
      // Remove from DOM after another 500ms (exit transition finished)
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }, 500);
    }, 11500);
  };

  useEffect(() => {
    // Show welcome bubble info
    addMessage({
      id: 'sys-welcome',
      platform: 'twitch',
      username: 'system',
      displayName: 'System',
      message: 'Bubble Chat Overlay Aktif! Menghubungkan ke streams...',
      color: '#10b981',
      avatar: '',
      timestamp: Date.now()
    });

    let activeTwitch = twitchChannel;
    let activeYoutube = youtubeId;
    let activeYoutubeType = youtubeType;

    // --- MODE 1: LOCAL WEBSOCKET CONNECTION ---
    if (isLocalMode) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Fallback to localhost if host is not available (e.g. in file system or Vercel static)
      const host = window.location.host || 'localhost:3000';
      const wsUrl = `${protocol}//${host}`;

      console.log(`Trying Local WebSocket server: ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('Connected to local backend server! Using server-managed feeds.');
        addMessage({
          id: 'sys-ws-connected',
          platform: 'twitch',
          username: 'system',
          displayName: 'System',
          message: 'Terhubung ke server lokal! Mode multi-stream aktif.',
          color: '#10b981',
          avatar: '',
          timestamp: Date.now()
        });
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'init') {
            // If connected to local backend, we can override query params with server configs if local settings are saved
            if (data.config) {
              console.log('Received server config:', data.config);
            }
          } else if (data.type === 'message') {
            addMessage(data);
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      socket.onclose = () => {
        console.log('Local WebSocket server offline. Falling back to Standalone Mode (Browser-Direct).');
        addMessage({
          id: 'sys-ws-offline',
          platform: 'youtube',
          username: 'system',
          displayName: 'System',
          message: 'Server lokal offline. Menggunakan koneksi browser langsung (Twitch & YouTube saja).',
          color: '#f59e0b',
          avatar: '',
          timestamp: Date.now()
        });
        
        // Start standalone fallbacks
        startStandaloneTwitch(activeTwitch);
        startStandaloneYouTube(activeYoutube, activeYoutubeType);
      };

      socket.onerror = () => {
        socket.close();
      };
    } else {
      // --- MODE 2: STANDALONE MODE DIRECTLY ---
      console.log('Standalone mode forced. Connecting directly from browser.');
      startStandaloneTwitch(activeTwitch);
      startStandaloneYouTube(activeYoutube, activeYoutubeType);
    }

    // CLEANUP ON UNMOUNT
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (tmiClientRef.current) {
        try { tmiClientRef.current.disconnect(); } catch (e) {}
      }
    };
  }, [twitchChannel, youtubeId, youtubeType, isLocalMode]);

  // Twitch Client-side connection helper
  const startStandaloneTwitch = (channel) => {
    if (!channel) return;
    console.log(`Connecting directly to Twitch chat: ${channel}`);

    // Import tmi.js dynamically client-side to prevent Next.js SSR errors
    import('tmi.js').then((tmi) => {
      const client = new tmi.Client({
        options: { debug: false },
        connection: { secure: true, reconnect: true },
        channels: [channel]
      });

      tmiClientRef.current = client;

      client.on('message', (chan, tags, message, self) => {
        if (self) return;
        addMessage({
          id: tags.id || Math.random().toString(36).substr(2, 9),
          platform: 'twitch',
          username: tags.username,
          displayName: tags['display-name'] || tags.username,
          message: message,
          color: tags.color || '#a970ff',
          avatar: '',
          timestamp: Date.now()
        });
      });

      client.connect().catch((err) => {
        console.error('Twitch direct connection failed:', err);
      });
    });
  };

  // YouTube Client-side polling helper
  const startStandaloneYouTube = (ytId, ytType) => {
    if (!ytId) return;
    console.log(`Starting standalone YouTube chat polling for ID: ${ytId} (${ytType})`);

    const pollYouTube = async () => {
      try {
        const res = await fetch(`/api/youtube?type=${ytType}&id=${ytId}`);
        const data = await res.json();
        
        if (data.success && data.messages) {
          if (isFirstYtFetchRef.current) {
            // First fetch: just populate seen list so we don't spam historical chat
            data.messages.forEach(msg => seenIdsRef.current.add(msg.id));
            isFirstYtFetchRef.current = false;
            console.log(`Initial YouTube poll: loaded ${data.messages.length} historical messages.`);
          } else {
            // Subsequent fetches: display new incoming messages
            data.messages.forEach(msg => addMessage(msg));
          }
        }
      } catch (err) {
        console.error('YouTube poll error:', err);
      }
    };

    // Initial fetch
    pollYouTube();

    // Poll YouTube every 4 seconds
    const interval = setInterval(pollYouTube, 4000);
    return () => clearInterval(interval);
  };

  return (
    <div id="chat-container">
      {messages.map((msg) => {
        let nameColor = msg.color;
        if (!nameColor || nameColor === '#000000' || nameColor.toLowerCase() === '#ffffff') {
          nameColor = getUsernameColor(msg.username);
        }

        const initial = msg.displayName ? msg.displayName.charAt(0) : msg.username.charAt(0);
        const fallbackBg = getUsernameColor(msg.username);

        return (
          <div
            key={msg.id}
            className={`bubble platform-${msg.platform} ${msg.exiting ? 'fade-out' : ''}`}
          >
            <div className="avatar-container">
              {msg.avatar ? (
                <img
                  src={msg.avatar}
                  className="avatar"
                  alt={msg.displayName}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="default-avatar"
                style={{
                  background: fallbackBg,
                  display: msg.avatar ? 'none' : 'flex'
                }}
              >
                {initial}
              </div>
              <div className="platform-badge" title={msg.platform}>
                {ICONS[msg.platform]}
              </div>
            </div>
            <div className="chat-content">
              <div className="user-name-wrapper">
                <span className="user-name" style={{ color: nameColor }}>
                  {msg.displayName}
                </span>
              </div>
              <span className="message">{msg.message}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OverlayContent />
    </Suspense>
  );
}
