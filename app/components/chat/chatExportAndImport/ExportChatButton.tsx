import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '~/components/ui/Button';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { useGitHubConnection } from '~/lib/hooks';
import { useGitHubDeploy } from '~/components/deploy/GitHubDeploy.client';
import { GitHubDeploymentDialog } from '~/components/deploy/GitHubDeploymentDialog';
import { GitHubAuthDialog } from '~/components/@settings/tabs/github/components/GitHubAuthDialog';

interface ExportChatButtonProps {
  exportChat?: () => void;
  appearance?: 'default' | 'toolbar';
  className?: string;
}

const toolbarTriggerClasses =
  'gap-1 text-xs font-medium justify-center px-3 py-1.5 bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-md transition-colors duration-200 ease-in-out';

const defaultTriggerClasses =
  'gap-2 px-3 py-1.5 text-xs bg-accent-500 text-white hover:bg-bolt-elements-button-primary-backgroundHover border border-accent-500/40 rounded-md transition-colors duration-200 ease-in-out';

export const ExportChatButton = ({ exportChat, appearance = 'toolbar', className }: ExportChatButtonProps) => {
  const { isConnected: isGitHubConnected } = useGitHubConnection();
  const { handleGitHubDeploy, isDeploying } = useGitHubDeploy();
  const [showGitHubDeploymentDialog, setShowGitHubDeploymentDialog] = useState(false);
  const [githubDeploymentFiles, setGithubDeploymentFiles] = useState<Record<string, string> | null>(null);
  const [githubProjectName, setGithubProjectName] = useState('');
  const [showGitHubAuthDialog, setShowGitHubAuthDialog] = useState(false);
  const [pendingGitHubPush, setPendingGitHubPush] = useState(false);

  const triggerClasses = classNames(
    'inline-flex items-center',
    appearance === 'toolbar' ? toolbarTriggerClasses : defaultTriggerClasses,
    className,
  );

  const variant = appearance === 'toolbar' ? 'secondary' : 'default';
  const size = appearance === 'toolbar' ? 'sm' : 'default';

  const githubMenuLabel = !isGitHubConnected
    ? 'Connect GitHub to Push'
    : isDeploying
      ? 'Pushing to GitHub...'
      : 'Push to GitHub';

  const handlePushToGitHub = async () => {
    if (!isGitHubConnected) {
      setPendingGitHubPush(true);
      setShowGitHubAuthDialog(true);

      return;
    }

    const result = await handleGitHubDeploy();

    if (result && result.success && result.files) {
      setGithubDeploymentFiles(result.files);
      setGithubProjectName(result.projectName);
      setShowGitHubDeploymentDialog(true);
    }
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant={variant} size={size} className={triggerClasses}>
            <span className="flex items-center gap-1">
              Export
              <span className={classNames('i-ph:caret-down transition-transform text-sm')} />
            </span>
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          className={classNames(
            'min-w-[220px] z-[250]',
            'bg-bolt-elements-background-depth-2',
            'rounded-lg shadow-lg',
            'border border-bolt-elements-borderColor',
            'animate-in fade-in-0 zoom-in-95',
            'py-1',
          )}
          sideOffset={5}
          align="end"
        >
          <DropdownMenu.Item
            className={classNames(
              'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
            )}
            onClick={() => {
              workbenchStore.downloadZip();
            }}
          >
            <div className="i-ph:code size-4.5" />
            <span>Download Code</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={classNames(
              'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
            )}
            onClick={() => exportChat?.()}
          >
            <div className="i-ph:chat size-4.5" />
            <span>Export Chat</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={classNames(
              'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
              {
                'opacity-60 cursor-not-allowed': isDeploying,
              },
            )}
            disabled={isDeploying}
            onClick={() => {
              handlePushToGitHub();
            }}
          >
            <div className="i-ph:github-logo size-4.5" />
            <span>{githubMenuLabel}</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      {showGitHubDeploymentDialog && githubDeploymentFiles && (
        <GitHubDeploymentDialog
          isOpen={showGitHubDeploymentDialog}
          onClose={() => {
            setShowGitHubDeploymentDialog(false);
            setGithubDeploymentFiles(null);
          }}
          projectName={githubProjectName}
          files={githubDeploymentFiles}
        />
      )}

      <GitHubAuthDialog
        isOpen={showGitHubAuthDialog}
        onClose={() => {
          setShowGitHubAuthDialog(false);
          setPendingGitHubPush(false);
        }}
        onSuccess={() => {
          setShowGitHubAuthDialog(false);

          if (pendingGitHubPush) {
            setPendingGitHubPush(false);
            setTimeout(() => {
              handlePushToGitHub();
            }, 0);
          }
        }}
      />
    </>
  );
};
