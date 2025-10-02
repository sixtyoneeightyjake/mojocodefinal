import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';

function MojoWordmark() {
  return (
    <svg
      className="w-[132px] drop-shadow-[0_0_12px_rgba(255,48,72,0.4)]"
      viewBox="0 0 220 60"
      role="img"
      aria-labelledby="mojo-logo-title"
    >
      <title id="mojo-logo-title">MojoCode</title>
      <defs>
        <linearGradient id="mojo-wordmark" x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF2742" />
          <stop offset="50%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FF3B73" />
        </linearGradient>
        <linearGradient id="mojo-border" x1="0" y1="0" x2="220" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,39,66,0.35)" />
          <stop offset="30%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="100%" stopColor="rgba(255,59,115,0.4)" />
        </linearGradient>
        <filter id="mojo-glow" x="-30%" y="-120%" width="160%" height="320%">
          <feGaussianBlur stdDeviation="6" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect
        x="4"
        y="6"
        width="212"
        height="48"
        rx="16"
        fill="rgba(255,255,255,0.04)"
        stroke="url(#mojo-border)"
        strokeWidth="2"
      />
      <text
        x="110"
        y="38"
        textAnchor="middle"
        fontSize="30"
        fontFamily="'Inter', 'Helvetica Neue', sans-serif"
        fontWeight="700"
        fill="url(#mojo-wordmark)"
        filter="url(#mojo-glow)"
        letterSpacing="0.12em"
      >
        MOJOCODE
      </text>
    </svg>
  );
}

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames(
        'flex items-center px-6 h-[var(--header-height)] backdrop-blur-xl border-b border-transparent bg-[rgba(6,8,14,0.85)] shadow-[0_18px_45px_rgba(0,0,0,0.45)] transition-colors',
        {
          'border-[rgba(255,255,255,0.08)]': chat.started,
        },
      )}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl text-bolt-elements-textSecondary transition-theme" />
        <a href="/" className="group relative flex items-center">
          <div className="absolute inset-0 scale-[1.1] rounded-full opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-70"
            style={{
              background:
                'radial-gradient(circle at 20% 20%, rgba(255, 59, 115, 0.5) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.12) 0%, transparent 45%)',
            }}
          />
          <MojoWordmark />
        </a>
      </div>
      {chat.started && ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
        <>
          <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        </>
      )}
    </header>
  );
}
