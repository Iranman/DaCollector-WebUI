import { api, ApiError, getApiKey } from './client';

export interface LogEntry {
  TimeStamp: string;
  Level: string;
  Logger: string;
  Caller: string;
  ThreadId: number;
  ProcessId: number;
  Message: string;
  Exception?: string;
}

export interface LogReadResult {
  NextOffset?: number;
  Entries: LogEntry[];
}

export interface LogFile {
  ID: string;
  Date: string;
  DailyNumber: number;
  Name: string;
  Size: number;
  IsCurrent: boolean;
  IsCompressed: boolean;
  Format: string;
  LastModifiedAt: string;
}

export interface LogReadOptions {
  fileID?: string;
  offset?: number;
  limit?: number;
  descending?: boolean;
  level?: string;
  logger?: string;
  caller?: string;
  message?: string;
  exception?: string;
  processId?: number;
  threadId?: number;
}

export interface LogDownloadOptions extends Omit<LogReadOptions, 'offset' | 'limit' | 'descending'> {
  format?: 'simple' | 'full' | 'json' | 'legacy';
}

export interface DownloadedLog {
  blob: Blob;
  filename: string;
}

function queryString(params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return query.toString();
}

function readPath(options: LogReadOptions) {
  const query = queryString({
    offset: options.offset ?? 0,
    limit: options.limit ?? 200,
    descending: options.descending ?? true,
    level: options.level,
    logger: options.logger,
    caller: options.caller,
    message: options.message,
    exception: options.exception,
    processId: options.processId,
    threadId: options.threadId,
  });
  const base = options.fileID
    ? `/api/v3/Logging/File/${encodeURIComponent(options.fileID)}/Read`
    : '/api/v3/Logging/File/Current/Read';
  return `${base}?${query}`;
}

function downloadPath(options: LogDownloadOptions) {
  const query = queryString({
    format: options.format,
    level: options.level,
    logger: options.logger,
    caller: options.caller,
    message: options.message,
    exception: options.exception,
    processId: options.processId,
    threadId: options.threadId,
  });
  const base = options.fileID
    ? `/api/v3/Logging/File/${encodeURIComponent(options.fileID)}/Download`
    : '/api/v3/Logging/File/Current/Download';
  return `${base}?${query}`;
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return 'dacollector-log.txt';
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const ascii = disposition.match(/filename="?([^";]+)"?/i);
  return ascii?.[1] ?? 'dacollector-log.txt';
}

async function downloadLog(options: LogDownloadOptions = {}): Promise<DownloadedLog> {
  const headers: Record<string, string> = {};
  const apiKey = getApiKey();
  if (apiKey) headers.apikey = apiKey;

  const response = await fetch(downloadPath(options), { headers });
  if (!response.ok) {
    let message = response.statusText;
    try {
      message = await response.text();
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, message || `${response.status} ${response.statusText}`);
  }

  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get('content-disposition')),
  };
}

export const loggingApi = {
  listFiles: () => api.get<LogFile[]>('/api/v3/Logging/File'),
  currentFile: () => api.get<LogFile>('/api/v3/Logging/File/Current'),
  read: (offset = 0, limit = 200, descending = true) => api.get<LogReadResult>(readPath({ offset, limit, descending })),
  readWithFilters: (options: LogReadOptions = {}) => api.get<LogReadResult>(readPath(options)),
  download: downloadLog,
  deleteFile: (fileID: string) => api.del<void>(`/api/v3/Logging/File/${encodeURIComponent(fileID)}`),
};
