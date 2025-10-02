import type { Message } from 'ai';
import { fetchChatList, fetchChat, deleteChat as deleteChatRequest } from './client';
import type { IChatMetadata } from './types';

export interface Chat {
  id: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  urlId?: string;
  metadata?: IChatMetadata | null;
}

function resolveChatIdentifier(dbOrId: IDBDatabase | string, maybeId?: string): string {
  if (typeof dbOrId === 'string') {
    return dbOrId;
  }

  if (typeof maybeId === 'string') {
    return maybeId;
  }

  throw new Error('Chat identifier is required');
}

export async function getAllChats(_db?: IDBDatabase): Promise<Chat[]> {
  const summaries = await fetchChatList();

  const chats = await Promise.all(
    summaries.map(async (summary) => {
      const chat = await fetchChat(summary.urlId);

      return {
        id: chat.id,
        description: chat.description,
        messages: chat.messages,
        timestamp: chat.updatedAt,
        urlId: chat.urlId,
        metadata: chat.metadata ?? null,
      } satisfies Chat;
    }),
  );

  return chats;
}

export async function deleteChat(dbOrId: IDBDatabase | string, maybeId?: string): Promise<void> {
  const identifier = resolveChatIdentifier(dbOrId, maybeId);
  await deleteChatRequest(identifier);
}

export async function deleteAllChats(): Promise<void> {
  const summaries = await fetchChatList();
  await Promise.allSettled(summaries.map((summary) => deleteChatRequest(summary.urlId)));
}

export async function saveChat(chat: Chat): Promise<void> {
  await fetch('/api/chat-history', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'upsert',
      payload: {
        urlId: chat.urlId,
        description: chat.description ?? null,
        messages: chat.messages,
        metadata: chat.metadata ?? null,
        snapshot: null,
      },
    }),
  });
}
