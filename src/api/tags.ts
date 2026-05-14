import { api } from './client';

export interface ListResult<T> {
  Total: number;
  List: T[];
}

export interface Tag {
  ID: number;
  ParentID?: number;
  Name: string;
  Description?: string;
  IsVerified?: boolean;
  IsSpoiler: boolean;
  IsLocalSpoiler?: boolean;
  Weight?: number;
  Size?: number;
  LastUpdated?: string;
  Source: string;
}

export const tagsApi = {
  listAniDb: (pageSize = 100, page = 1) =>
    api.get<ListResult<Tag>>(`/api/v3/Tag/AniDB?pageSize=${pageSize}&page=${page}&excludeDescriptions=true&onlyVerified=true&includeCount=false`),
  listUser: (pageSize = 100, page = 1) =>
    api.get<ListResult<Tag>>(`/api/v3/Tag/User?pageSize=${pageSize}&page=${page}&excludeDescriptions=true&includeCount=false`),
};
