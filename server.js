const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Import stream SDKs
const tmi = require('tmi.js');
const { LiveChat } = require('youtube-chat');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Global state
let config = {
  twitchChannel: "",
  youtubeId: "",
  youtubeType: "channelId",
  tiktokUsername: "",
  enabledPlatforms: {
    twitch: false,
    youtube: false,
    tiktok: false
  }
};

let status = {
  twitch: 'disconnected',
  youtube: 'disconnected',
  tiktok: 'disconnected'
};

// Client references
let twitchClient = null;
let youtubeClient = null;
let tiktokClient = null;

// Load config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      config = JSON.parse(data);
      console.log('Configuration loaded:', config);
    } else {
      saveConfig();
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }

  // Override with environment variables if set (useful for cloud hosting like Render/Railway)
  if (process.env.TWITCH_CHANNEL) {
    config.twitchChannel = process.env.TWITCH_CHANNEL;
    config.enabledPlatforms.twitch = true;
  }
  if (process.env.YOUTUBE_ID) {
    config.youtubeId = process.env.YOUTUBE_ID;
    config.youtubeType = process.env.YOUTUBE_TYPE || 'channelId';
    config.enabledPlatforms.youtube = true;
  }
  if (process.env.TIKTOK_USERNAME) {
    config.tiktokUsername = process.env.TIKTOK_USERNAME;
    config.enabledPlatforms.tiktok = true;
  }
}

// Save config
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    console.log('Configuration saved.');
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Broadcast to all WebSocket clients
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Broadcast current status to all WebSockets
function broadcastStatus() {
  broadcast({
    type: 'status',
    status: status
  });
}

// Twitch Setup
function startTwitch() {
  if (twitchClient) {
    try { twitchClient.disconnect(); } catch (e) {}
    twitchClient = null;
  }

  if (!config.enabledPlatforms.twitch || !config.twitchChannel) {
    status.twitch = 'disconnected';
    broadcastStatus();
    return;
  }

  status.twitch = 'connecting';
  broadcastStatus();

  console.log(`Connecting to Twitch channel: ${config.twitchChannel}`);
  twitchClient = new tmi.Client({
    options: { debug: false },
    connection: {
      secure: true,
      reconnect: true
    },
    channels: [config.twitchChannel]
  });

  twitchClient.on('connected', (address, port) => {
    console.log(`Twitch: Connected to ${address}:${port}`);
    status.twitch = 'connected';
    broadcastStatus();
  });

  twitchClient.on('disconnected', (reason) => {
    console.log(`Twitch: Disconnected (${reason})`);
    status.twitch = 'disconnected';
    broadcastStatus();
  });

  twitchClient.on('message', (channel, tags, message, self) => {
    if (self) return;
    
    broadcast({
      type: 'message',
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

  twitchClient.connect().catch(err => {
    console.error('Twitch connection error:', err);
    status.twitch = 'error';
    broadcastStatus();
  });
}

// YouTube Setup
function startYouTube() {
  if (youtubeClient) {
    try { youtubeClient.stop(); } catch (e) {}
    youtubeClient = null;
  }

  if (!config.enabledPlatforms.youtube || !config.youtubeId) {
    status.youtube = 'disconnected';
    broadcastStatus();
    return;
  }

  status.youtube = 'connecting';
  broadcastStatus();

  console.log(`Connecting to YouTube live chat for: ${config.youtubeId} (${config.youtubeType})`);
  
  const options = config.youtubeType === 'liveId' 
    ? { liveId: config.youtubeId }
    : { channelId: config.youtubeId };

  try {
    youtubeClient = new LiveChat(options);

    youtubeClient.on('start', (liveId) => {
      console.log(`YouTube: Started scraping live chat for liveId: ${liveId}`);
      status.youtube = 'connected';
      broadcastStatus();
    });

    youtubeClient.on('end', () => {
      console.log('YouTube: Stream/chat ended.');
      status.youtube = 'disconnected';
      broadcastStatus();
    });

    youtubeClient.on('error', (err) => {
      console.error('YouTube live chat error:', err);
      status.youtube = 'error';
      broadcastStatus();
    });

    youtubeClient.on('chat', (chatItem) => {
      const messageText = chatItem.message.map(m => m.text || '').join('');
      broadcast({
        type: 'message',
        id: chatItem.id || Math.random().toString(36).substr(2, 9),
        platform: 'youtube',
        username: chatItem.author.name,
        displayName: chatItem.author.name,
        message: messageText,
        color: '#ff0000', // Default YouTube red
        avatar: chatItem.author.thumbnail ? chatItem.author.thumbnail.url : '',
        timestamp: chatItem.timestamp ? new Date(chatItem.timestamp).getTime() : Date.now()
      });
    });

    youtubeClient.start().then(started => {
      if (!started) {
        console.log('YouTube: Failed to start chat scraping (stream may not be live).');
        status.youtube = 'error';
        broadcastStatus();
      }
    }).catch(err => {
      console.error('YouTube start promise rejected:', err);
      status.youtube = 'error';
      broadcastStatus();
    });

  } catch (err) {
    console.error('YouTube client initialization failed:', err);
    status.youtube = 'error';
    broadcastStatus();
  }
}

// TikTok Setup
async function startTikTok() {
  if (tiktokClient) {
    try { tiktokClient.disconnect(); } catch (e) {}
    tiktokClient = null;
  }

  if (!config.enabledPlatforms.tiktok || !config.tiktokUsername) {
    status.tiktok = 'disconnected';
    broadcastStatus();
    return;
  }

  status.tiktok = 'connecting';
  broadcastStatus();

  console.log(`Connecting to TikTok user live stream: ${config.tiktokUsername}`);
  
  // Format username (remove @ if the user included it, since the connector handles it or expects clean string)
  let cleanUsername = config.tiktokUsername.trim();
  if (cleanUsername.startsWith('@')) {
    cleanUsername = cleanUsername.substring(1);
  }

  try {
    const { WebcastPushConnection } = await import('tiktok-live-connector');
    tiktokClient = new WebcastPushConnection(cleanUsername);

    tiktokClient.connect().then(state => {
      console.log(`TikTok: Connected to roomId: ${state.roomId}`);
      status.tiktok = 'connected';
      broadcastStatus();
    }).catch(err => {
      console.error('TikTok: Connection failed:', err.message || err);
      status.tiktok = 'error';
      broadcastStatus();
    });

    tiktokClient.on('disconnected', () => {
      console.log('TikTok: Disconnected.');
      status.tiktok = 'disconnected';
      broadcastStatus();
    });

    tiktokClient.on('error', (err) => {
      console.error('TikTok error:', err);
      status.tiktok = 'error';
      broadcastStatus();
    });

    tiktokClient.on('chat', data => {
      broadcast({
        type: 'message',
        id: data.msgId || Math.random().toString(36).substr(2, 9),
        platform: 'tiktok',
        username: data.uniqueId,
        displayName: data.nickname || data.uniqueId,
        message: data.comment,
        color: '#25f4ee', // Cyan accent
        avatar: data.profilePictureUrl || '',
        timestamp: Date.now()
      });
    });

  } catch (err) {
    console.error('TikTok client initialization failed:', err);
    status.tiktok = 'error';
    broadcastStatus();
  }
}

// Start all enabled connections
function startConnections() {
  startTwitch();
  startYouTube();
  startTikTok();
}

// Stop all active connections
function stopConnections() {
  if (twitchClient) {
    try { twitchClient.disconnect(); } catch (e) {}
    twitchClient = null;
  }
  if (youtubeClient) {
    try { youtubeClient.stop(); } catch (e) {}
    youtubeClient = null;
  }
  if (tiktokClient) {
    try { tiktokClient.disconnect(); } catch (e) {}
    tiktokClient = null;
  }
  status = {
    twitch: 'disconnected',
    youtube: 'disconnected',
    tiktok: 'disconnected'
  };
}

// Initialize
loadConfig();
startConnections();

// WebSockets logic
wss.on('connection', ws => {
  console.log('WS Client connected');
  
  // Send current configuration and connection status on connect
  ws.send(JSON.stringify({
    type: 'init',
    config: config,
    status: status
  }));

  ws.on('close', () => {
    console.log('WS Client disconnected');
  });
});

// API Routes
app.get('/api/config', (req, res) => {
  res.json(config);
});

app.post('/api/config', (req, res) => {
  const newConfig = req.body;
  
  // Merge and update
  config = {
    twitchChannel: newConfig.twitchChannel || "",
    youtubeId: newConfig.youtubeId || "",
    youtubeType: newConfig.youtubeType || "channelId",
    tiktokUsername: newConfig.tiktokUsername || "",
    enabledPlatforms: {
      twitch: !!newConfig.enabledPlatforms?.twitch,
      youtube: !!newConfig.enabledPlatforms?.youtube,
      tiktok: !!newConfig.enabledPlatforms?.tiktok
    }
  };

  saveConfig();
  
  // Restart connections
  startConnections();

  res.json({ success: true, config });
});

app.get('/api/status', (req, res) => {
  res.json(status);
});

// Start the HTTP server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`Bubble Chat Overlay Server running at:`);
  console.log(`Overlay URL : http://localhost:${PORT}/`);
  console.log(`Settings URL: http://localhost:${PORT}/settings.html`);
  console.log(`===============================================`);
});
