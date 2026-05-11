import { api } from './client';

export interface ExternalIdGuess {
  Source: string;
  Id: string;
}

export interface ParsedFilenameResult {
  OriginalPath: string;
  FileName: string;
  Kind: 'Unknown' | 'Movie' | 'TvEpisode' | 'MultiEpisodeTvFile';
  Title?: string;
  Year?: number;
  ShowTitle?: string;
  SeasonNumber?: number;
  EpisodeNumbers: number[];
  AirDate?: string;
  ExternalIds: ExternalIdGuess[];
  Quality?: string;
  Source?: string;
  Edition?: string;
  VideoCodec?: string;
  AudioCodec?: string;
  AudioChannels?: string;
  HdrFormats: string[];
  Warnings: string[];
}

export const parserApi = {
  parseFilename: (path: string) =>
    api.get<ParsedFilenameResult>(`/api/v3/Parser/Filename?path=${encodeURIComponent(path)}`),
};
