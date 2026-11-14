// Links that open the app from outside (e.g. the Expo Go / EAS Update QR code, whose URL has
// a path like /group/<id>) must not be read as app routes. Only our own deep links
// (resaletracker://items/..., etc.) are kept; anything else starts at Home, which redirects
// to sign-in when needed.
const SCHEME = 'resaletracker://';
const APP_PREFIXES = ['/trips', '/items', '/insights', '/more', '/sale', '/what-if'];

export function appPathFor(path: string): string {
  if (!path.startsWith(SCHEME)) return '/';
  const rest = '/' + path.slice(SCHEME.length).replace(/^\/+/, '');
  const pathname = rest.split('?')[0];
  return APP_PREFIXES.some((x) => pathname === x || pathname.startsWith(x + '/')) ? rest : '/';
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return appPathFor(path);
  } catch {
    return '/';
  }
}
