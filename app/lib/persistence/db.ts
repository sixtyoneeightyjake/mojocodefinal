import type { ChatHistoryItem, UpsertChatPayload, IChatMetadata, Snapshot } from './types';
import {
  fetchChat,
  upsertChat as upsertChatRequest,
  duplicateChat as duplicateChatRequest,
  deleteChat as deleteChatRequest,
} from './client';

export type { IChatMetadata } from './types';

export async function openDatabase(): Promise<IDBDatabase | undefined> {
  return undefined;
}

export async function getMessages(_db: IDBDatabase | undefined, id: string): Promise<ChatHistoryItem> {
  return fetchChat(id);
}

export async function setMessages(
  _db: IDBDatabase | undefined,
  _id: string,
  messages: UpsertChatPayload['messages'],
  urlId?: string,
  description?: string,
  _timestamp?: string,
  metadata?: IChatMetadata,
): Promise<void> {
  await upsertChatRequest({
    urlId,
    description: description ?? null,
    messages,
    metadata: metadata ?? null,
    snapshot: null,
  });
}

export async function duplicateChat(_db: IDBDatabase | undefined, id: string): Promise<string> {
  return duplicateChatRequest(id);
}

export async function getSnapshot(_db: IDBDatabase | undefined, _chatId: string): Promise<Snapshot | undefined> {
  return undefined;
}

export async function setSnapshot(_db: IDBDatabase | undefined, _chatId: string, _snapshot: Snapshot): Promise<void> {
  return;
}

export async function deleteSnapshot(_db: IDBDatabase | undefined, _chatId: string): Promise<void> {
  return;
}

export async function getNextId(_db: IDBDatabase | undefined): Promise<string> {
  return crypto.randomUUID();
}

export async function getUrlId(_db: IDBDatabase | undefined, id: string): Promise<string> {
  return id;
}

export async function deleteById(_db: IDBDatabase | undefined, id: string): Promise<void> {
  await deleteChatRequest(id);
}
