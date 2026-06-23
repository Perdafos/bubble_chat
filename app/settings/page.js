'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
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
      <style jsx global>{`
        :root {
          --bg-color: #0d0e12;
          --card-bg: #16181f;
          --text-color: #f3f4f6;
          --text-muted: #9ca3af;
          --border-color: #272a37;
          
          --twitch-color: #a970ff;
          --youtube-color: #ff4e50;
          --tiktok-color: #25f4ee;
          
          --success-color: #10b981;
          --warning-color: #f59e0b;
          --danger-color: #ef4444;
          --info-color: #3b82f6;
        }

        body {
          background-color: var(--bg-color);
          color: var(--text-color);
          margin: 0;
          padding: 0;
          font-family: var(--font-outfit), sans-serif;
        }

        .settings-wrapper {
          max-width: 1000px;
          margin: 0 auto;
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .settings-container {
          width: 100%;
        }

        header {
          text-align: center;
          margin-bottom: 12px;
        }

        header h1 {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #a970ff, #25f4ee, #fe2c55);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 6px;
        }

        header p {
          color: var(--text-muted);
          font-size: 16px;
        }

        /* Alert Panel */
        .info-alert {
          background-color: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          color: #e5e7eb;
          font-size: 14px;
          line-height: 1.5;
        }

        .info-alert.warning {
          background-color: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.2);
        }

        .alert-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .info-alert.warning .alert-icon { color: var(--warning-color); }
        .info-alert .alert-icon { color: var(--info-color); }

        .alert-content h4 {
          font-weight: 600;
          margin-bottom: 4px;
          font-size: 15px;
        }

        .alert-content p {
          color: var(--text-muted);
          margin: 0;
        }

        /* Form cards */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 10px;
        }

        .card {
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          transition: transform 0.2s ease, border-color 0.2s ease;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        }

        .card:hover {
          transform: translateY(-2px);
        }

        .card.twitch-card { border-top: 4px solid var(--twitch-color); }
        .card.youtube-card { border-top: 4px solid var(--youtube-color); }
        .card.tiktok-card { border-top: 4px solid var(--tiktok-color); }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 12px;
        }

        .platform-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 600;
        }

        .twitch-card .platform-title { color: var(--twitch-color); }
        .youtube-card .platform-title { color: var(--youtube-color); }
        .tiktok-card .platform-title { color: var(--tiktok-color); }

        /* Status Badge */
        .status-badge {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          padding: 4px 8px;
          border-radius: 20px;
          letter-spacing: 0.5px;
        }

        .status-disconnected {
          background-color: rgba(156, 163, 175, 0.15);
          color: var(--text-muted);
        }
        .status-connecting {
          background-color: rgba(245, 158, 11, 0.15);
          color: var(--warning-color);
          animation: pulse 1.5s infinite;
        }
        .status-connected {
          background-color: rgba(16, 185, 129, 0.15);
          color: var(--success-color);
        }
        .status-error {
          background-color: rgba(239, 68, 68, 0.15);
          color: var(--danger-color);
        }

        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }

        /* Toggle Container */
        .toggle-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: rgba(255,255,255,0.02);
          padding: 12px 14px;
          border-radius: 8px;
          border: 1px dashed var(--border-color);
        }

        .toggle-label {
          font-weight: 500;
          font-size: 14px;
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #272a37;
          transition: .3s;
          border-radius: 24px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: var(--success-color);
        }

        input:checked + .slider:before {
          transform: translateX(24px);
        }

        /* Form Inputs */
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        input[type="text"], select {
          background-color: #0d0e12;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px 14px;
          color: var(--text-color);
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
        }

        input[type="text"]:focus, select:focus {
          border-color: #4facfe;
        }

        /* Save & OBS Actions */
        .action-card {
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .obs-link-box {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .obs-url-input {
          font-family: monospace;
          background-color: #0d0e12;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 12px;
          color: #25f4ee;
          flex-grow: 1;
          font-size: 14px;
          overflow-x: auto;
          white-space: nowrap;
        }

        .btn-copy, .btn-save {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: transform 0.2s, box-shadow 0.2s;
          border: none;
        }

        .btn-copy {
          background-color: rgba(255,255,255,0.06);
          color: white;
          border: 1px solid var(--border-color);
          padding: 0 18px;
        }

        .btn-copy:hover {
          background-color: rgba(255,255,255,0.1);
        }

        .btn-copy.success {
          background-color: rgba(16, 185, 129, 0.2);
          color: #34d399;
          border-color: rgba(16, 185, 129, 0.4);
        }

        .btn-save {
          background: linear-gradient(135deg, #a970ff 0%, #772ce8 100%);
          color: white;
          padding: 14px 40px;
          font-size: 16px;
          box-shadow: 0 4px 15px rgba(169, 112, 255, 0.3);
          align-self: center;
        }

        .btn-save:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(169, 112, 255, 0.45);
        }

        .btn-save:active {
          transform: translateY(1px);
        }
      `}</style>

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
