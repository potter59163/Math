'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { BookIcon, GearIcon, TrophyIcon, UserIcon } from '@/components/ui/Icons';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { Mascot } from './Mascot';

const TABS: { href: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { href: '/learn', label: th.tabs.learn, Icon: BookIcon },
  { href: '/leaderboard', label: th.tabs.leaderboard, Icon: TrophyIcon },
  { href: '/profile', label: th.tabs.profile, Icon: UserIcon },
  { href: '/settings', label: th.tabs.settings, Icon: GearIcon },
];

/**
 * Along the bottom on a phone, where a thumb reaches it. On anything wider it runs down the side, with
 * a notebook's red margin line between it and the page.
 */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={th.tabs.nav}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:top-0 md:left-0 md:flex md:w-56 md:flex-col md:gap-6 md:border-t-0 md:border-r-2 md:border-margin md:p-4"
    >
      <div className="hidden items-center gap-2 px-2 pt-1 md:flex">
        <Mascot className="size-9 -rotate-3" />
        <span className="font-display text-2xl leading-tight font-semibold tracking-tight">
          {CONFIG.appName}
        </span>
      </div>
      <ul className="mx-auto grid max-w-lg grid-cols-4 md:mx-0 md:flex md:flex-col md:gap-1">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand md:min-h-12 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-base ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="size-6" />
                <span className={active ? 'marker font-semibold' : ''}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
