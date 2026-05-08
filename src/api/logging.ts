import { api } from './client';

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

export const loggingApi = {
  read: (offset = 0, limit = 200, descending = true) =>
    api.get<LogReadResult>(
      `/api/v3/Logging/File/Current/Read?offset=${offset}&limit=${limit}&descending=${descending}`
    ),
};
