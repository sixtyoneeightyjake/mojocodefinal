import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { redirect } from '@remix-run/cloudflare';
import { getAuth } from '@clerk/remix/ssr.server';

const DEFAULT_SIGN_IN_URL = 'https://relevant-burro-77.accounts.dev/sign-in';
const DEFAULT_SIGN_UP_URL = 'https://relevant-burro-77.accounts.dev/sign-up';

type ClerkEnvVars = Record<string, string | undefined>;

interface ResolverArgs {
  context?: {
    env?: Record<string, unknown>;
    cloudflare?: { env?: Record<string, unknown> };
  };
}

export const resolveClerkEnv = (args: ResolverArgs | LoaderFunctionArgs): ClerkEnvVars => {
  const rawContext = (args.context ?? {}) as Record<string, unknown> & {
    cloudflare?: { env?: Record<string, unknown> };
    env?: Record<string, unknown>;
  };

  const cloudflareEnv = (rawContext?.cloudflare?.env ?? {}) as ClerkEnvVars;
  const legacyEnv = (rawContext?.env ?? {}) as ClerkEnvVars;
  const directEnv = (rawContext ?? {}) as ClerkEnvVars;

  return {
    CLERK_PUBLISHABLE_KEY:
      cloudflareEnv.CLERK_PUBLISHABLE_KEY ??
      legacyEnv.CLERK_PUBLISHABLE_KEY ??
      (directEnv.CLERK_PUBLISHABLE_KEY as string | undefined) ??
      process.env.CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY:
      cloudflareEnv.CLERK_SECRET_KEY ??
      legacyEnv.CLERK_SECRET_KEY ??
      (directEnv.CLERK_SECRET_KEY as string | undefined) ??
      process.env.CLERK_SECRET_KEY,
    CLERK_SIGN_IN_URL:
      cloudflareEnv.CLERK_SIGN_IN_URL ??
      legacyEnv.CLERK_SIGN_IN_URL ??
      (directEnv.CLERK_SIGN_IN_URL as string | undefined) ??
      process.env.CLERK_SIGN_IN_URL,
    CLERK_SIGN_UP_URL:
      cloudflareEnv.CLERK_SIGN_UP_URL ??
      legacyEnv.CLERK_SIGN_UP_URL ??
      (directEnv.CLERK_SIGN_UP_URL as string | undefined) ??
      process.env.CLERK_SIGN_UP_URL,
  };
};

export const resolveClerkUrls = (args: LoaderFunctionArgs) => {
  const env = resolveClerkEnv(args);

  const signInUrl = env.CLERK_SIGN_IN_URL ?? DEFAULT_SIGN_IN_URL;
  const signUpUrl = env.CLERK_SIGN_UP_URL ?? DEFAULT_SIGN_UP_URL;

  return { signInUrl, signUpUrl };
};

export async function requireUserId(args: LoaderFunctionArgs): Promise<string> {
  const auth = await getAuth(args);

  if (auth.userId) {
    return auth.userId;
  }

  const { signInUrl } = resolveClerkUrls(args);
  const signIn = new URL(signInUrl);

  if (!signIn.searchParams.has('redirect_url')) {
    signIn.searchParams.set('redirect_url', args.request.url);
  }

  throw redirect(signIn.toString());
}

export { DEFAULT_SIGN_IN_URL, DEFAULT_SIGN_UP_URL };
