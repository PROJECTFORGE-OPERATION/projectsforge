import type { ProjectRecord } from "./projects";
import type { Analysis, StudentProfile } from "./types";
import type { ChatMessage } from "./ollama";

export function buildMessages(
  profile: StudentProfile,
  candidates: ProjectRecord[],
): ChatMessage[] {
  const weeks = profile.availableWeeks;

  const system = `You are ProjectsForge, an academic project advisor for engineering students.

Given ONE student profile and a curated list of candidate projects, produce a precise, personalized analysis.

STRICT RULES
1. Select exactly ONE primary project and TWO or THREE alternatives. Every id MUST come from the candidate list and no id may repeat. Never invent projects.
2. whyMatched must quote concrete profile facts (branch, year, listed skills, interests, career goal, available weeks) and explain why this project fits THIS student. Generic filler is a failure.
3. matchScore is an integer 0-100 reflecting fit with this exact profile. Alternatives are usually lower than the primary.
4. skillGap.alreadyKnown contains ONLY skills the student listed (an empty array is valid).
5. skillGap.needToLearn covers the primary project's required skills the student is missing, plus at most 2 nice-to-haves. Each entry needs priority (high|medium|low) and a one-line reason.
6. roadmap must contain exactly ${weeks} weeks, numbered 1..${weeks}. Front-load learning (first ~40% of weeks), then building, then integration/testing/demo. Every week needs focus, learn[] (1-3 topics), build (what gets constructed) and deliverable (a checkable outcome).
7. prerequisites lists what the student should have before week 1.
8. nextStep is "Start learning" if any high-priority prerequisite skill is missing, otherwise "Start project".
9. risks and assumptions: 2-4 short, honest bullets each (hardware access, time estimates, data/API dependencies, skill level).
10. Write concise, concrete English. Output raw JSON only.`;

  const user = `STUDENT PROFILE
${JSON.stringify(profile, null, 2)}

CANDIDATE PROJECTS (the only ids you may use)
${JSON.stringify(candidates, null, 2)}

Produce the analysis JSON now.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/**
 * Business rules enforced on every model reply. Returning a string triggers a
 * corrective retry; returning null accepts the reply.
 */
export function makeValidator(
  profile: StudentProfile,
  candidates: ProjectRecord[],
): (value: Analysis) => string | null {
  const ids = new Set(candidates.map((c) => c.id));
  return (value: Analysis): string | null => {
    if (!ids.has(value.primary.id)) {
      return `primary.id "${value.primary.id}" is not in the candidate list`;
    }
    const seen = new Set<string>([value.primary.id]);
    for (const alt of value.alternatives) {
      if (!ids.has(alt.id)) {
        return `alternative id "${alt.id}" is not in the candidate list`;
      }
      if (seen.has(alt.id)) {
        return `id "${alt.id}" is used more than once`;
      }
      seen.add(alt.id);
    }
    if (value.alternatives.length < 2) {
      return "there must be at least 2 alternatives";
    }
    if (value.roadmap.length < profile.availableWeeks) {
      return `roadmap must have exactly ${profile.availableWeeks} weeks, got ${value.roadmap.length}`;
    }
    if (value.skillGap.needToLearn.length < 1) {
      return "skillGap.needToLearn must contain at least one skill";
    }
    return null;
  };
}
