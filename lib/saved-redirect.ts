/** Append a flash `saved` key to a redirect path, preserving any query params. */
export function savedRedirect(path: string, key: string): string {
  const [base, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('saved', key);
  return `${base}?${params.toString()}`;
}