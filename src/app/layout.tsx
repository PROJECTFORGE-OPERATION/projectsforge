import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Monogram } from "@/components/logo";
import { CONTACT_EMAIL } from "@/lib/whatsapp";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://projectsforge-nu.vercel.app"),
  title: "ProjectsForge — From Project Ideas to Career-Ready Skills",
  description:
    "Choose a project that fits your branch, year, skills, interests, goal and time — then get a skill-gap analysis and a practical week-by-week roadmap.",
  openGraph: {
    title: "ProjectsForge — Ideas → Projects → Careers",
    description:
      "Skill-gap analysis and weekly project roadmaps for engineering students. Real AI, no canned answers.",
    url: "https://projectsforge-nu.vercel.app",
    siteName: "ProjectsForge",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}

        <footer className="border-t border-line bg-panel/40">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2.5">
                <Monogram size={26} glow={false} />
                <span className="text-sm font-semibold tracking-wide">
                  ProjectsForge
                </span>
              </div>
              <p className="mt-3 max-w-xs text-xs leading-relaxed text-mist">
                Ideas → Projects → Careers. Skill-gap analysis and weekly project
                roadmaps for engineering students.
              </p>
            </div>

            <div>
              <span className="label">Contact</span>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-sky hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </li>
                <li className="text-xs leading-relaxed text-mist">
                  Suggestions and feedback welcome — we read every message.
                </li>
              </ul>
            </div>

            <div>
              <span className="label">Quick links</span>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/" className="text-mist transition hover:text-chalk">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-mist transition hover:text-chalk">
                    Student login
                  </Link>
                </li>
                <li>
                  <Link
                    href="/profile"
                    className="text-mist transition hover:text-chalk"
                  >
                    Build a roadmap
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-line/70 py-4 text-center text-[11px] text-mist">
            © 2026 ProjectsForge · Build small · Demonstrate clearly · Explain honestly
          </div>
        </footer>
      </body>
    </html>
  );
}
