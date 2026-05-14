import { api } from './client';

export interface RelocationSummary {
  RenameOnImport: boolean;
  MoveOnImport: boolean;
  AllowRelocationInsideDestinationOnImport: boolean;
  ProviderCount: number;
}

export interface RelocationPipe {
  ID: string;
  ProviderID: string;
  Name: string;
  IsDefault: boolean;
  IsUsable: boolean;
  HasConfiguration: boolean;
}

export interface RelocationResult {
  FileID: number;
  FileLocationID?: number;
  PipeName?: string;
  ManagedFolderID?: number;
  IsSuccess: boolean;
  IsRelocated?: boolean;
  IsPreview?: boolean;
  ErrorMessage?: string;
  RelativePath?: string;
  AbsolutePath?: string;
}

export interface RelocationRunOptions {
  pipeID?: string;
  move?: boolean;
  rename?: boolean;
  allowRelocationInsideDestination?: boolean;
  deleteEmptyDirectories?: boolean;
}

function buildRelocationQuery(options: RelocationRunOptions, includeDeleteEmptyDirectories: boolean) {
  const params = new URLSearchParams();
  if (includeDeleteEmptyDirectories) {
    params.set('deleteEmptyDirectories', String(options.deleteEmptyDirectories ?? true));
  }
  if (options.move != null) params.set('move', String(options.move));
  if (options.rename != null) params.set('rename', String(options.rename));
  if (options.allowRelocationInsideDestination != null) {
    params.set('allowRelocationInsideDestination', String(options.allowRelocationInsideDestination));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const relocationApi = {
  getSummary: () => api.get<RelocationSummary>('/api/v3/Relocation/Summary'),
  getPipes: () => api.get<RelocationPipe[]>('/api/v3/Relocation/Pipe'),
  preview: (fileIDs: number[], options: RelocationRunOptions = {}) => {
    const query = buildRelocationQuery(options, false);
    if (options.pipeID) {
      return api.post<RelocationResult[]>(`/api/v3/Relocation/Pipe/${options.pipeID}/Preview${query}`, fileIDs);
    }
    return api.post<RelocationResult[]>(
      `/api/v3/Relocation/Preview${query}`,
      { FileIDs: fileIDs }
    );
  },
  relocate: (fileIDs: number[], options: RelocationRunOptions = {}) => {
    const query = buildRelocationQuery(options, true);
    if (options.pipeID) {
      return api.post<RelocationResult[]>(`/api/v3/Relocation/Pipe/${options.pipeID}/Relocate${query}`, fileIDs);
    }
    return api.post<RelocationResult[]>(`/api/v3/Relocation/Relocate${query}`, fileIDs);
  },
};
