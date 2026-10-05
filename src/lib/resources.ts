/**
 * Curated learning resources attached to roadmap weeks.
 *
 * These links are hand-picked and stable (official docs, established course
 * sites, search fallbacks) — they are content, not model output, so nothing
 * here can hallucinate a dead URL. Topics from the AI roadmap are matched
 * against this table; when nothing matches we fall back to search links that
 * are valid by construction.
 */

import type { RoadmapWeek } from "./types";

export type ResourceKind = "docs" | "course" | "video" | "practice";

export interface Resource {
  title: string;
  url: string;
  kind: ResourceKind;
}

export const KIND_LABEL: Record<ResourceKind, string> = {
  docs: "Docs",
  course: "Course",
  video: "Video",
  practice: "Practice",
};

export function youtube(query: string): Resource {
  return {
    title: `YouTube: ${query}`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    kind: "video",
  };
}

/**
 * Direct YouTube link. IDs are verified via the oEmbed endpoint at curation
 * time — an invalid id returns 404 there, so these cannot be hallucinated.
 */
export function directVideo(id: string, title: string): Resource {
  return { title, url: `https://www.youtube.com/watch?v=${id}`, kind: "video" };
}

function webSearch(query: string): Resource {
  return {
    title: `Web results: ${query}`,
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    kind: "practice",
  };
}

interface Rule {
  test: RegExp;
  items: Resource[];
}

const RULES: Rule[] = [
  {
    test: /\bpython\b|flask|django|fastapi/i,
    items: [
      { title: "Python official tutorial", url: "https://docs.python.org/3/tutorial/", kind: "docs" },
      { title: "freeCodeCamp — Python", url: "https://www.freecodecamp.org/learn/scientific-computing-with-python/", kind: "course" },
      directVideo("eWRfhZUzrAc", "Python for Beginners — full course (freeCodeCamp)"),
    ],
  },
  {
    test: /\bjavascript\b|\bjs\b|es6|dom/i,
    items: [
      { title: "JavaScript.info — modern tutorial", url: "https://javascript.info/", kind: "docs" },
      { title: "MDN — JavaScript guide", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide", kind: "docs" },
      directVideo("PkZNo7MFNFg", "Learn JavaScript — full course for beginners (freeCodeCamp)"),
    ],
  },
  {
    test: /typescript/i,
    items: [
      { title: "TypeScript handbook", url: "https://www.typescriptlang.org/docs/handbook/intro.html", kind: "docs" },
      youtube("typescript project tutorial"),
    ],
  },
  {
    test: /react/i,
    items: [
      { title: "React — Learn", url: "https://react.dev/learn", kind: "docs" },
      { title: "roadmap.sh — React", url: "https://roadmap.sh/react", kind: "course" },
      directVideo("DLX62G4lc44", "Learn React JS — full course for beginners (freeCodeCamp)"),
    ],
  },
  {
    test: /next(\.js|js)?\b|server component/i,
    items: [
      { title: "Next.js — Learn", url: "https://nextjs.org/learn", kind: "course" },
      { title: "Next.js docs", url: "https://nextjs.org/docs", kind: "docs" },
    ],
  },
  {
    test: /html|markup/i,
    items: [
      { title: "MDN — HTML basics", url: "https://developer.mozilla.org/en-US/docs/Web/HTML", kind: "docs" },
      { title: "W3Schools — HTML", url: "https://www.w3schools.com/html/", kind: "practice" },
    ],
  },
  {
    test: /\bcss\b|flexbox|grid|sass/i,
    items: [
      { title: "MDN — CSS reference", url: "https://developer.mozilla.org/en-US/docs/Web/CSS", kind: "docs" },
      { title: "Flexbox Froggy", url: "https://flexboxfroggy.com/", kind: "practice" },
    ],
  },
  {
    test: /tailwind/i,
    items: [
      { title: "Tailwind CSS docs", url: "https://tailwindcss.com/docs", kind: "docs" },
      directVideo("lCxcTsOHrjo", "Tailwind CSS full course (Dave Gray)"),
    ],
  },
  {
    test: /\bnode\b|nodejs/i,
    items: [
      { title: "Node.js — Learn", url: "https://nodejs.org/en/learn", kind: "docs" },
      { title: "roadmap.sh — Node.js", url: "https://roadmap.sh/nodejs", kind: "course" },
    ],
  },
  {
    test: /express/i,
    items: [
      { title: "Express guide", url: "https://expressjs.com/en/guide/routing.html", kind: "docs" },
      youtube("express nodejs rest api tutorial"),
    ],
  },
  {
    test: /\bsql\b|mysql|postgres|database|dbms/i,
    items: [
      { title: "W3Schools — SQL", url: "https://www.w3schools.com/sql/", kind: "practice" },
      { title: "SQLBolt exercises", url: "https://sqlbolt.com/", kind: "practice" },
    ],
  },
  {
    test: /mongo/i,
    items: [
      { title: "MongoDB manual", url: "https://www.mongodb.com/docs/manual/", kind: "docs" },
      youtube("mongodb tutorial for beginners"),
    ],
  },
  {
    test: /git|github|version control/i,
    items: [
      { title: "Pro Git book", url: "https://git-scm.com/book/en/v2", kind: "docs" },
      { title: "GitHub — Get started", url: "https://docs.github.com/en/get-started", kind: "docs" },
      directVideo("mAFoROnOfHs", "Git & GitHub crash course for beginners (freeCodeCamp)"),
    ],
  },
  {
    test: /docker|container/i,
    items: [
      { title: "Docker — Get started", url: "https://docs.docker.com/get-started/", kind: "docs" },
      youtube("docker tutorial for beginners"),
    ],
  },
  {
    test: /\bapi\b|rest|restful|endpoint/i,
    items: [
      { title: "REST API Tutorial", url: "https://restfulapi.net/", kind: "docs" },
      { title: "MDN — HTTP overview", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview", kind: "docs" },
    ],
  },
  {
    test: /machine learning|\bml\b|scikit|sklearn|regression|classif/i,
    items: [
      { title: "scikit-learn user guide", url: "https://scikit-learn.org/stable/user_guide.html", kind: "docs" },
      { title: "Kaggle Learn — ML", url: "https://www.kaggle.com/learn/machine-learning", kind: "course" },
    ],
  },
  {
    test: /deep learning|neural|tensorflow|pytorch/i,
    items: [
      { title: "PyTorch tutorials", url: "https://pytorch.org/tutorials/", kind: "docs" },
      { title: "Kaggle Learn — DL", url: "https://www.kaggle.com/learn/deep-learning", kind: "course" },
    ],
  },
  {
    test: /pandas|numpy|dataframe|data analys/i,
    items: [
      { title: "pandas user guide", url: "https://pandas.pydata.org/docs/user_guide/", kind: "docs" },
      { title: "Kaggle Learn — pandas", url: "https://www.kaggle.com/learn/pandas", kind: "course" },
    ],
  },
  {
    test: /matplotlib|chart|visuali[sz]|dashboard|plot/i,
    items: [
      { title: "Matplotlib tutorials", url: "https://matplotlib.org/stable/tutorials/", kind: "docs" },
      { title: "Chart.js docs", url: "https://www.chartjs.org/docs/latest/", kind: "docs" },
    ],
  },
  {
    test: /opencv|image process|computer vision|yolo|detect/i,
    items: [
      { title: "OpenCV docs", url: "https://docs.opencv.org/", kind: "docs" },
      youtube("opencv python project tutorial"),
    ],
  },
  {
    test: /arduino|\besp32\b|embedded|sensor|hardware|\biot\b/i,
    items: [
      { title: "Arduino docs", url: "https://docs.arduino.cc/", kind: "docs" },
      youtube("esp32 arduino project tutorial"),
    ],
  },
  {
    test: /mqtt|protocol|message queue/i,
    items: [
      { title: "MQTT — the standard", url: "https://mqtt.org/", kind: "docs" },
      youtube("mqtt iot tutorial"),
    ],
  },
  {
    test: /\bai\b|\bllm\b|genai|generative|prompt|ollama|gemini|chatgpt/i,
    items: [
      { title: "Gemini API docs", url: "https://ai.google.dev/gemini-api/docs", kind: "docs" },
      { title: "Prompt engineering guide", url: "https://www.promptingguide.ai/", kind: "docs" },
    ],
  },
  {
    test: /figma|\bux\b|\bui\b|design system|wireframe/i,
    items: [
      { title: "Figma — Learn design", url: "https://www.figma.com/resources/learn-design/", kind: "course" },
      { title: "Laws of UX", url: "https://lawsofux.com/", kind: "docs" },
    ],
  },
  {
    test: /test|pytest|jest|unit/i,
    items: [
      { title: "pytest docs", url: "https://docs.pytest.org/", kind: "docs" },
      { title: "Jest — Getting started", url: "https://jestjs.io/docs/getting-started", kind: "docs" },
    ],
  },
  {
    test: /firebase|realtime|firestore/i,
    items: [
      { title: "Firebase docs", url: "https://firebase.google.com/docs", kind: "docs" },
      youtube("firebase full tutorial"),
    ],
  },
  {
    test: /deploy|vercel|netlify|host|ci\b|pipeline/i,
    items: [
      { title: "Vercel docs", url: "https://vercel.com/docs", kind: "docs" },
      { title: "roadmap.sh — DevOps", url: "https://roadmap.sh/devops", kind: "course" },
    ],
  },
  {
    test: /android|kotlin|flutter|mobile|swift|\bios\b/i,
    items: [
      { title: "Android — Courses", url: "https://developer.android.com/courses", kind: "course" },
      { title: "Flutter docs", url: "https://docs.flutter.dev/", kind: "docs" },
    ],
  },
  {
    test: /java\b|spring|\bmvc\b/i,
    items: [
      { title: "Java tutorials", url: "https://dev.java/learn/", kind: "docs" },
      { title: "Spring guides", url: "https://spring.io/guides", kind: "docs" },
    ],
  },
  {
    test: /linux|bash|shell|terminal/i,
    items: [
      { title: "GNU Bash manual", url: "https://www.gnu.org/software/bash/manual/", kind: "docs" },
      { title: "Linux command learn", url: "https://linuxcommand.org/", kind: "practice" },
    ],
  },
  {
    test: /websocket|socket|realtime|real-time|chat/i,
    items: [
      { title: "MDN — WebSockets API", url: "https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API", kind: "docs" },
      youtube("websocket nodejs chat app tutorial"),
    ],
  },
  {
    test: /regex|regular express/i,
    items: [
      { title: "Regex101 tester", url: "https://regex101.com/", kind: "practice" },
      { title: "Regex tutorial", url: "https://regexr.com/", kind: "docs" },
    ],
  },
  {
    test: /graphql/i,
    items: [
      { title: "GraphQL — Learn", url: "https://graphql.org/learn/", kind: "docs" },
      youtube("graphql tutorial"),
    ],
  },
];

/** Up to 5 vetted resources for a week's `learn` topics (search fallbacks if nothing matches). */
export function resourcesForWeek(week: RoadmapWeek): Resource[] {
  const out: Resource[] = [];
  const seen = new Set<string>();

  function push(resource: Resource): void {
    if (seen.has(resource.url)) return;
    seen.add(resource.url);
    out.push(resource);
  }

  for (const topic of week.learn) {
    for (const rule of RULES) {
      if (rule.test.test(topic)) {
        for (const item of rule.items) push(item);
      }
    }
    if (out.length >= 5) break;
  }

  if (out.length === 0) {
    const seed = `${week.focus} tutorial`;
    push(youtube(seed));
    push(webSearch(seed));
  }

  // Videos are supported everywhere: direct curated links exist for major
  // topics, and any week whose matched docs lack one still gets a YouTube
  // search for its focus (valid by construction) in the reserved slot.
  const top = out.slice(0, 5);
  if (!top.some((resource) => resource.kind === "video")) {
    if (top.length >= 5) top.pop();
    top.push(youtube(`${week.focus} tutorial`));
  }

  return top;
}
