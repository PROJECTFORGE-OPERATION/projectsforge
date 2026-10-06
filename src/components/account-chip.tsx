"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  getAuthSnapshot,
  getServerSnapshot,
  signOut,
  subscribeAuth,
} from "@/lib/auth";
import { FOUNDER_EMAIL } from "@/lib/founder";

/**
 * Header widget: "Sign in" when signed out, first name + sign out when in.
 * `hideWhenSignedIn` drops the in-state widget for headers that sit under the
 * authed AppNav (which carries its own chip) — avoids two "Sign out" buttons.
 */
export function AccountChip({ hideWhenSignedIn = false }: { hideWhenSignedIn?: boolean }) {
  const student = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getServerSnapshot,
  );

  if (!student) {
    return (
      <Link href="/login" className="chip">
        Sign in
      </Link>
    );
  }

  if (hideWhenSignedIn) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="chip chip-static" title={student.email}>
        <span className="size-1.5 rounded-full bg-accent" aria-hidden />
        {student.name.split(" ")[0]}
      </span>
      {student.email.toLowerCase() === FOUNDER_EMAIL && (
        <Link href="/founder" className="chip">
          Founder
        </Link>
      )}
      <button
        type="button"
        className="chip"
        onClick={() => {
          signOut();
        }}
      >
        Sign out
      </button>
    </span>
  );
}
