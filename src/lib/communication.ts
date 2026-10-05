/**
 * Curated Communication Skills material — visible once the student has
 * completed a project. Like resources.ts this is content, not model output:
 * every link was hand-picked and HTTP-verified at curation time (videos are
 * either direct watch links or search links that are valid by construction).
 */

import { youtube, type Resource } from "./resources";

export interface CommTopic {
  id: string;
  title: string;
  blurb: string;
  /** 3-4 concrete, checkable tips — no platitudes. */
  points: string[];
  resources: Resource[];
}

export const COMM_TOPICS: CommTopic[] = [
  {
    id: "introduce",
    title: "Introduce yourself in 45 seconds",
    blurb: "The first question in almost every interview: “Tell me about yourself.”",
    points: [
      "Open with name, branch, year and college — one sentence, no hesitation.",
      "Follow with two or three skills you have actually used in a project.",
      "Close with your career goal and why it fits this role.",
      "Read your generated self-introduction aloud daily until it sounds natural, not memorised.",
    ],
    resources: [
      {
        title: "Coursera — common interview questions",
        url: "https://www.coursera.org/articles/common-interview-questions",
        kind: "docs",
      },
      youtube("how to introduce yourself in an interview for freshers"),
      {
        title: "BBC Learning English — speaking practice",
        url: "https://www.bbc.co.uk/learningenglish",
        kind: "practice",
      },
    ],
  },
  {
    id: "project",
    title: "Explain what you built",
    blurb: "“Walk me through your project” — the question your whole roadmap prepares you for.",
    points: [
      "Four beats: the problem → what you built → the hardest technical decision → what you would change.",
      "Keep the opening to about 90 seconds, then invite follow-ups instead of dumping detail.",
      "Be exact about YOUR part — claiming the whole team's work collapses under two questions.",
      "Demo using your roadmap's block diagram: a visual explanation beats a feature list.",
    ],
    resources: [
      {
        title: "GeeksforGeeks — how to explain your project in an interview",
        url: "https://www.geeksforgeeks.org/blogs/how-to-explain-your-project-in-an-interview-steps-and-tips/",
        kind: "docs",
      },
      {
        title: "freeCodeCamp — how to talk about your side projects",
        url: "https://www.freecodecamp.org/news/how-to-talk-about-your-side-projects-18b96f192817/",
        kind: "docs",
      },
      youtube("how to explain your project in an interview"),
    ],
  },
  {
    id: "technical",
    title: "Handle technical questions",
    blurb: "They are testing how you think, not whether you memorised an answer.",
    points: [
      "Think out loud — a clear process impresses more than a silent correct answer.",
      "For “why this tech?” name the trade-off, not just the feature you liked.",
      "Stuck? State what you do know, then reason step by step — never bluff.",
      "Practise timed problems where you explain your solution as you solve it.",
    ],
    resources: [
      {
        title: "freeCodeCamp — problem-solving & technical interview prep",
        url: "https://www.freecodecamp.org/news/problem-solving-and-technical-interview-prep/",
        kind: "docs",
      },
      {
        title: "freeCodeCamp — interview articles",
        url: "https://www.freecodecamp.org/news/tag/interviews/",
        kind: "practice",
      },
      youtube("technical interview preparation for freshers"),
    ],
  },
  {
    id: "behavioural",
    title: "Behavioural questions — the STAR method",
    blurb: "“Tell me about a time when…” stories with a fixed, easy structure.",
    points: [
      "STAR: Situation → Task → Action → Result — one short story per question.",
      "Spend most of the time on Action: what YOU did, in past tense, no “we”.",
      "Quantify the result when you can — time saved, users reached, errors cut.",
      "Prepare 3-4 stories in advance: a conflict, a deadline, a failure, an initiative.",
    ],
    resources: [
      {
        title: "Coursera — STAR interview questions",
        url: "https://www.coursera.org/articles/star-interview-questions",
        kind: "docs",
      },
      {
        title: "National Careers Service — the STAR method",
        url: "https://nationalcareers.service.gov.uk/careers-advice/interview-advice/the-star-method",
        kind: "docs",
      },
      {
        title: "MIT — STAR worksheet for behavioural interviews",
        url: "https://capd.mit.edu/resources/the-star-method-for-behavioral-interviews/",
        kind: "docs",
      },
      youtube("STAR method interview answers examples"),
    ],
  },
];
