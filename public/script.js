const chatContainer = document.getElementById('chat-container');

// SVG Platform Icons
const ICONS = {
  twitch: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.507 9.388.507 9.388.507s7.518 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23a7.25 7.25 0 0 0 3.97 2.65v3.9c-1.12-.13-2.23-.55-3.21-1.16-.92-.58-1.71-1.39-2.28-2.33v7.41c.02 1.34-.34 2.67-1.04 3.79a6.83 6.83 0 0 1-5.18 3.2c-1.37.13-2.77-.07-4.04-.6a6.82 6.82 0 0 1-3.64-4.83c-.34-1.33-.23-2.73.31-4a6.82 6.82 0 0 1 4.54-3.96c.72-.18 1.47-.23 2.21-.16V12.1a3.03 3.03 0 0 0-2.4 1.13c-.63.8-.93 1.83-.83 2.85.1 1.02.63 1.95 1.48 2.5a3.06 3.06 0 0 0 3.39-.02 3.03 3.03 0 0 0 1.36-2.52V0h.01Z"/></svg>`
};

// Generates a beautiful HSL pastel color based on string hashing
function getUsernameColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 90%, 72%)`;
}

// Websocket Client Setup
let socket = null;
let reconnectInterval = 3000;

function connectWS() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  console.log(`Connecting to WebSocket: ${wsUrl}`);
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('Successfully connected to WebSocket server!');
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        createChatBubble(data);
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  };

  socket.onclose = () => {
    console.log('WebSocket disconnected. Reconnecting in 3 seconds...');
    setTimeout(connectWS, reconnectInterval);
  };

  socket.onerror = (err) => {
    console.error('WebSocket error:', err);
    socket.close();
  };
}

// Render chat bubble on the screen
function createChatBubble(msg) {
  const bubble = document.createElement('div');
  bubble.className = `bubble platform-${msg.platform}`;
  
  // Decide username color
  let nameColor = msg.color;
  // If color is missing, default, or is #000000 (black on dark mode is unreadable), generate a pastel HSL color
  if (!nameColor || nameColor === '#000000' || nameColor.toLowerCase() === '#ffffff') {
    nameColor = getUsernameColor(msg.username);
  }

  // Create Avatar/Initials
  let avatarHTML = '';
  if (msg.avatar) {
    avatarHTML = `<img src="${msg.avatar}" class="avatar" alt="${msg.displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
  }
  
  // Custom letter avatar as a fallback or default
  const initial = msg.displayName ? msg.displayName.charAt(0) : msg.username.charAt(0);
  const fallbackBg = getUsernameColor(msg.username);
  const fallbackAvatarHTML = `<div class="default-avatar" style="background: ${fallbackBg}">${initial}</div>`;

  const avatarContainerHTML = `
    <div class="avatar-container">
      ${avatarHTML}
      ${fallbackAvatarHTML}
      <div class="platform-badge" title="${msg.platform}">
        ${ICONS[msg.platform]}
      </div>
    </div>
  `;

  // HTML content of the bubble
  bubble.innerHTML = `
    ${avatarContainerHTML}
    <div class="chat-content">
      <div class="user-name-wrapper">
        <span class="user-name" style="color: ${nameColor}">${msg.displayName}</span>
      </div>
      <span class="message">${escapeHTML(msg.message)}</span>
    </div>
  `;

  chatContainer.appendChild(bubble);

  // Auto-scroll chat page if needed, but since it's flex justify-content: flex-end, it stays at the bottom.
  // Ensure we don't have too many bubbles filling up the overlay and slowing OBS down
  const maxBubbles = 40;
  while (chatContainer.children.length > maxBubbles) {
    chatContainer.removeChild(chatContainer.firstChild);
  }

  // Auto delete bubble after 12 seconds with fade-out
  setTimeout(() => {
    bubble.classList.add('fade-out');
    // Wait for the css animation transition (500ms) to complete before removing from DOM
    setTimeout(() => {
      if (bubble.parentNode === chatContainer) {
        chatContainer.removeChild(bubble);
      }
    }, 500);
  }, 12000);
}

// Simple HTML escaping to prevent XSS
function escapeHTML(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Start WebSocket connection
connectWS();
