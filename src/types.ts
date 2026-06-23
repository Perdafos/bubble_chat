export interface Message {
  id: string;
  platform: 'twitch' | 'youtube' | 'tiktok';
  username: string;
  displayName: string;
  message: string;
  color: string;
  avatar?: string;
  timestamp: number;
  exiting?: boolean;
}

export interface Config {
  twitchChannel: string;
  youtubeId: string;
  youtubeType: 'channelId' | 'liveId';
  tiktokUsername: string;
  enabledPlatforms: {
    twitch: boolean;
    youtube: boolean;
    tiktok: boolean;
  };
}

export interface Status {
  twitch: 'connected' | 'connecting' | 'disconnected' | 'error';
  youtube: 'connected' | 'connecting' | 'disconnected' | 'error';
  tiktok: 'connected' | 'connecting' | 'disconnected' | 'error';
}
