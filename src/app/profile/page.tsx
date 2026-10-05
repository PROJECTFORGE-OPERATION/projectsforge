"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore, useEffect, useRef, useState } from "react";
import {
  BRANCHES,
  CAREER_GOALS,
  INTERESTS,
  SKILL_SUGGESTIONS,
  YEARS,
  type AnalyzeResponse,
  type Branch,
  type CareerGoal,
  type Interest,
  type Year,
} from "@/lib/types";
import {
  getDraftSnapshot,
  getServerSnapshot,
  saveDraft,
  saveRun,
  subscribeDraft,
} from "@/lib/session";
import {
  authResolved,
  getAuthSnapshot,
  getServerResolvedSnapshot,
  getServerSnapshot as getAuthServerSnapshot,
  subscribeAuth,
} from "@/lib/auth";
import { Monogram } from "@/components/logo";
import { AccountChip } from "@/components/account-chip";

type FieldErrors = Partial<
  Record<"branch" | "year" | "interests" | "careerGoal", string>
>;

/**
 * Local edits are stored as nullable overrides; untouched fields fall back to
 * the saved draft (loaded via useSyncExternalStore) after hydration. This
 * prefills "Edit profile" without a setState-in-effect or hydration mismatch.
 */
interface FormState {
  branch: Branch | null;
  year: Year | null;
  hobbies: string | null;
  schooling: string | null;
  college: string | null;
  skills: string[] | null;
  interests: Interest[] | null;
  careerGoal: CareerGoal | null;
  weeks: number | null;
}

const EMPTY_FORM: FormState = {
  branch: null,
  year: null,
  hobbies: null,
  schooling: null,
  college: null,
  skills: null,
  interests: null,
  careerGoal: null,
  weeks: null,
};

export default function ProfilePage() {
  const router = useRouter();
  const draft = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerSnapshot);
  const student = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
  );

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [skillInput, setSkillInput] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Effective values: local edit > saved draft > empty default.
  const branch = form.branch ?? draft?.profile.branch ?? "";
  const year = form.year ?? draft?.profile.year ?? "";
  const hobbies = form.hobbies ?? draft?.profile.hobbies ?? "";
  const schooling = form.schooling ?? draft?.profile.schooling ?? "";
  const college = form.college ?? draft?.profile.college ?? "";
  const skills = form.skills ?? draft?.profile.skills ?? [];
  const interests = form.interests ?? draft?.profile.interests ?? [];
  const careerGoal = form.careerGoal ?? draft?.profile.careerGoal ?? "";
  const weeks = form.weeks ?? draft?.profile.availableWeeks ?? 4;

  // Elapsed-seconds ticker while the AI model is thinking.
  useEffect(() => {
    if (!submitting) return;
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [submitting]);

  // Students must be signed in before building a profile — and are sent back
  // to login if they sign out while on this page.
  // Reads the store directly instead of trusting `student`: during hydration
  // the hook still returns the server snapshot (null) when effects fire, which
  // would falsely redirect even though Firebase still has a session. Requiring
  // BOTH the store and the hook to be null keeps hydration safe — while
  // `authReady` (a subscription of its own) re-runs this effect the moment
  // Firebase resolves its first state. Without it the first run could see
  // "not resolved yet" and never fire again, because flipping resolved with a
  // null store doesn't change the student snapshot.
  const authReady = useSyncExternalStore(
    subscribeAuth,
    authResolved,
    getServerResolvedSnapshot,
  );
  useEffect(() => {
    if (authReady && getAuthSnapshot() === null && student === null)
      router.replace("/login");
  }, [authReady, student, router]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addSkill(raw: string) {
    const value = raw.trim().replace(/,$/, "");
    if (!value || skills.length >= 25) return;
    if (skills.some((s) => s.toLowerCase() === value.toLowerCase())) return;
    patch("skills", [...skills, value]);
    setSkillInput("");
  }

  function toggleInterest(interest: Interest) {
    if (interests.includes(interest)) {
      patch(
        "interests",
        interests.filter((i) => i !== interest),
      );
    } else if (interests.length < 5) {
      patch("interests", [...interests, interest]);
    }
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!branch) found.branch = "Pick your branch.";
    if (!year) found.year = "Pick your year.";
    if (interests.length === 0) found.interests = "Choose at least one interest.";
    if (!careerGoal) found.careerGoal = "Choose your career goal.";
    return found;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById("profile-form")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const payload = {
      branch,
      year,
      skills,
      interests,
      careerGoal,
      availableWeeks: weeks,
      hobbies,
      schooling,
      college,
    };

    setSubmitting(true);
    setElapsed(0);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        // The API answers inside its 60s function cap; this only trips if the
        // connection itself hangs, so a stuck spinner can't run forever.
        signal: AbortSignal.timeout(150_000),
      });
      // A platform-level kill (e.g. a serverless 504) can come back with a
      // non-JSON body — parse defensively so that still surfaces loudly.
      const data = (await res.json().catch(() => null)) as
        | AnalyzeResponse
        | { error: string }
        | null;

      if (!res.ok) {
        setServerError(
          data && "error" in data && typeof data.error === "string"
            ? data.error
            : `Analysis failed — the server returned ${res.status} without details.`,
        );
        return;
      }

      if (!data || !("analysis" in data)) {
        setServerError("Analysis failed — the server returned an unexpected response.");
        return;
      }

      const run = data as AnalyzeResponse;
      saveRun(run);
      saveDraft(run);
      router.push("/result");
    } catch (cause) {
      const timedOut =
        cause instanceof DOMException &&
        (cause.name === "TimeoutError" || cause.name === "AbortError");
      setServerError(
        timedOut
          ? "The analysis took too long and was cancelled — please try again."
          : "Could not reach the server — check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
  }

  const rangePct = ((weeks - 1) / 15) * 100;

  if (!student) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
        <p className="text-sm text-mist">Sign in required — taking you to the login page…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16">
      <header className="flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Monogram size={30} glow={false} />
          <span className="text-sm font-semibold tracking-wide">ProjectsForge</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-mist">Step 1 of 2 · Student Profile</span>
          <AccountChip />
        </div>
      </header>

      <form id="profile-form" onSubmit={handleSubmit} className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Tell us about yourself
        </h1>
        <p className="mt-2 text-sm text-mist">
          The more precise this is, the more personal the recommendation, skill gap
          and roadmap become.
        </p>

        {/* Branch ------------------------------------------------------- */}
        <section className="card mt-7 p-5">
          <span className="label">Branch</span>
          <div className="flex flex-wrap gap-2">
            {BRANCHES.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => patch("branch", b)}
                className={`chip ${branch === b ? "chip-on" : ""}`}
              >
                {b}
              </button>
            ))}
          </div>
          {errors.branch && <p className="mt-2 text-xs text-danger">{errors.branch}</p>}
        </section>

        {/* Year --------------------------------------------------------- */}
        <section className="card mt-4 p-5">
          <span className="label">Year</span>
          <div className="flex flex-wrap gap-2">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => patch("year", y)}
                className={`chip ${year === y ? "chip-on" : ""}`}
              >
                {y}
              </button>
            ))}
          </div>
          {errors.year && <p className="mt-2 text-xs text-danger">{errors.year}</p>}
        </section>

        {/* Background (hobbies / schooling / college) ---------------------- */}
        <section className="card mt-4 p-5">
          <span className="label">Your background</span>
          <p className="text-xs text-mist">
            Used to write your self-introduction for interviews. All three are
            optional — fill what you can.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs text-mist">Hobbies</span>
              <input
                className="field mt-1"
                value={hobbies}
                placeholder="e.g. Cricket, drawing, chess"
                maxLength={300}
                onChange={(e) => patch("hobbies", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-mist">Schooling</span>
              <input
                className="field mt-1"
                value={schooling}
                placeholder="e.g. Sri Chaitanya Jr College (10th & 12th)"
                maxLength={300}
                onChange={(e) => patch("schooling", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs text-mist">College</span>
              <input
                className="field mt-1"
                value={college}
                placeholder="e.g. JNTU Kakinada"
                maxLength={300}
                onChange={(e) => patch("college", e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* Skills ------------------------------------------------------- */}
        <section className="card mt-4 p-5">
          <span className="label">Skills you already have</span>
          <div className="flex gap-2">
            <input
              className="field"
              value={skillInput}
              placeholder="Type a skill and press Enter"
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addSkill(skillInput);
                }
              }}
            />
            <button
              type="button"
              onClick={() => addSkill(skillInput)}
              className="btn btn-ghost shrink-0"
            >
              Add
            </button>
          </div>

          {skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="tag">
                  {skill}
                  <button
                    type="button"
                    onClick={() =>
                      patch(
                        "skills",
                        skills.filter((s) => s !== skill),
                      )
                    }
                    aria-label={`Remove ${skill}`}
                    className="text-sky/70 hover:text-sky"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-4">
            <span className="text-xs text-mist">Suggestions:</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SKILL_SUGGESTIONS.filter(
                (s) => !skills.some((k) => k.toLowerCase() === s.toLowerCase()),
              ).map((s) => (
                <button key={s} type="button" onClick={() => addSkill(s)} className="chip">
                  + {s}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Interests ---------------------------------------------------- */}
        <section className="card mt-4 p-5">
          <span className="label">Interests (pick up to 5)</span>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className={`chip ${interests.includes(interest) ? "chip-on" : ""}`}
              >
                {interest}
              </button>
            ))}
          </div>
          {errors.interests && (
            <p className="mt-2 text-xs text-danger">{errors.interests}</p>
          )}
        </section>

        {/* Career goal --------------------------------------------------- */}
        <section className="card mt-4 p-5">
          <span className="label">Career goal</span>
          <div className="flex flex-wrap gap-2">
            {CAREER_GOALS.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => patch("careerGoal", goal)}
                className={`chip ${careerGoal === goal ? "chip-on" : ""}`}
              >
                {goal}
              </button>
            ))}
          </div>
          {errors.careerGoal && (
            <p className="mt-2 text-xs text-danger">{errors.careerGoal}</p>
          )}
        </section>

        {/* Time ---------------------------------------------------------- */}
        <section className="card mt-4 p-5">
          <div className="flex items-baseline justify-between">
            <span className="label mb-0">Available time</span>
            <span className="font-mono text-2xl font-bold text-accent">
              {weeks}
              <span className="ml-1 text-sm font-medium text-mist">weeks</span>
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={16}
            value={weeks}
            onChange={(e) => patch("weeks", Number(e.target.value))}
            className="mt-4"
            style={{ "--range-pct": `${rangePct}%` } as React.CSSProperties}
            aria-label="Available weeks"
          />
          <div className="mt-2 flex justify-between text-xs text-mist">
            <span>1 week</span>
            <span>16 weeks</span>
          </div>
        </section>

        {/* Errors + submit ---------------------------------------------- */}
        {serverError && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger"
          >
            <span className="font-semibold">AI engine error:</span> {serverError}
            <p className="mt-1 text-xs opacity-80">
              This app has no canned fallback — fix the engine and retry.
            </p>
          </div>
        )}

        <div className="mt-7 flex items-center justify-between gap-4">
          <Link href="/" className="btn btn-ghost">
            ← Back
          </Link>
          <button type="submit" disabled={submitting} className="btn btn-accent min-w-52">
            {submitting ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
                Analyzing · {elapsed}s
              </>
            ) : (
              <>
                Analyze my profile <span aria-hidden>→</span>
              </>
            )}
          </button>
        </div>

        {submitting && (
          <p className="mt-4 text-center text-xs text-mist">
            Running the AI model — recommendation, skill gap and roadmap in one
            pass. Responses usually take 15–60 seconds.
          </p>
        )}
      </form>
    </div>
  );
}
