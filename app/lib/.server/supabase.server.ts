import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/cloudflare';

type RemixArgs = Pick<LoaderFunctionArgs, 'context'> | Pick<ActionFunctionArgs, 'context'>;

type EnvSource = Record<string, string | undefined> | undefined;

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  jwtSecret?: string;
}

function coalesceEnvValue(key: string, sources: EnvSource[]): string | undefined {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    const value = source[key];

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

export function getSupabaseConfig(args: RemixArgs): SupabaseConfig {
  const context = 'context' in args ? (args.context as any) : undefined;
  const sources: EnvSource[] = [
    context?.cloudflare?.env,
    context?.env,
    context,
    process?.env as EnvSource,
  ];

  const url =
    coalesceEnvValue('SUPABASE_URL', sources) ??
    coalesceEnvValue('VITE_SUPABASE_URL', sources) ??
    coalesceEnvValue('NEXT_PUBLIC_SUPABASE_URL', sources);
  const serviceRoleKey =
    coalesceEnvValue('SUPABASE_SERVICE_ROLE_KEY', sources) ??
    coalesceEnvValue('SUPABASE_SERVICE_KEY', sources);
  const jwtSecret = coalesceEnvValue('SUPABASE_JWT_SECRET', sources);

  if (!url) {
    throw new Error('Supabase URL is not configured. Please set SUPABASE_URL.');
  }

  if (!serviceRoleKey) {
    throw new Error('Supabase service role key is not configured. Please set SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url, serviceRoleKey, jwtSecret };
}

export async function supabaseFetch(
  config: SupabaseConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);

  headers.set('apikey', config.serviceRoleKey);
  headers.set('Authorization', `Bearer ${config.serviceRoleKey}`);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${config.url}${path}`, {
    ...init,
    headers,
  });
}

export function generateUrlId(): string {
  const random = crypto.randomUUID().replace(/-/g, '');
  return random.slice(0, 12);
}
