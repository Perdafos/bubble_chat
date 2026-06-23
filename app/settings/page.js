'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import './settings.css';
import { 
  Settings, 
  Link2, 
  Copy, 
  Check, 
  AlertTriangle, 
  Info, 
  Tv, 
  ExternalLink,
  Laptop,
  HelpCircle
} from 'lucide-react';

function SettingsContent() {
  const [twitchChannel, setTwitchChannel] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [youtubeType, setYoutubeType] = useState('channelId');
  const [tiktokUsername, setTiktokUsername] = useState('');
  
  const [twitchEnable, setTwitchEnable] = useState(true);
  const [youtubeEnable, setYoutubeEnable] = useState(false);
  const [tiktokEnable, setTiktokEnable] = useState(false);

  const [copied, setCopied] = useState(false);
  const [localStatus, setLocalStatus] = useState({
    twitch: 'disconnected',
    youtube: 'disconnected',
    tiktok: 'disconnected'
  });
  const [isServerActive, setIsServerActive] = useState(false);
  const [appUrl, setAppUrl] = useState('');
  const wsRef = useRef(null);

  // Load configuration from localStorage and determine host URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppUrl(window.location.origin);
      
      const savedTwitch = localStorage.getItem('twitchChannel') || 'perdafos';
      const savedYoutube = localStorage.getItem('youtubeId') || '';
      const savedYoutubeType = localStorage.getItem('youtubeType') || 'channelId';
      const savedTiktok = localStorage.getItem('tiktokUsername') || '';

      const savedTwitchEnable = localStorage.getItem('twitchEnable') !== 'false';
      const savedYoutubeEnable = localStorage.getItem('youtubeEnable') === 'true';
      const savedTiktokEnable = localStorage.getItem('tiktokEnable') === 'true';

      setTwitchChannel(savedTwitch);
      setYoutubeId(savedYoutube);
      setYoutubeType(savedYoutubeType);
      setTiktokUsername(savedTiktok);
      
      setTwitchEnable(savedTwitchEnable);
      setYoutubeEnable(savedYoutubeEnable);
      setTiktokEnable(savedTiktokEnable);
    }

    // Connect to WebSocket to check if local server is running
    connectLocalWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectLocalWS = () => {
    if (typeof window === 'undefined') return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3000';
    const wsUrl = `${protocol}//${host}`;

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
      // Try to reconnect in 5 seconds
      setTimeout(connectLocalWS, 5000);
    };

    socket.onerror = () => {
      socket.close();
    };
  };

  // Generate the OBS Overlay link based on options
  const generateOverlayUrl = () => {
    if (!appUrl) return '';
    const params = [];
    
    if (twitchEnable && twitchChannel) params.push(`twitch=${encodeURIComponent(twitchChannel)}`);
    if (youtubeEnable && youtubeId) {
      params.push(`youtube=${encodeURIComponent(youtubeId)}`);
      params.push(`youtubeType=${encodeURIComponent(youtubeType)}`);
    }
    if (tiktokEnable && tiktokUsername) params.push(`tiktok=${encodeURIComponent(tiktokUsername)}`);
    
    // If not running on local server, tell client it is in standalone mode
    if (!isServerActive) {
      params.push('local=false');
    }

    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return `${appUrl}/${queryString}`;
  };

  // Handle Save
  const handleSave = async (e) => {
    e.preventDefault();
    
    // Save to local storage for persistence in browser
    localStorage.setItem('twitchChannel', twitchChannel);
    localStorage.setItem('youtubeId', youtubeId);
    localStorage.setItem('youtubeType', youtubeType);
    localStorage.setItem('tiktokUsername', tiktokUsername);
    
    localStorage.setItem('twitchEnable', twitchEnable);
    localStorage.setItem('youtubeEnable', youtubeEnable);
    localStorage.setItem('tiktokEnable', tiktokEnable);

    // Save to local server config if active
    if (isServerActive) {
      try {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            twitchChannel,
            youtubeId,
            youtubeType,
            tiktokUsername,
            enabledPlatforms: {
              twitch: twitchEnable,
              youtube: youtubeEnable,
              tiktok: tiktokEnable
            }
          })
        });
      } catch (err) {
        console.warn('Failed to save to local config endpoint (running serverless).');
      }
    }

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

  const getStatusBadgeClass = (state, enabled) => {
    if (!enabled) return 'status-disconnected';
    if (state === 'connected') return 'status-connected';
    if (state === 'connecting') return 'status-connecting';
    if (state === 'error') return 'status-error';
    return 'status-disconnected';
  };

  const getStatusText = (state, enabled) => {
    if (!enabled) return 'NONAKTIF';
    if (state === 'connected') return 'TERHUBUNG';
    if (state === 'connecting') return 'MENGHUBUNGKAN';
    if (state === 'error') return 'ERROR / OFFLINE';
    return 'OFFLINE';
  };

  return (
    <div className="settings-container">



      <div className="settings-wrapper">
        <header>
          <h1>Next.js Bubble Chat Dashboard</h1>
          <p>Konfigurasi live stream chat Twitch, YouTube, dan TikTok</p>
        </header>

        {/* Dynamic Warning Alert about local server status */}
        {isServerActive ? (
          <div className="info-alert">
            <Laptop className="alert-icon" size={20} />
            <div className="alert-content">
              <h4>Mode Server Lokal Aktif 💻</h4>
              <p>
                Server Node.js berjalan di komputer Anda. Modul integrasi Twitch, YouTube, dan TikTok berjalan penuh dengan WebSocket berkecepatan tinggi secara real-time.
              </p>
            </div>
          </div>
        ) : (
          <div className="info-alert warning">
            <AlertTriangle className="alert-icon" size={20} />
            <div className="alert-content">
              <h4>Mode Standalone Serverless Aktif 🌐</h4>
              <p>
                Anda menjalankan overlay secara serverless (misalnya di Vercel). Chat Twitch terhubung langsung di browser, dan YouTube terhubung via HTTP Polling. **Catatan: TikTok chat membutuhkan server lokal aktif di PC Anda.**
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="cards-grid">
            
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
                  onChange={(e) => setYoutubeType(e.target.value)}
                  disabled={!youtubeEnable}
                >
                  <option value="channelId">Channel ID (Deteksi Live Otomatis)</option>
                  <option value="liveId">Live Video ID (v=XXXXXX)</option>
                </select>
              </div>

              <div className="form-group">
                <label>YouTube ID</label>
                <input 
                  type="text" 
                  value={youtubeId}
                  onChange={(e) => setYoutubeId(e.target.value)}
                  placeholder="ID channel atau ID Video Live" 
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
                    disabled={!isServerActive} // TikTok requires server active
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div className="form-group">
                <label>TikTok Username {!isServerActive && "(Butuh Server Lokal)"}</label>
                <input 
                  type="text" 
                  value={tiktokUsername}
                  onChange={(e) => setTiktokUsername(e.target.value)}
                  placeholder="@username_live" 
                  disabled={!tiktokEnable || !isServerActive}
                />
              </div>
            </div>

          </div>

          <div className="action-card">
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Link Browser Source untuk OBS Studio</h3>
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
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading dashboard...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
