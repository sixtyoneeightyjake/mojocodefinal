import { useStore } from '@nanostores/react';
import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

import { ClerkApp } from '@clerk/remix';

/*
 * Client-safe defaults for Clerk auth pages. Avoid importing server-only
 * `~/utils/clerk.server` at module scope because Vite will treat this file
 * as a client route and fail when server-only modules are referenced.
 */
const DEFAULT_SIGN_IN_URL = 'https://relevant-burro-77.accounts.dev/sign-in';
const DEFAULT_SIGN_UP_URL = 'https://relevant-burro-77.accounts.dev/sign-up';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

export const loader = async (args: LoaderFunctionArgs) => {
  /*
   * Dynamically import server-only utilities to avoid Vite trying to
   * resolve/transform them when serving the module to the browser.
   */
  const [{ rootAuthLoader }, { resolveClerkEnv }] = await Promise.all([
    import('@clerk/remix/ssr.server'),
    import('~/utils/clerk.server'),
  ]);

  const env = resolveClerkEnv(args as any);
  const publishableKey = env.CLERK_PUBLISHABLE_KEY;
  const secretKey = env.CLERK_SECRET_KEY;

  if (!publishableKey || !secretKey) {
    throw new Error('Missing Clerk configuration. Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.');
  }

  return rootAuthLoader(args, {
    publishableKey,
    secretKey,
    signInUrl: env.CLERK_SIGN_IN_URL ?? DEFAULT_SIGN_IN_URL,
    signUpUrl: env.CLERK_SIGN_UP_URL ?? DEFAULT_SIGN_UP_URL,
    afterSignInUrl: '/',
    afterSignUpUrl: '/',
  });
};

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <ClientOnly>{() => <DndProvider backend={HTML5Backend}>{children}</DndProvider>}</ClientOnly>
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

function App() {
  const theme = useStore(themeStore);

  useEffect(() => {
    // Load client-only logging store dynamically to avoid touching cookies/localStorage during SSR
    import('./lib/stores/logs')
      .then(({ logStore }) => {
        logStore.logSystem('Application initialized', {
          theme,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });

        // Initialize debug logging with improved error handling
        import('./utils/debugLogger')
          .then(({ debugLogger }) => {
            /*
             * The debug logger initializes itself and starts disabled by default
             * It will only start capturing when enableDebugMode() is called
             */
            const status = debugLogger.getStatus();
            logStore.logSystem('Debug logging ready', {
              initialized: status.initialized,
              capturing: status.capturing,
              enabled: status.enabled,
            });
          })
          .catch((error) => {
            logStore.logError('Failed to initialize debug logging', error);
          });
      })
      .catch((error) => {
        // If logs can't be loaded on client for any reason, just console it
        console.error('Failed to load logStore on client:', error);
      });
  }, []);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default ClerkApp(App, {
  signInUrl: DEFAULT_SIGN_IN_URL,
  signUpUrl: DEFAULT_SIGN_UP_URL,
  afterSignInUrl: '/',
  afterSignUpUrl: '/',
});
