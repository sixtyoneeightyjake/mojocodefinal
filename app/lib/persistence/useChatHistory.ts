import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { atom } from 'nanostores';
import { generateId, type JSONValue, type Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs';
import {
  duplicateChat as duplicateChatRequest,
  fetchChat as fetchChatRequest,
  importChat as importChatRequest,
  upsertChat as upsertChatRequest,
  updateChatMetadata as updateChatMetadataRequest,
} from './client';
import type { Snapshot, IChatMetadata } from './types';
import { webcontainer } from '~/lib/webcontainer';
import { detectProjectCommands, createCommandActionsString } from '~/utils/projectCommands';
import type { ContextAnnotation } from '~/types/context';

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);
export const chatMetadata = atom<IChatMetadata | undefined>(undefined);

interface ChatHistoryItemResponse {
  id: string;
  urlId: string;
  description?: string;
  messages: Message[];
  metadata?: IChatMetadata;
  snapshot?: Snapshot | null;
  createdAt: string;
  updatedAt: string;
  timestamp: string;
}

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();
  const [currentSnapshot, setCurrentSnapshot] = useState<Snapshot | null>(null);

  const pendingSnapshotRef = useRef<Snapshot | null>(null);

  const restoreSnapshot = useCallback(async (snapshot?: Snapshot | null) => {
    if (!snapshot?.files) {
      return;
    }

    try {
      const container = await webcontainer;

      for (const [key, value] of Object.entries(snapshot.files)) {
        let path = key;

        if (path.startsWith(container.workdir)) {
          path = path.replace(container.workdir, '');
        }

        if (value?.type === 'folder') {
          await container.fs.mkdir(path, { recursive: true });
        }
      }

      for (const [key, value] of Object.entries(snapshot.files)) {
        let path = key;

        if (path.startsWith(container.workdir)) {
          path = path.replace(container.workdir, '');
        }

        if (value?.type === 'file') {
          await container.fs.writeFile(path, value.content, { encoding: value.isBinary ? undefined : 'utf8' });
        }
      }
    } catch (error) {
      console.error('Failed to restore snapshot', error);
      toast.error('Failed to restore project snapshot');
    }
  }, []);

  useEffect(() => {
    if (!persistenceEnabled) {
      setReady(true);
      return;
    }

    if (!mixedId) {
      setReady(true);
      return;
    }

    let cancelled = false;

    const loadChat = async () => {
      try {
        const chat = await fetchChatRequest(mixedId);

        if (cancelled) {
          return;
        }

        const storedMessages = Array.isArray(chat.messages) ? chat.messages : [];
        const snapshot = chat.snapshot ?? null;

        const rewindId = searchParams.get('rewindTo');
        let startingIdx = -1;
        const endingIdx = rewindId ? storedMessages.findIndex((m) => m.id === rewindId) + 1 : storedMessages.length;
        const snapshotIndex = snapshot
          ? storedMessages.findIndex((m) => m.id === snapshot.chatIndex)
          : -1;

        if (snapshotIndex >= 0 && snapshotIndex < endingIdx) {
          startingIdx = snapshotIndex;
        }

        if (snapshotIndex > 0 && storedMessages[snapshotIndex]?.id === rewindId) {
          startingIdx = -1;
        }

        let filteredMessages = storedMessages.slice(startingIdx + 1, endingIdx);
        let archived: Message[] = [];

        if (startingIdx >= 0) {
          archived = storedMessages.slice(0, startingIdx + 1);
        }

        setArchivedMessages(archived);

        if (startingIdx > 0 && snapshot) {
          const files = Object.entries(snapshot.files || {})
            .map(([key, value]) => {
              if (value?.type !== 'file') {
                return null;
              }

              return {
                content: value.content,
                path: key,
              };
            })
            .filter((item): item is { content: string; path: string } => !!item);

          const projectCommands = await detectProjectCommands(files);
          const commandActionsString = createCommandActionsString(projectCommands);

          filteredMessages = [
            {
              id: generateId(),
              role: 'user',
              content: 'Restore project from snapshot',
              annotations: ['no-store', 'hidden'],
            },
            {
              id: storedMessages[snapshotIndex].id,
              role: 'assistant',
              content: `Bolt Restored your chat from a snapshot. You can revert this message to load the full chat history.
                  <boltArtifact id="restored-project-setup" title="Restored Project & Setup" type="bundled">
                  ${Object.entries(snapshot.files || {})
                    .map(([key, value]) => {
                      if (value?.type === 'file') {
                        return `
                      <boltAction type="file" filePath="${key}">
${value.content}
                      </boltAction>
                      `;
                      }

                      return '';
                    })
                    .join('\n')}
                  ${commandActionsString} 
                  </boltArtifact>
                  `,
              annotations: [
                'no-store',
                ...(snapshot.summary
                  ? [
                      {
                        chatId: storedMessages[snapshotIndex].id,
                        type: 'chatSummary',
                        summary: snapshot.summary,
                      } satisfies ContextAnnotation,
                    ]
                  : []),
              ],
            },
            ...filteredMessages,
          ];

          restoreSnapshot(snapshot);
        }

        setInitialMessages(filteredMessages);
        setUrlId(chat.urlId);
        chatId.set(chat.urlId);
        description.set(chat.description);
        chatMetadata.set(chat.metadata);
        setCurrentSnapshot(snapshot);
        pendingSnapshotRef.current = null;
        setReady(true);
      } catch (error) {
        console.error('Failed to load chat history:', error);
        logStore.logError('Failed to load chat history', { error });
        toast.error('Failed to load chat');
        navigate('/', { replace: true });
      }
    };

    loadChat();

    return () => {
      cancelled = true;
    };
  }, [mixedId, searchParams, navigate, restoreSnapshot]);

  const storeMessageHistory = useCallback(
    async (messages: Message[]) => {
      if (!persistenceEnabled || messages.length === 0) {
        return;
      }

      try {
        const { firstArtifact } = workbenchStore;
        const filteredMessages = messages.filter((m) => !m.annotations?.includes('no-store'));
        const combinedMessages = [...archivedMessages, ...filteredMessages];

        if (combinedMessages.length > 0) {
          const lastMessage = combinedMessages[combinedMessages.length - 1];

          let chatSummary: string | undefined;
          if (lastMessage.role === 'assistant') {
            const annotations = lastMessage.annotations as JSONValue[];
            const filteredAnnotations = (annotations?.filter(
              (annotation: JSONValue) =>
                annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
            ) || []) as { type: string; value: any } & { [key: string]: any }[];

            const summaryAnnotation = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary');

            if (summaryAnnotation) {
              chatSummary = summaryAnnotation.summary;
            }
          }

          pendingSnapshotRef.current = {
            chatIndex: lastMessage.id,
            files: workbenchStore.files.get(),
            summary: chatSummary,
          };
        }

        let resolvedDescription = description.get();

        if (!resolvedDescription && firstArtifact?.title) {
          resolvedDescription = firstArtifact.title;
          description.set(resolvedDescription);
        }

        let resolvedUrlId = urlId ?? chatId.get();
        const snapshotToPersist = pendingSnapshotRef.current ?? currentSnapshot;

        const chat = await upsertChatRequest({
          urlId: resolvedUrlId,
          description: resolvedDescription ?? null,
          messages: combinedMessages,
          metadata: chatMetadata.get() ?? null,
          snapshot: snapshotToPersist ?? null,
        });

        setUrlId(chat.urlId);
        chatId.set(chat.urlId);
        description.set(chat.description);
        chatMetadata.set(chat.metadata);
        setCurrentSnapshot(chat.snapshot ?? snapshotToPersist ?? null);
        pendingSnapshotRef.current = null;

        if (!resolvedUrlId && chat.urlId) {
          navigateChat(chat.urlId);
          resolvedUrlId = chat.urlId;
        }
      } catch (error) {
        console.error('Failed to save chat history:', error);
        logStore.logError('Failed to save chat history', { error });
        toast.error(error instanceof Error ? error.message : 'Failed to save chat history');
      }
    },
    [archivedMessages, currentSnapshot, urlId],
  );

  const updateChatMestaData = useCallback(
    async (metadata: IChatMetadata) => {
      if (!persistenceEnabled) {
        return;
      }

      const currentUrlId = urlId ?? chatId.get();

      if (!currentUrlId) {
        return;
      }

      try {
        await updateChatMetadataRequest(currentUrlId, metadata);
        chatMetadata.set(metadata);
      } catch (error) {
        console.error('Failed to update chat metadata:', error);
        logStore.logError('Failed to update chat metadata', { error });
        toast.error('Failed to update chat metadata');
      }
    },
    [urlId],
  );

  return {
    ready: !mixedId || ready,
    initialMessages,
    updateChatMestaData,
    storeMessageHistory,
    duplicateCurrentChat: async (listItemId: string) => {
      if (!persistenceEnabled) {
        return;
      }

      try {
        const newUrlId = await duplicateChatRequest(listItemId || mixedId || '');
        window.location.href = `/chat/${newUrlId}`;
        toast.success('Chat duplicated successfully');
      } catch (error) {
        console.error('Failed to duplicate chat:', error);
        logStore.logError('Failed to duplicate chat', { error });
        toast.error('Failed to duplicate chat');
      }
    },
    importChat: async (chatDescription: string, messages: Message[], metadata?: IChatMetadata) => {
      if (!persistenceEnabled) {
        return;
      }

      try {
        const newUrlId = await importChatRequest({
          description: chatDescription,
          messages,
          metadata: metadata ?? null,
          snapshot: null,
        });

        window.location.href = `/chat/${newUrlId}`;
        toast.success('Chat imported successfully');
      } catch (error) {
        console.error('Failed to import chat:', error);
        logStore.logError('Failed to import chat', { error });
        toast.error('Failed to import chat');
      }
    },
    exportChat: async (id = urlId) => {
      if (!persistenceEnabled || !id) {
        return;
      }

      try {
        const chat = await fetchChatRequest(id);
        const chatData = {
          messages: chat.messages,
          description: chat.description,
          exportDate: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to export chat:', error);
        logStore.logError('Failed to export chat', { error });
        toast.error('Failed to export chat');
      }
    },
  };
}

function navigateChat(nextId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
