/**
 * Admin endpoint authentication. Use x-citestack-admin-secret header or
 * Authorization: Bearer <secret>. Do not pass secret via URL params.
 */
export function getAdminSecret(request: Request): string | null {
  const header = request.headers.get('x-citestack-admin-secret');
  if (header) return header;
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}
