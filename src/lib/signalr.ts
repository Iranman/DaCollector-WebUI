import * as signalR from '@microsoft/signalr';
import { getApiKey } from '../api/client';

export function buildConnection(hubPath: string): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl(hubPath, {
      accessTokenFactory: () => getApiKey() ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();
}
