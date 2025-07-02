export interface VideoParams {
  videoId: string;
  parts?: string[];
}
export interface SearchParams {
  query: string;
  maxResults?: number;
}
export interface TrendingParams {
  regionCode?: string;
  maxResults?: number;
  videoCategoryId?: string;
}
export interface RelatedVideosParams {
  videoId: string;
  maxResults?: number;
}

export interface TranscriptParams {
  videoId: string;
  language?: string;
}

export interface SearchTranscriptParams {
  videoId: string;
  query: string;
  language?: string;
}

export interface ChannelParams {
  channelId: string;
}

export interface ChannelVideosParams {
  channelId: string;
  maxResults?: number;
}

export interface PlaylistParams {
  playlistId: string;
}

export interface PlaylistItemsParams {
  playlistId: string;
  maxResults?: number;
}
