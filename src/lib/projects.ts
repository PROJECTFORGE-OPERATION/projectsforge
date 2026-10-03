import type { Branch, StudentProfile } from "./types";
import { yearNumber } from "./types";

/**
 * Curated project dataset.
 *
 * This is the grounding layer: the LLM may ONLY recommend projects from this
 * list, which keeps recommendations realistic and controllable during a live
 * demo. Add records here to expand coverage.
 */
export interface ProjectRecord {
  id: string;
  title: string;
  summary: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  technologies: string[];
  branches: Branch[];
  /** Minimum year that should attempt this project (1-4). */
  minYear: number;
  /** Tokens from INTERESTS. */
  interests: string[];
  /** Skills a student ideally already has. */
  skillsRequired: string[];
  estimatedWeeks: number;
  /** Tokens from CAREER_GOALS. */
  careerFit: string[];
}

export const PROJECTS: ProjectRecord[] = [
  {
    id: "soil-irrigation",
    title: "Smart Irrigation System",
    summary:
      "Soil-moisture driven water pump controller that logs data and waters plants only when needed.",
    difficulty: "Intermediate",
    technologies: ["Arduino", "Soil moisture sensor", "Relay module", "Python", "MQTT"],
    branches: ["CSE", "ECE", "EEE"],
    minYear: 2,
    interests: ["IoT & Embedded", "AI / ML"],
    skillsRequired: ["Arduino", "basic electronics", "Python"],
    estimatedWeeks: 6,
    careerFit: ["Placement / Job", "Startup / Freelancing"],
  },
  {
    id: "air-quality-monitor",
    title: "Air Quality Monitoring Dashboard",
    summary:
      "ESP32 sensor node uploads AQ readings to a live dashboard with trends and alert thresholds.",
    difficulty: "Intermediate",
    technologies: ["ESP32", "Particulate sensor", "ThingSpeak", "React", "Chart.js"],
    branches: ["CSE", "ECE", "EEE", "IT"],
    minYear: 2,
    interests: ["IoT & Embedded", "Data Science", "Web Development"],
    skillsRequired: ["Python", "basic electronics"],
    estimatedWeeks: 5,
    careerFit: ["Placement / Job", "Research"],
  },
  {
    id: "finance-tracker",
    title: "Personal Finance Tracker",
    summary:
      "Track income and expenses, categorise spending and show monthly savings insights with charts.",
    difficulty: "Beginner",
    technologies: ["React", "Node.js", "SQLite", "Chart.js"],
    branches: ["CSE", "IT"],
    minYear: 1,
    interests: ["Web Development"],
    skillsRequired: ["HTML/CSS", "JavaScript"],
    estimatedWeeks: 4,
    careerFit: ["Placement / Job", "Startup / Freelancing"],
  },
  {
    id: "resume-matcher",
    title: "Resume–Skill Gap Matcher",
    summary:
      "Upload a resume and a job description; get a matched-skills report and missing-skill list.",
    difficulty: "Intermediate",
    technologies: ["Python", "spaCy", "FastAPI", "React"],
    branches: ["CSE", "IT"],
    minYear: 3,
    interests: ["AI / ML", "Data Science", "Web Development"],
    skillsRequired: ["Python", "SQL"],
    estimatedWeeks: 5,
    careerFit: ["Placement / Job", "Higher Studies"],
  },
  {
    id: "hostel-complaints",
    title: "Hostel Complaint Management",
    summary:
      "Students file complaints, wardens assign them, and everyone tracks status until resolution.",
    difficulty: "Beginner",
    technologies: ["Next.js", "PostgreSQL", "Tailwind CSS"],
    branches: ["CSE", "IT"],
    minYear: 1,
    interests: ["Web Development"],
    skillsRequired: ["HTML/CSS", "JavaScript"],
    estimatedWeeks: 4,
    careerFit: ["Placement / Job"],
  },
  {
    id: "traffic-signal-cv",
    title: "Adaptive Traffic Signal with Computer Vision",
    summary:
      "Camera counts vehicles per lane and adjusts green-light duration to reduce waiting time.",
    difficulty: "Advanced",
    technologies: ["OpenCV", "YOLO", "Python", "Raspberry Pi"],
    branches: ["CSE", "ECE"],
    minYear: 3,
    interests: ["AI / ML", "Robotics"],
    skillsRequired: ["Python", "Machine Learning"],
    estimatedWeeks: 8,
    careerFit: ["Placement / Job", "Research"],
  },
  {
    id: "solar-output-predictor",
    title: "Solar Panel Output Predictor",
    summary:
      "Predict hourly solar energy output from weather data and visualise generation patterns.",
    difficulty: "Intermediate",
    technologies: ["Python", "pandas", "scikit-learn", "Power BI"],
    branches: ["EEE", "ECE", "MECH"],
    minYear: 2,
    interests: ["Data Science", "AI / ML"],
    skillsRequired: ["Python"],
    estimatedWeeks: 5,
    careerFit: ["Placement / Job", "Research"],
  },
  {
    id: "code-review-bot",
    title: "Automated Code Review Bot",
    summary:
      "Pull-request bot that comments on style issues, bugs and missing tests using rule checks + LLM.",
    difficulty: "Intermediate",
    technologies: ["Python", "FastAPI", "GitHub Actions", "LLM API"],
    branches: ["CSE", "IT"],
    minYear: 3,
    interests: ["AI / ML", "Cloud & DevOps"],
    skillsRequired: ["Git", "Python"],
    estimatedWeeks: 6,
    careerFit: ["Placement / Job", "Startup / Freelancing"],
  },
  {
    id: "event-pwa",
    title: "College Event Management PWA",
    summary:
      "Discover events, register with QR codes and get reminders — installable as an offline PWA.",
    difficulty: "Intermediate",
    technologies: ["React", "PWA", "Firebase"],
    branches: ["CSE", "IT"],
    minYear: 2,
    interests: ["Web Development", "Mobile Apps"],
    skillsRequired: ["JavaScript", "HTML/CSS"],
    estimatedWeeks: 5,
    careerFit: ["Placement / Job", "Startup / Freelancing"],
  },
  {
    id: "fan-speed-controller",
    title: "Energy-Aware Fan Speed Controller",
    summary:
      "Temperature + presence sensing that varies fan speed to cut power draw, with live energy stats.",
    difficulty: "Intermediate",
    technologies: ["Arduino", "IR sensor", "PWM", "Blynk"],
    branches: ["EEE", "MECH", "ECE"],
    minYear: 2,
    interests: ["IoT & Embedded"],
    skillsRequired: ["Arduino", "basic electronics"],
    estimatedWeeks: 5,
    careerFit: ["Placement / Job", "Government Exams"],
  },
  {
    id: "face-attendance",
    title: "Face Recognition Attendance System",
    summary:
      "Mark attendance by face, store records with timestamps and flag proxies automatically.",
    difficulty: "Intermediate",
    technologies: ["Python", "face_recognition", "OpenCV", "Flask"],
    branches: ["CSE", "IT"],
    minYear: 3,
    interests: ["AI / ML", "Cybersecurity"],
    skillsRequired: ["Python"],
    estimatedWeeks: 6,
    careerFit: ["Placement / Job", "Research"],
  },
  {
    id: "bridge-load-monitor",
    title: "Bridge Load & Vibration Monitor",
    summary:
      "Strain/load sensors stream structural stress data to a dashboard that flags unsafe spikes.",
    difficulty: "Intermediate",
    technologies: ["Load cell", "ESP32", "MQTT", "Grafana"],
    branches: ["CIVIL", "MECH", "ECE"],
    minYear: 2,
    interests: ["IoT & Embedded", "Data Science"],
    skillsRequired: ["basic electronics"],
    estimatedWeeks: 6,
    careerFit: ["Placement / Job", "Research"],
  },
  {
    id: "notes-ocr",
    title: "Handwritten Notes to Text Scanner",
    summary:
      "Scan handwritten or printed notes and convert them into searchable, editable text.",
    difficulty: "Beginner",
    technologies: ["Tesseract OCR", "Python", "React Native"],
    branches: ["CSE", "IT"],
    minYear: 2,
    interests: ["AI / ML", "Mobile Apps"],
    skillsRequired: ["Python"],
    estimatedWeeks: 4,
    careerFit: ["Placement / Job", "Higher Studies"],
  },
  {
    id: "vuln-scanner",
    title: "Lightweight Web Vulnerability Scanner",
    summary:
      "Crawl a target site and report common OWASP issues like XSS and SQL injection with proofs.",
    difficulty: "Advanced",
    technologies: ["Python", "OWASP Top 10", "Flask", "Burp conventions"],
    branches: ["CSE", "IT"],
    minYear: 3,
    interests: ["Cybersecurity"],
    skillsRequired: ["Python", "HTML/CSS"],
    estimatedWeeks: 5,
    careerFit: ["Placement / Job", "Research"],
  },
  {
    id: "lan-party-game",
    title: "2D Multiplayer Browser Game",
    summary:
      "Real-time 2D game over WebSockets with rooms, scoring and a simple leaderboard.",
    difficulty: "Intermediate",
    technologies: ["Phaser", "WebSocket", "Node.js"],
    branches: ["CSE", "IT"],
    minYear: 2,
    interests: ["Game Development", "Web Development"],
    skillsRequired: ["JavaScript"],
    estimatedWeeks: 6,
    careerFit: ["Startup / Freelancing", "Placement / Job"],
  },
  {
    id: "student-dashboard-ui",
    title: "Student Performance Dashboard (UI Case Study)",
    summary:
      "Design and build a dashboard that turns attendance and marks data into clear, actionable views.",
    difficulty: "Beginner",
    technologies: ["Figma", "React", "Tailwind CSS"],
    branches: ["CSE", "IT"],
    minYear: 1,
    interests: ["UI / UX Design", "Web Development"],
    skillsRequired: ["HTML/CSS"],
    estimatedWeeks: 4,
    careerFit: ["Placement / Job", "Higher Studies"],
  },
];

/**
 * Deterministic candidate ranking: the dataset is scored against the profile
 * before the LLM ever sees it, so the model reasons over a short, relevant
 * shortlist instead of inventing projects.
 */
export function selectCandidates(
  profile: StudentProfile,
  limit = 8,
): ProjectRecord[] {
  const year = yearNumber(profile.year);
  const known = new Set(profile.skills.map((s) => s.toLowerCase()));

  const scored = PROJECTS.map((p) => {
    let score = 0;
    if (p.branches.includes(profile.branch)) score += 4;
    score += p.minYear <= year ? 3 : -3;
    for (const interest of p.interests) {
      if ((profile.interests as readonly string[]).includes(interest)) score += 2.5;
    }
    score += p.careerFit.includes(profile.careerGoal) ? 2 : 0;
    score += p.estimatedWeeks <= profile.availableWeeks + 2 ? 2 : -0.5;
    for (const skill of p.skillsRequired) {
      if (known.has(skill.toLowerCase())) score += 1.5;
    }
    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.p);
}
