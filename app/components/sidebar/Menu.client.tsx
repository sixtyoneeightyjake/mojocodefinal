import { motion, type Variants } from 'framer-motion';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/remix';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';
import { SettingsButton } from '~/components/ui/SettingsButton';
import { Button } from '~/components/ui/Button';
import {
  chatId,
  type ChatSummary,
  useChatHistory,
  fetchChatList,
  deleteChat as deleteChatRequest,
} from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { profileStore, updateProfile } from '~/lib/stores/profile';

const CLERK_SIGN_IN_URL = 'https://relevant-burro-77.accounts.dev/sign-in';
const CLERK_SIGN_UP_URL = 'https://relevant-burro-77.accounts.dev/sign-up';
const SETTINGS_PASSWORD = '60180jake';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-340px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent =
  | { type: 'delete'; item: ChatSummary }
  | { type: 'bulkDelete'; items: ChatSummary[] }
  | null;

function CurrentDateTime() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 px-6 py-3 text-[11px] uppercase tracking-[0.32em] text-bolt-elements-textSecondary border-b border-[rgba(255,255,255,0.08)] bg-[rgba(12,15,24,0.6)] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[rgba(255,59,115,0.35)] text-white shadow-[0_0_12px_rgba(255,59,115,0.45)]">
        <div className="i-ph:clock text-base" />
      </div>
      <div className="flex gap-3 text-[11px] tracking-[0.24em]">
        <span>{dateTime.toLocaleDateString()}</span>
        <span>{dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

export const Menu = () => {
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const profile = useStore(profileStore);
  const { user, isSignedIn, isLoaded } = useUser();
  const signedInDisplayName =
    user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || 'Signed in';
  const guestDisplayName = profile?.username || 'Guest';

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter<ChatSummary>({
    items: list,
    searchFields: ['description'],
  });

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (isSignedIn && user) {
      updateProfile({
        username: user.fullName || user.username || user.primaryEmailAddress?.emailAddress || '',
        avatar: user.imageUrl || '',
      });
    } else if (!isSignedIn) {
      updateProfile({ username: '', avatar: '' });
    }
  }, [isLoaded, isSignedIn, user]);

  const loadEntries = useCallback(() => {
    fetchChatList()
      .then((entries) => entries.filter((item) => item.urlId && item.description))
      .then(setList)
      .catch((error) => toast.error(error.message));
  }, []);

  const deleteChat = useCallback(
    async (id: string): Promise<void> => {
      await deleteChatRequest(id);
      console.log('Successfully deleted chat:', id);
    },
    [],
  );

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatSummary) => {
      event.preventDefault();
      event.stopPropagation();

      // Log the delete operation to help debugging
      console.log('Attempting to delete chat:', { id: item.id, description: item.description });

      deleteChat(item.id)
        .then(() => {
          toast.success('Chat deleted successfully', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          // Always refresh the list
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            console.log('Navigating away from deleted chat');
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          console.error('Failed to delete chat:', error);
          toast.error('Failed to delete conversation', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          // Still try to reload entries in case data has changed
          loadEntries();
        });
    },
    [loadEntries, deleteChat],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteIds: string[]) => {
      if (itemsToDeleteIds.length === 0) {
        console.log('Bulk delete skipped: no items to delete.');
        return;
      }

      console.log(`Starting bulk delete for ${itemsToDeleteIds.length} chats`, itemsToDeleteIds);

      let deletedCount = 0;
      const errors: string[] = [];
      const currentChatId = chatId.get();
      let shouldNavigate = false;

      // Process deletions sequentially using the shared deleteChat logic
      for (const id of itemsToDeleteIds) {
        try {
          await deleteChat(id);
          deletedCount++;

          if (id === currentChatId) {
            shouldNavigate = true;
          }
        } catch (error) {
          console.error(`Error deleting chat ${id}:`, error);
          errors.push(id);
        }
      }

      // Show appropriate toast message
      if (errors.length === 0) {
        toast.success(`${deletedCount} chat${deletedCount === 1 ? '' : 's'} deleted successfully`);
      } else {
        toast.warning(`Deleted ${deletedCount} of ${itemsToDeleteIds.length} chats. ${errors.length} failed.`, {
          autoClose: 5000,
        });
      }

      // Reload the list after all deletions
      await loadEntries();

      // Clear selection state
      setSelectedItems([]);
      setSelectionMode(false);

      // Navigate if needed
      if (shouldNavigate) {
        console.log('Navigating away from deleted chat');
        window.location.pathname = '/';
      }
    },
    [deleteChat, loadEntries],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);

    if (selectionMode) {
      // If turning selection mode OFF, clear selection
      setSelectedItems([]);
    }
  };

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSelectedItems = prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      console.log('Selected items updated:', newSelectedItems);

      return newSelectedItems; // Return the new array
    });
  }, []); // No dependencies needed

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.info('Select at least one chat to delete');
      return;
    }

    const selectedChats = list.filter((item) => selectedItems.includes(item.id));

    if (selectedChats.length === 0) {
      toast.error('Could not find selected chats');
      return;
    }

    setDialogContent({ type: 'bulkDelete', items: selectedChats });
  }, [selectedItems, list]); // Keep list dependency

  const selectAll = useCallback(() => {
    const allFilteredIds = filteredList.map((item) => item.id);
    setSelectedItems((prev) => {
      const allFilteredAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.includes(id));

      if (allFilteredAreSelected) {
        // Deselect only the filtered items
        const newSelectedItems = prev.filter((id) => !allFilteredIds.includes(id));
        console.log('Deselecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      } else {
        // Select all filtered items, adding them to any existing selections
        const newSelectedItems = [...new Set([...prev, ...allFilteredIds])];
        console.log('Selecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      }
    });
  }, [filteredList]); // Depends only on filteredList

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, loadEntries]);

  // Exit selection mode when sidebar is closed
  useEffect(() => {
    if (!open && selectionMode) {
      /*
       * Don't clear selection state anymore when sidebar closes
       * This allows the selection to persist when reopening the sidebar
       */
      console.log('Sidebar closed, preserving selection state');
    }
  }, [open, selectionMode]);

  useEffect(() => {
    const enterThreshold = 20;
    const exitThreshold = 20;

    function onMouseMove(event: MouseEvent) {
      if (isSettingsOpen) {
        return;
      }

      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isSettingsOpen]);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries(); // Reload the list after duplication
  };

  const handleSettingsClick = () => {
    const input = window.prompt('Enter the settings password');

    if (input === null) {
      return;
    }

    if (input.trim() === SETTINGS_PASSWORD) {
      setIsSettingsOpen(true);
      setOpen(false);
      return;
    }

    toast.error('Incorrect password.');
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    console.log('Setting dialog content:', content);
    setDialogContent(content);
  }, []);

  return (
    <>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        className={classNames(
          'surface-tracer flex flex-col side-menu fixed top-0 h-full w-[340px] rounded-r-3xl border border-[rgba(255,255,255,0.08)] backdrop-blur-2xl bg-[rgba(6,8,14,0.92)] text-sm text-bolt-elements-textSecondary shadow-[0_32px_80px_rgba(0,0,0,0.55)] ring-1 ring-[rgba(255,59,115,0.08)]',
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(12,15,24,0.6)] backdrop-blur-xl rounded-tr-3xl">
          <div className="text-bolt-elements-textPrimary font-semibold tracking-[0.22em] uppercase text-xs">
            MojoCode
          </div>
          <div className="flex items-center gap-3">
            <SignedIn>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm text-bolt-elements-textPrimary truncate max-w-[160px]">
                  {signedInDisplayName}
                </span>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'w-8 h-8',
                    },
                  }}
                />
              </div>
            </SignedIn>
            <SignedOut>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-bolt-elements-textSecondary truncate max-w-[120px]">
                  {guestDisplayName}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.assign(CLERK_SIGN_IN_URL);
                    }
                  }}
                >
                  <span className="i-ph:sign-in text-sm" />
                  Sign In
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.assign(CLERK_SIGN_UP_URL);
                    }
                  }}
                >
                  <span className="i-ph:user-plus text-sm" />
                  Sign Up
                </Button>
              </div>
            </SignedOut>
          </div>
        </div>
        <CurrentDateTime />
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="flex gap-3">
              <a
                href="/"
                className="surface-tracer flex-1 flex gap-3 items-center px-5 py-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,43,95,0.2)] text-white/90 hover:bg-[rgba(255,43,95,0.32)] hover:text-white transition-[background,box-shadow] duration-200 shadow-[0_20px_45px_rgba(255,43,95,0.25)]"
              >
                <span className="inline-block i-ph:plus-circle h-4 w-4" />
                <span className="text-sm font-semibold tracking-[0.18em] uppercase">Start new chat</span>
              </a>
              <button
                onClick={toggleSelectionMode}
                className={classNames(
                  'surface-tracer flex items-center justify-center rounded-2xl px-4 py-3 transition-[background,color,box-shadow] duration-200 uppercase tracking-[0.18em] text-[11px] font-semibold gap-2',
                  selectionMode
                    ? 'bg-[rgba(255,43,95,0.32)] text-white shadow-[0_18px_36px_rgba(255,43,95,0.28)]'
                    : 'bg-[rgba(14,17,26,0.78)] text-[rgba(214,218,228,0.75)] hover:text-white hover:bg-[rgba(255,43,95,0.18)] shadow-[0_16px_34px_rgba(0,0,0,0.45)]',
                )}
                aria-label={selectionMode ? 'Exit selection mode' : 'Enter selection mode'}
              >
                <span className={selectionMode ? 'i-ph:x h-4 w-4' : 'i-ph:check-square h-4 w-4'} />
              </button>
            </div>
            <div className="relative w-full">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(173,179,191,0.65)]">
                <span className="i-ph:magnifying-glass h-4 w-4" />
              </div>
              <input
                className="w-full bg-[rgba(12,14,22,0.82)] relative pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[rgba(255,59,115,0.35)] text-sm text-bolt-elements-textPrimary placeholder:text-[rgba(146,150,168,0.55)] border border-[rgba(255,255,255,0.08)] transition-[border,box-shadow] duration-200 shadow-[0_14px_40px_rgba(0,0,0,0.45)]"
                type="search"
                placeholder="Search chats..."
                onChange={handleSearchChange}
                aria-label="Search chats"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm px-5 py-3">
            <div className="font-semibold text-[rgba(236,238,245,0.78)] tracking-[0.22em] uppercase text-xs">
              Your Chats
            </div>
            {selectionMode && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedItems.length === filteredList.length ? 'Deselect all' : 'Select all'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteClick}
                  disabled={selectedItems.length === 0}
                >
                  Delete selected
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto px-4 pb-4 modern-scrollbar">
            {filteredList.length === 0 && (
              <div className="px-4 text-[rgba(173,179,191,0.72)] text-sm">
                {list.length === 0 ? 'No previous conversations' : 'No matches found'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(filteredList).map(({ category, items }) => (
                <div key={category} className="mt-2 first:mt-0 space-y-1">
                  <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[rgba(214,218,228,0.55)] sticky top-0 z-1 bg-[rgba(8,10,16,0.92)]/90 backdrop-blur px-4 py-2 rounded-xl">
                    {category}
                  </div>
                  <div className="space-y-0.5 pr-1">
                    {items.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        exportChat={exportChat}
                        onDelete={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          console.log('Delete triggered for item:', item);
                          setDialogContentWithLogging({ type: 'delete', item });
                        }}
                        onDuplicate={() => handleDuplicate(item.id)}
                        selectionMode={selectionMode}
                        isSelected={selectedItems.includes(item.id)}
                        onToggleSelection={toggleItemSelection}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <div className="p-6 bg-[rgba(10,12,20,0.95)] text-bolt-elements-textSecondary">
                      <DialogTitle className="text-bolt-elements-textPrimary">Delete Chat?</DialogTitle>
                      <DialogDescription className="mt-3 text-[rgba(187,191,202,0.76)] leading-relaxed">
                        <p>
                          You are about to delete{' '}
                          <span className="font-semibold text-bolt-elements-textPrimary">
                            {dialogContent.item.description}
                          </span>
                        </p>
                        <p className="mt-3">Are you sure you want to delete this chat?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-[rgba(7,10,18,0.9)] border-t border-[rgba(255,255,255,0.08)]">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          console.log('Dialog delete button clicked for item:', dialogContent.item);
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
                {dialogContent?.type === 'bulkDelete' && (
                  <>
                    <div className="p-6 bg-[rgba(10,12,20,0.95)] text-bolt-elements-textSecondary">
                      <DialogTitle className="text-bolt-elements-textPrimary">Delete Selected Chats?</DialogTitle>
                      <DialogDescription className="mt-3 text-[rgba(187,191,202,0.76)] leading-relaxed">
                        <p>
                          You are about to delete {dialogContent.items.length}{' '}
                          {dialogContent.items.length === 1 ? 'chat' : 'chats'}:
                        </p>
                        <div className="mt-3 max-h-32 overflow-auto border border-[rgba(255,255,255,0.08)] rounded-xl bg-[rgba(7,9,15,0.9)] p-3">
                          <ul className="list-disc pl-5 space-y-1">
                            {dialogContent.items.map((item) => (
                              <li key={item.id} className="text-sm text-[rgba(214,218,228,0.76)]">
                                <span className="font-semibold text-bolt-elements-textPrimary">{item.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="mt-3">Are you sure you want to delete these chats?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-[rgba(7,10,18,0.9)] border-t border-[rgba(255,255,255,0.08)]">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={() => {
                          /*
                           * Pass the current selectedItems to the delete function.
                           * This captures the state at the moment the user confirms.
                           */
                          const itemsToDeleteNow = [...selectedItems];
                          console.log('Bulk delete confirmed for', itemsToDeleteNow.length, 'items', itemsToDeleteNow);
                          deleteSelectedItems(itemsToDeleteNow);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          <div className="flex items-center justify-start border-t border-[rgba(255,255,255,0.08)] px-5 py-4 bg-[rgba(8,10,17,0.85)]">
            <div className="flex items-center gap-3 text-[rgba(214,218,228,0.78)]">
              <SettingsButton onClick={handleSettingsClick} />
            </div>
          </div>
        </div>
      </motion.div>

      <ControlPanel open={isSettingsOpen} onClose={handleSettingsClose} />
    </>
  );
};
