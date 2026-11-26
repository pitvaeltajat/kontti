import Link from 'next/link';
import Image from 'next/image';
import { CartButton } from '@/components/cart-button';
import { isEventAdmin, type Role } from '@/lib/admin';

export function SiteHeader({ role, pathname }: { role?: string; pathname: string }) {
  const r = (role ?? null) as Role | null;
  const showAdmin = isEventAdmin(r); // event admins + superadmins
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <header className="sticky top-0 z-40 border-b bg-header text-header-foreground shadow-sm">
      <div className="container flex h-14 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
            <Image src="/icon.svg" alt="" width={28} height={28} className="rounded" priority />
            <span className="truncate text-sm md:text-base">Kontti</span>
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            <Link
              href="/"
              aria-current={isActive('/') ? 'page' : undefined}
              className="text-sm text-header-foreground/80 hover:text-header-foreground hover:underline"
            >
              Etusivu
            </Link>
            <Link
              href="/kammi"
              aria-current={isActive('/kammi') ? 'page' : undefined}
              className="text-sm text-header-foreground/80 hover:text-header-foreground hover:underline"
            >
              Kammin varaus
            </Link>
            {showAdmin && (
              <Link
                href="/admin"
                aria-current={isActive('/admin') ? 'page' : undefined}
                className="text-sm font-semibold text-cta hover:underline"
              >
                Hallinta
              </Link>
            )}
          </nav>
        </div>
        <CartButton />
      </div>
      {/* Mobile navigation */}
      <nav className="container flex gap-3 overflow-x-auto pb-2 md:hidden">
        <Link
          href="/"
          aria-current={isActive('/') ? 'page' : undefined}
          className="shrink-0 text-xs text-header-foreground/80 hover:underline"
        >
          Etusivu
        </Link>
        <Link
          href="/kammi"
          aria-current={isActive('/kammi') ? 'page' : undefined}
          className="shrink-0 text-xs text-header-foreground/80 hover:underline"
        >
          Kammin varaus
        </Link>
        {showAdmin && (
          <Link
            href="/admin"
            aria-current={isActive('/admin') ? 'page' : undefined}
            className="shrink-0 text-xs font-semibold text-cta hover:underline"
          >
            Hallinta
          </Link>
        )}
      </nav>
    </header>
  );
}
