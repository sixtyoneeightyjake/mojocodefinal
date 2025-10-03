import ignore from 'ignore';
import { useGit } from '~/lib/hooks/useGit';
import type { Message } from 'ai';
import { detectProjectCommands, createCommandsMessage, escapeBoltTags } from '~/utils/projectCommands';
import { generateId } from '~/utils/fileUtils';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { LoadingOverlay } from '~/components/ui/LoadingOverlay';

import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import type { IChatMetadata } from '~/lib/persistence';
import { X, Github, GitBranch } from 'lucide-react';

// Import the new repository selector components
import { GitHubRepositorySelector } from '~/components/@settings/tabs/github/components/GitHubRepositorySelector';
import { useGitHubConnection } from '~/lib/hooks';
import { GitHubAuthDialog } from '~/components/@settings/tabs/github/components/GitHubAuthDialog';

const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '.github/**',
  '.vscode/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',

  // Include this so npm install runs much faster '**/*lock.json',
  '**/*lock.yaml',
];

const ig = ignore().add(IGNORE_PATTERNS);

const MAX_FILE_SIZE = 100 * 1024; // 100KB limit per file
const MAX_TOTAL_SIZE = 500 * 1024; // 500KB total limit

interface GitCloneButtonProps {
  className?: string;
  importChat?: (description: string, messages: Message[], metadata?: IChatMetadata) => Promise<void>;
  label?: string;
  appearance?: 'primary' | 'toolbar';
}

export default function GitCloneButton({
  importChat,
  className,
  label = 'Clone a repo',
  appearance = 'primary',
}: GitCloneButtonProps) {
  const { ready, gitClone } = useGit();
  const { isConnected: isGitHubConnected } = useGitHubConnection();
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showGitHubAuthDialog, setShowGitHubAuthDialog] = useState(false);

  const buttonVariant = appearance === 'toolbar' ? 'secondary' : 'default';
  const buttonSize = appearance === 'toolbar' ? 'sm' : 'lg';
  const buttonClasses =
    appearance === 'toolbar'
      ? classNames(
          'gap-1 text-xs font-medium justify-center px-3 py-1.5',
          'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3',
          'border border-bolt-elements-borderColor',
          'transition-colors duration-200 ease-in-out',
          className,
        )
      : classNames(
          'gap-2 bg-bolt-elements-background-depth-1',
          'text-bolt-elements-textPrimary',
          'hover:bg-bolt-elements-background-depth-2',
          'border border-bolt-elements-borderColor',
          'h-10 px-4 py-2 min-w-[120px] justify-center',
          'transition-all duration-200 ease-in-out',
          className,
        );
  const iconWrapperClasses = classNames('flex items-center gap-1', appearance === 'primary' ? 'ml-2' : 'ml-1.5');
  const iconSizeClasses = appearance === 'toolbar' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const handleClone = async (repoUrl: string, branch?: string) => {
    if (!ready) {
      return;
    }

    setLoading(true);
    setIsDialogOpen(false);

    try {
      const cloneTarget = branch ? `${repoUrl}#${branch}` : repoUrl;
      const { workdir, data } = await gitClone(cloneTarget);

      if (importChat) {
        const filePaths = Object.keys(data).filter((filePath) => !ig.ignores(filePath));
        const textDecoder = new TextDecoder('utf-8');

        let totalSize = 0;
        const skippedFiles: string[] = [];
        const fileContents = [];

        for (const filePath of filePaths) {
          const { data: content, encoding } = data[filePath];

          // Skip binary files
          if (
            content instanceof Uint8Array &&
            !filePath.match(/\.(txt|md|astro|mjs|js|jsx|ts|tsx|json|html|css|scss|less|yml|yaml|xml|svg|vue|svelte)$/i)
          ) {
            skippedFiles.push(filePath);
            continue;
          }

          try {
            const textContent =
              encoding === 'utf8' ? content : content instanceof Uint8Array ? textDecoder.decode(content) : '';

            if (!textContent) {
              continue;
            }

            // Check file size
            const fileSize = new TextEncoder().encode(textContent).length;

            if (fileSize > MAX_FILE_SIZE) {
              skippedFiles.push(`${filePath} (too large: ${Math.round(fileSize / 1024)}KB)`);
              continue;
            }

            // Check total size
            if (totalSize + fileSize > MAX_TOTAL_SIZE) {
              skippedFiles.push(`${filePath} (would exceed total size limit)`);
              continue;
            }

            totalSize += fileSize;
            fileContents.push({
              path: filePath,
              content: textContent,
            });
          } catch (e: any) {
            skippedFiles.push(`${filePath} (error: ${e.message})`);
          }
        }

        const commands = await detectProjectCommands(fileContents);
        const commandsMessage = createCommandsMessage(commands);

        const filesMessage: Message = {
          role: 'assistant',
          content: `Cloning the repo ${repoUrl} into ${workdir}
${
  skippedFiles.length > 0
    ? `\nSkipped files (${skippedFiles.length}):
${skippedFiles.map((f) => `- ${f}`).join('\n')}`
    : ''
}

<boltArtifact id="imported-files" title="Git Cloned Files" type="bundled">
${fileContents
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${escapeBoltTags(file.content)}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>`,
          id: generateId(),
          createdAt: new Date(),
        };

        const messages = [filesMessage];

        if (commandsMessage) {
          messages.push(commandsMessage);
        }

        await importChat(`Git Project:${repoUrl.split('/').slice(-1)[0]}`, messages);
      }
    } catch (error) {
      console.error('Error during import:', error);
      toast.error('Failed to import repository');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          if (!isGitHubConnected) {
            setShowGitHubAuthDialog(true);
            return;
          }

          setIsDialogOpen(true);
        }}
        title={label}
        variant={buttonVariant}
        size={buttonSize}
        className={buttonClasses}
        disabled={!ready || loading}
      >
        {label}
        <div className={iconWrapperClasses}>
          <Github className={iconSizeClasses} />
          <GitBranch className={iconSizeClasses} />
        </div>
      </Button>

      {/* GitHub Repository Selection */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-xl border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-bolt-elements-borderColor dark:border-bolt-elements-borderColor flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                  <Github className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                    Import GitHub Repository
                  </h3>
                  <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
                    Clone a repository from GitHub to your workspace
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDialogOpen(false);
                }}
                className="p-2 rounded-lg bg-transparent hover:bg-bolt-elements-background-depth-1 dark:hover:bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary dark:hover:text-bolt-elements-textPrimary transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <X className="w-5 h-5 transition-transform duration-200 hover:rotate-90" />
              </button>
            </div>

            <div className="p-6 max-h-[calc(90vh-140px)] overflow-y-auto">
              <GitHubRepositorySelector onClone={handleClone} />
            </div>
          </div>
        </div>
      )}

      {loading && <LoadingOverlay message="Please wait while we clone the repository..." />}
      <GitHubAuthDialog
        isOpen={showGitHubAuthDialog}
        onClose={() => setShowGitHubAuthDialog(false)}
        onSuccess={() => {
          setShowGitHubAuthDialog(false);
          setIsDialogOpen(true);
        }}
      />
    </>
  );
}
