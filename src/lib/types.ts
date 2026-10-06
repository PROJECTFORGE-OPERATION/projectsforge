import { z } from "zod";

// ---------------------------------------------------------------------------
// Option catalogs (single source of truth for the form UI and validation)
// ---------------------------------------------------------------------------

export const BRANCHES = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"] as const;
export type Branch = (typeof BRANCHES)[number];

export const YEARS = ["1st year", "2nd year", "3rd year", "4th year"] as const;
export type Year = (typeof YEARS)[number];

export const INTERESTS = [
  "AI / ML",
  "Web Development",
  "Mobile Apps",
  "IoT & Embedded",
  "Data Science",
  "Cybersecurity",
  "Robotics",
  "Cloud & DevOps",
  "Game Development",
  "UI / UX Design",
] as const;
export type Interest = (typeof INTERESTS)[number];

export const CAREER_GOALS = [
  "Placement / Job",
  "Higher Studies",
  "Startup / Freelancing",
  "Research",
  "Government Exams",
] as const;
export type CareerGoal = (typeof CAREER_GOALS)[number];

export const SKILL_SUGGESTIONS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "C",
  "C++",
  "HTML/CSS",
  "React",
  "Node.js",
  "SQL",
  "Git",
  "Arduino",
  "Raspberry Pi",
  "Machine Learning",
  "Pandas",
  "Docker",
  "Figma",
] as const;

export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** "1st year" -> 1 */
export function yearNumber(year: Year): number {
  return Number.parseInt(year.slice(0, 1), 10) || 1;
}

// ---------------------------------------------------------------------------
// Input: student profile
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  branch: z.enum(BRANCHES),
  year: z.enum(YEARS),
  skills: z.array(z.string().trim().min(1)).max(25),
  interests: z.array(z.enum(INTERESTS)).min(1).max(5),
  careerGoal: z.enum(CAREER_GOALS),
  availableWeeks: z.number().int().min(1).max(16),
  // Background asked at profile time (hobbies / schooling / college) — feeds
  // the self-introduction generator. Optional with a default so older stored
  // drafts and minimal API callers still validate cleanly.
  hobbies: z.string().trim().max(300).default(""),
  schooling: z.string().trim().max(300).default(""),
  college: z.string().trim().max(300).default(""),
});
export type StudentProfile = z.infer<typeof profileSchema>;

// ---------------------------------------------------------------------------
// Output: the AI analysis (validated with zod after every model call)
// ---------------------------------------------------------------------------

export const recommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  whyMatched: z.string(),
  matchScore: z.number().min(0).max(100),
  difficulty: z.enum(DIFFICULTIES),
  technologies: z.array(z.string()).min(1),
  estimatedWeeks: z.number().min(1),
  prerequisites: z.array(z.string()).min(1),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const skillGapSchema = z.object({
  alreadyKnown: z.array(z.string()),
  needToLearn: z
    .array(
      z.object({
        skill: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        why: z.string(),
      }),
    )
    .min(1),
});
export type SkillGap = z.infer<typeof skillGapSchema>;

export const roadmapWeekSchema = z.object({
  week: z.number(),
  focus: z.string(),
  learn: z.array(z.string()),
  build: z.string(),
  deliverable: z.string(),
});
export type RoadmapWeek = z.infer<typeof roadmapWeekSchema>;

export const analysisSchema = z.object({
  primary: recommendationSchema,
  alternatives: z.array(recommendationSchema),
  skillGap: skillGapSchema,
  roadmap: z.array(roadmapWeekSchema),
  nextStep: z.enum(["Start learning", "Start project"]),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),
});
export type Analysis = z.infer<typeof analysisSchema>;

/**
 * Per-request schema with array lengths baked in, so Ollama's constrained
 * decoding structurally FORBIDS an empty roadmap or missing alternatives.
 * Static `analysisSchema` gives the type; this gives the guarantee.
 */
export function makeAnalysisSchema(weeks: number) {
  return z.object({
    primary: recommendationSchema,
    alternatives: z.array(recommendationSchema).min(2).max(3),
    skillGap: skillGapSchema,
    roadmap: z.array(roadmapWeekSchema).min(weeks).max(weeks),
    nextStep: z.enum(["Start learning", "Start project"]),
    risks: z.array(z.string()).min(2),
    assumptions: z.array(z.string()).min(2),
  });
}

/** What the API returns on success. */
export interface AnalyzeResponse {
  profile: StudentProfile;
  analysis: Analysis;
  model: string;
  /** Which engine produced this analysis (absent on pre-dual-mode runs). */
  provider?: "ollama" | "gemini";
  candidateCount: number;
  elapsedMs: number;
  /**
   * Phase 2: false when the analysis rendered but the Firestore save failed
   * (the failure is also logged server-side — never silent).
   */
  persisted?: boolean;
}

/** What the API returns on failure. */
export interface ErrorResponse {
  error: string;
  issues?: string[];
}

/**
 * Self-introduction generator output. Length bounds live in the schema so the
 * constrained decoder can never emit a one-line stub or a multi-page essay.
 */
export const introductionSchema = z.object({
  introduction: z.string().min(80).max(1600),
});
export type Introduction = z.infer<typeof introductionSchema>;

/** Request body for POST /api/intro (name is not part of the profile). */
export const introRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  profile: profileSchema,
  /**
   * Client-computed profile fingerprint (records.ts introSignature) — stored
   * alongside the text so a profile edit can tell the intro is stale.
   */
  signature: z.string().min(1).max(16000),
});
export type IntroRequest = z.infer<typeof introRequestSchema>;

/* --- portfolio records (Phase 2: Firestore-backed) ---------------------- */

/** Profile fingerprint the intro text was generated from — mismatch = stale. */
export interface StoredIntro {
  text: string;
  signature: string;
  generatedAt: string;
}

/** Interview-ready record of a project the student marked complete. */
export interface CompletionRecord {
  id: string;
  title: string;
  technologies: string[];
  skillsCovered: string[];
  weeks: number;
  completedAt: string;
}

export const storedIntroSchema = z.object({
  text: z.string().min(1).max(8000),
  signature: z.string().min(1).max(16000),
  generatedAt: z.string().max(60),
});

export const completionRecordSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  technologies: z.array(z.string().max(120)).max(40),
  skillsCovered: z.array(z.string().max(120)).max(80),
  weeks: z.number().int().min(0).max(520),
  completedAt: z.string().max(60),
});

/** Request body for POST /api/records. */
export const recordsRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete"), record: completionRecordSchema }),
  z.object({
    action: z.literal("migrate"),
    completions: z.array(completionRecordSchema).max(200),
    intro: storedIntroSchema.nullable().optional(),
  }),
]);
export type RecordsRequest = z.infer<typeof recordsRequestSchema>;

/** What GET /api/records returns — one round trip for every records view. */
export interface RecordsResponse {
  profile: StudentProfile | null;
  intro: StoredIntro | null;
  completions: CompletionRecord[];
  run: AnalyzeResponse | null;
  runCount: number;
  introCount: number;
}
