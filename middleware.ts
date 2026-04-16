import { rewrite, next } from '@vercel/functions';

export const config = {
  matcher: '/',
};

export default function middleware(request: Request) {
  const url = new URL(request.url);

  // Only intercept when there is a ?share=... query param on the root URL.
  if (!url.searchParams.has('share')) {
    return next();
  }

  // Rewrite to the /api/preview serverless function, forwarding the query string.
  const target = new URL('/api/preview', url.origin);
  target.search = url.search;
  return rewrite(target);
}
