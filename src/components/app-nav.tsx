"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  getAuthSnapshot,
  getServerSnapshot,
  subscribeAuth,
} from "@/lib/auth";
import { Monogram } from "@/components/logo";
import { AccountChip } from "@/components/account-chip";

/**
 * The signed-in top bar: time-aware greeting plus Home / My Projects /
 * Roadmap / Skill Gap. Rendered from the root layout so every authed page
 * shares it; returns null while signed out so landing/login/footer stay
 * untouched.
 *
 * Roadmap and Skill Gap deep-link into the analysis tabs on /result — that
 * page reads ?tab= on mount (window.location, no useSearchParams/Suspense).
 */
const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/my-projects", label: "My Projects" },
  { href: "/result?tab=roadmap", label: "Roadmap" },
  { href: "/result?tab=skillgap", label: "Skill Gap" },
];

/**
 * "Good morning" 05:00–11:59 · "Good afternoon" 12:00–16:59 ·
 * "Good evening" the rest (17:00–04:59, including the small hours).
 * Client-side by design: the bar only renders once signed in, so there is
 * no server HTML for this string to disagree with on hydration.
 */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export function AppNav() {
  const student = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getServerSnapshot,
  );
  const pathname = usePathname();

  if (!student) return null;

  function isActive(href: string): boolean {
    const path = href.split("?")[0];
    if (path === "/result") return pathname === "/result";
    return pathname === path;
  }

  return (
    <div className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Monogram size={26} glow={false} />
          <span className="hidden text-sm font-semibold tracking-wide sm:inline">
            ProjectsForge
          </span>
        </Link>

        <span className="text-sm text-mist">
          {greetingFor(new Date().getHours())},{" "}
          <span className="font-semibold text-chalk">{student.name}</span>
        </span>

        <nav className="flex flex-wrap items-center gap-1 sm:ml-auto">
          {NAV_ITEMS.map((item) => {
            // Plain anchors for the ?tab= links: on /result a client-side Link
            // to the same path would not remount the page, so the lazy tab
            // state would never re-read the URL. Full loads cost nothing here.
            const fullLoad = item.href.startsWith("/result");
            const className = `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              isActive(item.href)
                ? "bg-accent/15 text-accent"
                : "text-mist hover:bg-panel-2/70 hover:text-chalk"
            }`;
            return fullLoad ? (
              <a key={item.href} href={item.href} className={className}>
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className={className}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sm:ml-2">
          <AccountChip />
        </div>
      </div>
    </div>
  );
}
