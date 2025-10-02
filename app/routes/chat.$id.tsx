import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { default as IndexRoute } from './_index';
import { requireUserId } from '~/utils/clerk.server';

export async function loader(args: LoaderFunctionArgs) {
  await requireUserId(args);

  return json({ id: args.params.id });
}

export default IndexRoute;
