import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { requireUserId } from '~/utils/clerk.server';
import { generateUrlId, getSupabaseConfig, supabaseFetch } from '~/lib/.server/supabase.server';
import type { ChatHistoryItem, ChatSummary, UpsertChatPayload, Snapshot, IChatMetadata } from '~/lib/persistence/types';

interface SupabaseChatRow {
  id: string;
  user_id: string;
  url_id: string;
  description: string | null;
  messages: any;
  metadata: IChatMetadata | null;
  snapshot: Snapshot | null;
  created_at: string;
  updated_at: string;
}

function mapToSummary(row: SupabaseChatRow): ChatSummary {
  return {
    id: row.id,
    urlId: row.url_id,
    description: row.description ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timestamp: row.updated_at,
  };
}

function mapToHistoryItem(row: SupabaseChatRow): ChatHistoryItem {
  return {
    ...mapToSummary(row),
    messages: Array.isArray(row.messages) ? row.messages : [],
    snapshot: row.snapshot ?? null,
  };
}

async function fetchSingleRow(
  config: ReturnType<typeof getSupabaseConfig>,
  query: string,
): Promise<SupabaseChatRow | null> {
  const response = await supabaseFetch(config, `/rest/v1/chat_sessions?${query}`, {
    headers: {
      Accept: 'application/json',
      Prefer: 'count=exact',
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase query failed (${response.status})`);
  }

  const rows = (await response.json()) as SupabaseChatRow[];

  if (!rows?.length) {
    return null;
  }

  return rows[0];
}

async function resolveChatRow(
  config: ReturnType<typeof getSupabaseConfig>,
  userId: string,
  identifier: string,
): Promise<SupabaseChatRow | null> {
  const encodedUser = encodeURIComponent(userId);
  const encodedIdentifier = encodeURIComponent(identifier);

  const byUrl = await fetchSingleRow(config, `user_id=eq.${encodedUser}&url_id=eq.${encodedIdentifier}&limit=1`);

  if (byUrl) {
    return byUrl;
  }

  return fetchSingleRow(config, `user_id=eq.${encodedUser}&id=eq.${encodedIdentifier}&limit=1`);
}

async function listChats(config: ReturnType<typeof getSupabaseConfig>, userId: string): Promise<ChatSummary[]> {
  const encodedUser = encodeURIComponent(userId);
  const response = await supabaseFetch(
    config,
    `/rest/v1/chat_sessions?user_id=eq.${encodedUser}&select=id,url_id,description,metadata,created_at,updated_at&order=updated_at.desc`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch chat list (${response.status})`);
  }

  const rows = (await response.json()) as SupabaseChatRow[];

  return rows.map(mapToSummary);
}

async function upsertChat(
  config: ReturnType<typeof getSupabaseConfig>,
  userId: string,
  payload: UpsertChatPayload,
): Promise<SupabaseChatRow> {
  const urlId = payload.urlId && payload.urlId.length > 0 ? payload.urlId : generateUrlId();
  const body = [
    {
      user_id: userId,
      url_id: urlId,
      description: payload.description ?? null,
      messages: payload.messages ?? [],
      metadata: payload.metadata ?? null,
      snapshot: payload.snapshot ?? null,
      updated_at: new Date().toISOString(),
    },
  ];

  const response = await supabaseFetch(config, '/rest/v1/chat_sessions', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to persist chat (${response.status})`);
  }

  const rows = (await response.json()) as SupabaseChatRow[];

  if (!rows?.length) {
    throw new Error('Supabase did not return a chat record');
  }

  return rows[0];
}

async function insertChat(
  config: ReturnType<typeof getSupabaseConfig>,
  userId: string,
  payload: Omit<UpsertChatPayload, 'urlId'> & { description?: string | null },
): Promise<SupabaseChatRow> {
  return upsertChat(config, userId, payload);
}

async function updateChatFields(
  config: ReturnType<typeof getSupabaseConfig>,
  userId: string,
  urlId: string,
  fields: Partial<Pick<SupabaseChatRow, 'description' | 'metadata' | 'snapshot' | 'messages'>>, // `messages` only when fork
): Promise<void> {
  const encodedUser = encodeURIComponent(userId);
  const encodedUrl = encodeURIComponent(urlId);
  const response = await supabaseFetch(
    config,
    `/rest/v1/chat_sessions?user_id=eq.${encodedUser}&url_id=eq.${encodedUrl}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...fields,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to update chat (${response.status})`);
  }
}

export async function loader(args: LoaderFunctionArgs) {
  const userId = await requireUserId(args);
  const config = getSupabaseConfig(args);
  const url = new URL(args.request.url);
  const chatId = url.searchParams.get('chatId');

  try {
    if (chatId) {
      const row = await resolveChatRow(config, userId, chatId);

      if (!row) {
        return json({ error: 'Chat not found' }, { status: 404 });
      }

      return json({ chat: mapToHistoryItem(row) });
    }

    const chats = await listChats(config, userId);

    return json({ chats });
  } catch (error) {
    console.error('Chat history loader error:', error);
    return json({ error: error instanceof Error ? error.message : 'Failed to load chat history' }, { status: 500 });
  }
}

export async function action(args: ActionFunctionArgs) {
  const userId = await requireUserId(args);
  const config = getSupabaseConfig(args);
  const method = args.request.method.toUpperCase();

  try {
    if (method === 'DELETE') {
      const { chatId } = (await args.request.json()) as { chatId?: string };

      if (!chatId) {
        return json({ error: 'chatId is required' }, { status: 400 });
      }

      const row = await resolveChatRow(config, userId, chatId);

      if (!row) {
        return json({ error: 'Chat not found' }, { status: 404 });
      }

      const encodedUser = encodeURIComponent(userId);
      const encodedId = encodeURIComponent(row.id);
      const response = await supabaseFetch(
        config,
        `/rest/v1/chat_sessions?user_id=eq.${encodedUser}&id=eq.${encodedId}`,
        {
          method: 'DELETE',
          headers: {
            Prefer: 'count=exact',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete chat (${response.status})`);
      }

      return json({ success: true });
    }

    if (method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = (await args.request.json()) as {
      intent?: string;
      payload?: UpsertChatPayload;
      chatId?: string;
      messageId?: string;
      urlId?: string;
      description?: string;
      metadata?: IChatMetadata;
    };

    const intent = body.intent ?? 'upsert';

    switch (intent) {
      case 'upsert': {
        if (!body.payload) {
          return json({ error: 'payload is required' }, { status: 400 });
        }

        const row = await upsertChat(config, userId, body.payload);

        return json({ chat: mapToHistoryItem(row) });
      }

      case 'duplicate': {
        if (!body.chatId) {
          return json({ error: 'chatId is required' }, { status: 400 });
        }

        const source = await resolveChatRow(config, userId, body.chatId);

        if (!source) {
          return json({ error: 'Chat not found' }, { status: 404 });
        }

        const description = source.description ? `${source.description} (copy)` : 'Duplicated chat';
        const newRow = await upsertChat(config, userId, {
          description,
          messages: Array.isArray(source.messages) ? source.messages : [],
          metadata: source.metadata ?? null,
          snapshot: source.snapshot ?? null,
        });

        return json({ urlId: newRow.url_id });
      }

      case 'fork': {
        if (!body.chatId || !body.messageId) {
          return json({ error: 'chatId and messageId are required' }, { status: 400 });
        }

        const source = await resolveChatRow(config, userId, body.chatId);

        if (!source) {
          return json({ error: 'Chat not found' }, { status: 404 });
        }

        const messages = Array.isArray(source.messages) ? source.messages : [];
        const pivotIndex = messages.findIndex((message: any) => message.id === body.messageId);

        if (pivotIndex < 0) {
          return json({ error: 'Message not found in chat' }, { status: 404 });
        }

        const forkMessages = messages.slice(0, pivotIndex + 1);
        const description = source.description ? `${source.description} (fork)` : 'Forked chat';
        const newRow = await upsertChat(config, userId, {
          description,
          messages: forkMessages,
          metadata: source.metadata ?? null,
          snapshot: null,
        });

        return json({ urlId: newRow.url_id });
      }

      case 'import': {
        if (!body.payload) {
          return json({ error: 'payload is required' }, { status: 400 });
        }

        const description = body.payload.description ?? 'Imported chat';
        const newRow = await insertChat(config, userId, {
          description,
          messages: body.payload.messages,
          metadata: body.payload.metadata ?? null,
          snapshot: body.payload.snapshot ?? null,
        });

        return json({ urlId: newRow.url_id });
      }

      case 'updateDescription': {
        if (!body.urlId || typeof body.description !== 'string') {
          return json({ error: 'urlId and description are required' }, { status: 400 });
        }

        await updateChatFields(config, userId, body.urlId, { description: body.description });

        return json({ success: true });
      }

      case 'updateMetadata': {
        if (!body.urlId) {
          return json({ error: 'urlId is required' }, { status: 400 });
        }

        await updateChatFields(config, userId, body.urlId, { metadata: body.metadata ?? null });

        return json({ success: true });
      }

      default:
        return json({ error: `Unsupported intent: ${intent}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Chat history action error:', error);
    return json({ error: error instanceof Error ? error.message : 'Failed to process chat request' }, { status: 500 });
  }
}
