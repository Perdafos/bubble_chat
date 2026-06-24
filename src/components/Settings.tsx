import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Link2, 
  Copy, 
  Check, 
  AlertTriangle, 
  Laptop,
  Globe
} from 'lucide-react';
import type { Status } from '../types';
import '../settings.css';

export const Settings: React.FC = () => {
  const [twitchChannel, setTwitchChannel] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [youtubeType, setYoutubeType] = useState<'channelId' | 'liveId' | 'handle'>('channelId');
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');
  
  const [twitchEnable, setTwitchEnable] = useState(true);
  const [youtubeEnable, setYoutubeEnable] = useState(false);
  const [tiktokEnable, setTiktokEnable] = useState(false);

  const [copied, setCopied] = useState(false);
  const [localStatus, setLocalStatus] = useState<Status>({
    twitch: 'disconnected',
    youtube: 'disconnected',
    tiktok: 'disconnected'
  });
  const [isServerActive, setIsServerActive] = useState(false);
  const [appUrl, setAppUrl] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  // Load configuration from localStorage and check host URL
  useEffect(() => {
    let initialServerUrl = 'http://localhost:3000';
    if (typeof window !== 'undefined') {
      setAppUrl(window.location.origin);
      
      const savedTwitch = localStorage.getItem('twitchChannel') || 'perdafos';
      const savedYoutube = localStorage.getItem('youtubeId') || '';
      const savedYoutubeType = (localStorage.getItem('youtubeType') as 'channelId' | 'liveId' | 'handle') || 'channelId';
      const savedTiktok = localStorage.getItem('tiktokUsername') || '';
      const savedServerUrl = localStorage.getItem('serverUrl') || 'http://localhost:3000';

      const savedTwitchEnable = localStorage.getItem('twitchEnable') !== 'false';
      const savedYoutubeEnable = localStorage.getItem('youtubeEnable') === 'true';
      const savedTiktokEnable = localStorage.getItem('tiktokEnable') === 'true';

      setTwitchChannel(savedTwitch);
      setYoutubeId(savedYoutube);
      setYoutubeType(savedYoutubeType);
      setTiktokUsername(savedTiktok);
      setServerUrl(savedServerUrl);
      initialServerUrl = savedServerUrl;
      
      setTwitchEnable(savedTwitchEnable);
      setYoutubeEnable(savedYoutubeEnable);
      setTiktokEnable(savedTiktokEnable);
    }

    connectWS(initialServerUrl);

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectWS = (url: string) => {
    if (typeof window === 'undefined') return;
    
    if (wsRef.current) {
      wsRef.current.close();
    }

    let wsUrl = '';
    if (url) {
      let targetUrl = url.trim();
      if (!targetUrl.startsWith('ws://') && !targetUrl.startsWith('wss://')) {
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = 'http://' + targetUrl;
        }
        targetUrl = targetUrl.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
      }
      wsUrl = targetUrl;
    } else {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      wsUrl = isLocal
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
        : 'ws://localhost:3000';
    }

    console.log(`Connecting to backend WebSocket server: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setIsServerActive(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init' || data.type === 'status') {
          setLocalStatus(data.status);
        }
      } catch (err) {
        console.error('Error parsing WS message in settings:', err);
      }
    };

    socket.onclose = () => {
      setIsServerActive(false);
      setLocalStatus({
        twitch: 'disconnected',
        youtube: 'disconnected',
        tiktok: 'disconnected'
      });
      // Reconnect in 5 seconds using the latest URL saved in localStorage
      setTimeout(() => {
        const currentSavedUrl = localStorage.getItem('serverUrl') || 'http://localhost:3000';
        connectWS(currentSavedUrl);
      }, 5000);
    };

    socket.onerror = () => {
      socket.close();
    };
  };

  // Generate the OBS Overlay link
  const generateOverlayUrl = () => {
    if (!appUrl) return '';
    const params: string[] = [];
    
    if (twitchEnable && twitchChannel) params.push(`twitch=${encodeURIComponent(twitchChannel)}`);
    if (youtubeEnable && youtubeId) {
      params.push(`youtube=${encodeURIComponent(youtubeId)}`);
      params.push(`youtubeType=${encodeURIComponent(youtubeType)}`);
    }
    if (tiktokEnable && tiktokUsername) params.push(`tiktok=${encodeURIComponent(tiktokUsername)}`);
    
    if (serverUrl) {
      params.push(`server=${encodeURIComponent(serverUrl)}`);
    } else if (!isServerActive) {
      params.push('local=false');
    }

    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return `${appUrl}/${queryString}`;
  };

  // Helper to extract YouTube ID and Type from any YouTube URL format
  const extractYoutubeId = (input: string) => {
    const cleanInput = input.trim();
    
    const videoIdRegexes = [
      /youtube\.com\/watch\?v=([^&\s]+)/i,
      /youtube\.com\/live\/([^?\s]+)/i,
      /youtu\.be\/([^?\s]+)/i,
      /studio\.youtube\.com\/video\/([^/\s]+)/i,
      /youtube\.com\/live_chat\?v=([^&\s]+)/i,
      /v=([^&\s]+)/i
    ];
    
    for (const regex of videoIdRegexes) {
      const match = cleanInput.match(regex);
      if (match && match[1]) {
        return { id: match[1], type: 'liveId' as const };
      }
    }
    
    const channelIdRegex = /youtube\.com\/channel\/(UC[^/\s?]+)/i;
    const channelMatch = cleanInput.match(channelIdRegex);
    if (channelMatch && channelMatch[1]) {
      return { id: channelMatch[1], type: 'channelId' as const };
    }
    
    const handleRegex = /youtube\.com\/@([^/\s?]+)/i;
    const handleMatch = cleanInput.match(handleRegex);
    if (handleMatch && handleMatch[1]) {
      return { id: '@' + handleMatch[1], type: 'handle' as const };
    }
    
    if (cleanInput.startsWith('UC')) {
      return { id: cleanInput, type: 'channelId' as const };
    }
    
    if (cleanInput.startsWith('@')) {
      return { id: cleanInput, type: 'handle' as const };
    }
    
    return { id: cleanInput, type: 'liveId' as const };
  };

  const handleYoutubeIdChange = (val: string) => {
    setYoutubeId(val);
    
    const isUrl = val.includes('youtube.com') || val.includes('youtu.be') || val.includes('studio.youtube.com');
    const isIdOrHandle = val.startsWith('@') || val.startsWith('UC') || val.includes('v=');
    
    if (isUrl || isIdOrHandle) {
      const parsed = extractYoutubeId(val);
      if (parsed.id) {
        setYoutubeId(parsed.id);
        setYoutubeType(parsed.type);
      }
    }
  };

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalId = youtubeId.trim();
    let finalType = youtubeType;

    // Double check parse on save
    if (youtubeId.includes('youtube.com') || youtubeId.includes('youtu.be') || youtubeId.includes('studio.youtube.com') || youtubeId.includes('v=')) {
      const parsed = extractYoutubeId(youtubeId);
      finalId = parsed.id;
      finalType = parsed.type;
      setYoutubeId(parsed.id);
      setYoutubeType(parsed.type);
    }
    
    localStorage.setItem('twitchChannel', twitchChannel);
    localStorage.setItem('youtubeId', finalId);
    localStorage.setItem('youtubeType', finalType);
    localStorage.setItem('tiktokUsername', tiktokUsername);
    localStorage.setItem('serverUrl', serverUrl);
    
    localStorage.setItem('twitchEnable', twitchEnable ? 'true' : 'false');
    localStorage.setItem('youtubeEnable', youtubeEnable ? 'true' : 'false');
    localStorage.setItem('tiktokEnable', tiktokEnable ? 'true' : 'false');

    // Save to server config
    try {
      let configUrl = serverUrl.trim();
      if (!configUrl.startsWith('http://') && !configUrl.startsWith('https://')) {
        configUrl = 'http://' + configUrl;
      }
      if (configUrl.endsWith('/')) {
        configUrl = configUrl.slice(0, -1);
      }
      configUrl = `${configUrl}/api/config`;

      console.log(`Saving config to server: ${configUrl}`);
      const response = await fetch(configUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitchChannel,
          youtubeId: finalId,
          youtubeType: finalType,
          tiktokUsername,
          enabledPlatforms: {
            twitch: twitchEnable,
            youtube: youtubeEnable,
            tiktok: tiktokEnable
          }
        })
      });
      if (response.ok) {
        console.log('Saved settings to server successfully!');
      } else {
        console.warn('Server returned error status when saving config:', response.status);
      }
    } catch (err) {
      console.warn('Failed to save to config endpoint on server. Server might be offline or unreachable.', err);
    }

    // Connect to the new WS server
    connectWS(serverUrl);

    setCopied(false);
    alert('Pengaturan disimpan!');
  };

  const copyToClipboard = () => {
    const url = generateOverlayUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const getStatusBadgeClass = (state: string, enabled: boolean) => {
    if (!enabled) return 'status-disconnected';
    if (state === 'connected') return 'status-connected';
    if (state === 'connecting') return 'status-connecting';
    if (state === 'error') return 'status-error';
    return 'status-disconnected';
  };

  const getStatusText = (state: string, enabled: boolean) => {
    if (!enabled) return 'NONAKTIF';
    if (state === 'connected') return 'TERHUBUNG';
    if (state === 'connecting') return 'MENGHUBUNGKAN';
    if (state === 'error') return 'ERROR / OFFLINE';
    return 'OFFLINE';
  };

  const isLocalServer = serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1');

  return (
    <div className="settings-wrapper">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <SettingsIcon size={28} style={{ color: 'var(--twitch-color)' }} />
          <h1 style={{ margin: 0 }}>Bubble Chat Dashboard</h1>
        </div>
        <p>Konfigurasi live stream chat Twitch, YouTube, dan TikTok (React + TS)</p>
      </header>

      {/* Dynamic Alert based on Server Connectivity & URL Type */}
      {isServerActive ? (
        isLocalServer ? (
          <div className="info-alert">
            <Laptop className="alert-icon" size={20} />
            <div className="alert-content">
              <h4>Mode Server Lokal Aktif 💻</h4>
              <p>
                Server Node.js berjalan di komputer Anda (`{serverUrl}`). Modul integrasi Twitch, YouTube, dan TikTok berjalan penuh secara real-time.
              </p>
            </div>
          </div>
        ) : (
          <div className="info-alert" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }}>
            <Globe className="alert-icon" size={20} style={{ color: 'var(--success-color)' }} />
            <div className="alert-content">
              <h4 style={{ color: 'var(--success-color)' }}>Mode Server Online Aktif 🌐</h4>
              <p>
                Terhubung ke server cloud di `{serverUrl}`! Modul integrasi Twitch, YouTube, dan TikTok berjalan secara online tanpa membebani laptop Anda.
              </p>
            </div>
          </div>
        )
      ) : (
        isLocalServer ? (
          <div className="info-alert warning">
            <AlertTriangle className="alert-icon" size={20} />
            <div className="alert-content">
              <h4>Server Lokal Offline / Standalone Aktif ⚠️</h4>
              <p>
                Gagal terhubung ke server lokal di `{serverUrl}`. Jika Anda ingin mengambil chat YouTube & TikTok, silakan jalankan server lokal Anda (`start_chat.bat`). Chat Twitch tetap berfungsi langsung di browser.
              </p>
            </div>
          </div>
        ) : (
          <div className="info-alert warning">
            <AlertTriangle className="alert-icon" size={20} />
            <div className="alert-content">
              <h4>Server Online Offline / Standalone Aktif ⚠️</h4>
              <p>
                Gagal terhubung ke server online di `{serverUrl}`. Pastikan server cloud Anda sudah dideploy dan sedang berjalan. Chat Twitch tetap berfungsi langsung di browser.
              </p>
            </div>
          </div>
        )
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="cards-grid">
          
          {/* SERVER CONNECTION CARD */}
          <div className="card server-card">
            <div className="card-header">
              <div className="platform-title" style={{ color: 'var(--info-color)' }}>
                Koneksi Server
              </div>
              <span className={`status-badge ${isServerActive ? 'status-connected' : 'status-disconnected'}`}>
                {isServerActive ? 'TERHUBUNG' : 'OFFLINE'}
              </span>
            </div>
            
            <div className="form-group">
              <label>URL Server Backend (Node.js)</label>
              <input 
                type="text" 
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="contoh: https://bubble-chat-backend.onrender.com atau http://localhost:3000" 
              />
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Gunakan URL cloud (seperti Render/Railway) untuk menjalankan chat online penuh tanpa membebani laptop lokal. Biarkan default (`http://localhost:3000`) jika menjalankan server lokal.
              </p>
            </div>
          </div>

          {/* TWITCH CARD */}
          <div className="card twitch-card">
            <div className="card-header">
              <div className="platform-title">
                Twitch
              </div>
              <span className={`status-badge ${getStatusBadgeClass(localStatus.twitch, twitchEnable)}`}>
                {getStatusText(localStatus.twitch, twitchEnable)}
              </span>
            </div>
            
            <div className="toggle-container">
              <span className="toggle-label">Aktifkan Twitch Chat</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={twitchEnable}
                  onChange={(e) => setTwitchEnable(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="form-group">
              <label>Twitch Username</label>
              <input 
                type="text" 
                value={twitchChannel}
                onChange={(e) => setTwitchChannel(e.target.value)}
                placeholder="contoh: perdafos" 
                disabled={!twitchEnable}
              />
            </div>
          </div>

          {/* YOUTUBE CARD */}
          <div className="card youtube-card">
            <div className="card-header">
              <div className="platform-title">
                YouTube
              </div>
              <span className={`status-badge ${getStatusBadgeClass(localStatus.youtube, youtubeEnable)}`}>
                {getStatusText(localStatus.youtube, youtubeEnable)}
              </span>
            </div>

            <div className="toggle-container">
              <span className="toggle-label">Aktifkan YouTube Chat</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={youtubeEnable}
                  onChange={(e) => setYoutubeEnable(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="form-group">
              <label>Metode Hubung</label>
              <select 
                value={youtubeType}
                onChange={(e) => setYoutubeType(e.target.value as 'channelId' | 'liveId' | 'handle')}
                disabled={!youtubeEnable}
              >
                <option value="channelId">Channel ID (Deteksi Live Otomatis)</option>
                <option value="liveId">Live Video ID (v=XXXXXX)</option>
                <option value="handle">Handle / @Username</option>
              </select>
            </div>

            <div className="form-group">
              <label>Link URL YouTube / ID</label>
              <input 
                type="text" 
                value={youtubeId}
                onChange={(e) => handleYoutubeIdChange(e.target.value)}
                placeholder="Tempel link Live Stream, link Channel, Handle @, atau ID" 
                disabled={!youtubeEnable}
              />
            </div>
          </div>

          {/* TIKTOK CARD */}
          <div className="card tiktok-card">
            <div className="card-header">
              <div className="platform-title">
                TikTok
              </div>
              <span className={`status-badge ${getStatusBadgeClass(localStatus.tiktok, tiktokEnable)}`}>
                {getStatusText(localStatus.tiktok, tiktokEnable)}
              </span>
            </div>

            <div className="toggle-container">
              <span className="toggle-label">Aktifkan TikTok Chat</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={tiktokEnable}
                  onChange={(e) => setTiktokEnable(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="form-group">
              <label>TikTok Username</label>
              <input 
                type="text" 
                value={tiktokUsername}
                onChange={(e) => setTiktokUsername(e.target.value)}
                placeholder="@username_live" 
                disabled={!tiktokEnable}
              />
            </div>
          </div>

        </div>

        <div className="action-card">
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link2 size={20} style={{ color: 'var(--tiktok-color)' }} />
            Link Browser Source untuk OBS Studio
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
            Copy link di bawah ini dan tempelkan sebagai **Browser Source** baru di OBS Studio. Link ini menyimpan konfigurasi secara otomatis di parameter URL!
          </p>
          
          <div className="obs-link-box">
            <div className="obs-url-input">
              {generateOverlayUrl()}
            </div>
            <button 
              type="button" 
              className={`btn-copy ${copied ? 'success' : ''}`}
              onClick={copyToClipboard}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <button type="submit" className="btn-save">
            Simpan & Terapkan Pengaturan
          </button>
        </div>
      </form>
    </div>
  );
};
