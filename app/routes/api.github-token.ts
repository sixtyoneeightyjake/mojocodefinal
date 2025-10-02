import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { requireUserId } from '~/utils/clerk.server';
import { getSupabaseConfig, supabaseFetch } from '~/lib/.server/supabase.server';
import { encryptString, decryptString } from '~/lib/.server/encryption.server';

const PROVIDER = 'github';

interface TokenRow {
  token_cipher: string;
  token_iv: string;
  token_tag: string;
  token_type: string | null;
}

function buildTokenQuery(userId: string): string {
  const encodedUser = encodeURIComponent(userId);
  const encodedProvider = encodeURIComponent(PROVIDER);
  return `user_id=eq.${encodedUser}&provider=eq.${encodedProvider}`;
}

export async function loader(args: LoaderFunctionArgs) {
  const userId = await requireUserId(args);
  const config = getSupabaseConfig(args);

  if (!config.jwtSecret) {
    return json({ error: 'SUPABASE_JWT_SECRET is not configured' }, { status: 500 });
  }

  try {
    const response = await supabaseFetch(
      config,
      `/rest/v1/user_tokens?${buildTokenQuery(userId)}&select=token_cipher,token_iv,token_tag,token_type`,
      {
        headers: {
          Accept: 'application/json',
          Prefer: 'count=exact',
        },
      },
    );

    if (!response.ok) {
      return json({ error: `Failed to load token (${response.status})` }, { status: 500 });
    }

    const rows = (await response.json()) as TokenRow[];
    const row = rows?.[0];

    if (!row) {
      return json({ token: null }, { status: 200 });
    }

    const decrypted = decryptString(config.jwtSecret, {
      ciphertext: row.token_cipher,
      iv: row.token_iv,
      tag: row.token_tag,
    });

    return json({ token: decrypted, tokenType: row.token_type ?? 'classic' });
  } catch (error) {
    console.error('Failed to load GitHub token:', error);
    return json({ error: 'Failed to load token' }, { status: 500 });
  }
}

export async function action(args: ActionFunctionArgs) {
  const userId = await requireUserId(args);
  const config = getSupabaseConfig(args);
  const method = args.request.method.toUpperCase();

  if (!config.jwtSecret) {
    return json({ error: 'SUPABASE_JWT_SECRET is not configured' }, { status: 500 });
  }

  try {
    if (method === 'DELETE') {
      const response = await supabaseFetch(config, `/rest/v1/user_tokens?${buildTokenQuery(userId)}`, {
        method: 'DELETE',
        headers: {
          Prefer: 'count=exact',
        },
      });

      if (!response.ok) {
        return json({ error: `Failed to delete token (${response.status})` }, { status: 500 });
      }

      return json({ success: true });
    }

    if (method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    const { token, tokenType } = (await args.request.json()) as {
      token?: string;
      tokenType?: 'classic' | 'fine-grained';
    };

    if (!token) {
      return json({ error: 'token is required' }, { status: 400 });
    }

    const encrypted = encryptString(config.jwtSecret, token);
    const response = await supabaseFetch(config, '/rest/v1/user_tokens', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([
        {
          user_id: userId,
          provider: PROVIDER,
          token_cipher: encrypted.ciphertext,
          token_iv: encrypted.iv,
          token_tag: encrypted.tag,
          token_type: tokenType ?? 'classic',
          updated_at: new Date().toISOString(),
        },
      ]),
    });

    if (!response.ok) {
      return json({ error: `Failed to store token (${response.status})` }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    console.error('Failed to persist GitHub token:', error);
    return json({ error: 'Failed to persist token' }, { status: 500 });
  }
}
