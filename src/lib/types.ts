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
  candidateCount: number;
  elapsedMs: number;
}

/** What the API returns on failure. */
export interface ErrorResponse {
  error: string;
  issues?: string[];
}
