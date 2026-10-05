"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  getAuthSnapshot,
  getServerSnapshot,
  signOut,
  subscribeAuth,
} from "@/lib/auth";

/**
 * Header widget: "Sign in" when signed out, first name + sign out when in.
 */
export function AccountChip() {
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

  return (
    <span className="inline-flex items-center gap-2">
      <span className="chip chip-static" title={student.email}>
        <span className="size-1.5 rounded-full bg-accent" aria-hidden />
        {student.name.split(" ")[0]}
      </span>
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
