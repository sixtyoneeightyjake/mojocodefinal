import type { Message } from 'ai';
import type { FileMap } from '~/lib/stores/files';

export interface Snapshot {
  chatIndex: string;
  files: FileMap;
  summary?: string;
}

export interface IChatMetadata {
  gitUrl?: string;
  gitBranch?: string;
  netlifySiteId?: string;
  [key: string]: unknown;
}

export interface ChatSummary {
  id: string;
  urlId: string;
  description?: string;
  metadata?: IChatMetadata;
  createdAt: string;
  updatedAt: string;
  timestamp: string;
}

export interface ChatHistoryItem extends ChatSummary {
  messages: Message[];
  snapshot?: Snapshot | null;
}

export interface UpsertChatPayload {
  urlId?: string;
  description?: string | null;
  messages: Message[];
  metadata?: IChatMetadata | null;
  snapshot?: Snapshot | null;
}
