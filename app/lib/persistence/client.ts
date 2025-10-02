import type { ChatHistoryItem, ChatSummary, UpsertChatPayload } from './types';

const BASE_PATH = '/api/chat-history';

async function parseJson<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);

  if (!response.ok) {
    let detail = 'Request failed';

    try {
      const errorBody = await parseJson<{ error?: string }>(response);
      if (errorBody?.error) {
        detail = errorBody.error;
      }
    } catch (error) {
      console.error('Failed to parse error response', error);
    }

    throw new Error(detail);
  }

  return parseJson<T>(response);
}

export async function fetchChatList(): Promise<ChatSummary[]> {
  const data = await request<{ chats: ChatSummary[] }>(`${BASE_PATH}?list=1`);
  return data?.chats ?? [];
}

export async function fetchChat(chatId: string): Promise<ChatHistoryItem> {
  const data = await request<{ chat: ChatHistoryItem }>(`${BASE_PATH}?chatId=${encodeURIComponent(chatId)}`);

  if (!data?.chat) {
    throw new Error('Chat not found');
  }

  return data.chat;
}

export async function upsertChat(payload: UpsertChatPayload): Promise<ChatHistoryItem> {
  const data = await request<{ chat: ChatHistoryItem }>(BASE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ intent: 'upsert', payload }),
  });

  if (!data?.chat) {
    throw new Error('Failed to persist chat');
  }

  return data.chat;
}

export async function deleteChat(chatId: string): Promise<void> {
  await request<void>(BASE_PATH, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chatId }),
  });
}

export async function duplicateChat(sourceChatId: string): Promise<string> {
  const data = await request<{ urlId: string }>(BASE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ intent: 'duplicate', chatId: sourceChatId }),
  });

  if (!data?.urlId) {
    throw new Error('Failed to duplicate chat');
  }

  return data.urlId;
}

export async function forkChat(chatId: string, messageId: string): Promise<string> {
  const data = await request<{ urlId: string }>(BASE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ intent: 'fork', chatId, messageId }),
  });

  if (!data?.urlId) {
    throw new Error('Failed to fork chat');
  }

  return data.urlId;
}

export async function importChat(payload: UpsertChatPayload & { description: string }): Promise<string> {
  const data = await request<{ urlId: string }>(BASE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ intent: 'import', payload }),
  });

  if (!data?.urlId) {
    throw new Error('Failed to import chat');
  }

  return data.urlId;
}

export async function updateChatDescription(urlId: string, description: string): Promise<void> {
  await request<void>(BASE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ intent: 'updateDescription', urlId, description }),
  });
}

export async function updateChatMetadata(urlId: string, metadata: Record<string, unknown>): Promise<void> {
  await request<void>(BASE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ intent: 'updateMetadata', urlId, metadata }),
  });
}
