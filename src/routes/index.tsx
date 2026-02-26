import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Folder,
  Globe,
  HeartPulse,
  Info,
  Mail,
  Search,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

const HEATMAP_CELLS = Array.from({ length: 36 }, (_, index) => {
  let toneClass = "bg-blue-100";
  if (index % 6 === 0) {
    toneClass = "bg-blue-600";
  } else if (index % 4 === 0) {
    toneClass = "bg-blue-400";
  } else if (index % 3 === 0) {
    toneClass = "bg-blue-300";
  }

  return {
    id: `heat-${index + 1}`,
    toneClass,
  };
});

function Home() {
  const currentYear = new Date().getFullYear();
  return (
    <div className="landing-root relative flex min-h-screen w-full flex-col overflow-x-hidden bg-white text-[#111111] selection:bg-blue-500 selection:text-white">
      <header className="absolute top-0 z-50 w-full bg-transparent">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-10">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-black" />
            <span className="text-sm font-bold uppercase tracking-[0.05em]">Remora</span>
          </div>
          <nav className="hidden items-center gap-10 md:flex">
            <a
              className="text-[13px] font-medium text-[#666666] transition-colors hover:text-black"
              href="#platform"
            >
              Platform
            </a>
            <a
              className="text-[13px] font-medium text-[#666666] transition-colors hover:text-black"
              href="#resources"
            >
              Resources
            </a>
            <a
              className="text-[13px] font-medium text-[#666666] transition-colors hover:text-black"
              href="#pricing"
            >
              Prices
            </a>
            <a
              className="text-[13px] font-medium text-[#666666] transition-colors hover:text-black"
              href="#blog"
            >
              Blog
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-[13px] font-medium transition-colors hover:bg-gray-50"
                >
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="rounded-xl bg-black px-6 py-2.5 text-[13px] font-medium text-white transition-all hover:bg-gray-800"
                >
                  Sign up
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link
                to="/app/decks"
                className="rounded-lg px-4 py-2 text-[13px] font-medium transition-colors hover:bg-gray-50"
              >
                Open app
              </Link>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section id="platform" className="relative overflow-hidden px-10 pb-32 pt-44 text-center">
          <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
            <div className="landing-dotted-pattern absolute inset-0 opacity-30" />
          </div>
          <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center">
            <h1 className="mb-8 max-w-5xl text-6xl font-extrabold leading-[1.05] tracking-tight text-gray-900 md:text-[72px]">
              Unlock Your Creative Potential:
              <br />
              The Art of Intelligent Studying.
            </h1>
            <p className="mb-12 max-w-2xl text-xl font-normal leading-relaxed text-[#666666]">
              Go beyond rote memorization. Our intuitive platform helps you transform complex ideas
              into beautiful, creative flashcards that stick.
            </p>
            <div className="mb-24 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/app/decks"
                className="rounded-2xl bg-black px-10 py-5 text-[17px] font-bold tracking-wide text-white shadow-xl shadow-black/5 transition-all hover:bg-gray-800"
              >
                Get Started for Free
              </Link>
            </div>

            <div className="relative flex h-[600px] w-full max-w-5xl items-center justify-center">
              <div className="landing-soft-shadow relative z-10 w-full overflow-hidden rounded-[32px] border border-gray-100 bg-white p-1">
                <div className="flex h-full w-full overflow-hidden rounded-[28px] border border-gray-100 bg-gray-50">
                  <div className="hidden w-64 flex-col gap-8 border-r border-gray-200/50 bg-white p-6 md:flex">
                    <div className="space-y-4">
                      <div className="h-3 w-3/4 rounded-full bg-gray-100" />
                      <div className="h-3 w-1/2 rounded-full bg-gray-100" />
                    </div>
                    <div className="space-y-4 pt-8">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                          <BookOpen className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="h-3 w-24 rounded-full bg-gray-100" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                          <Folder className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="h-3 w-20 rounded-full bg-gray-100" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col bg-white">
                    <div className="flex h-16 items-center justify-between border-b border-gray-200/50 px-8">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <div className="h-3 w-32 rounded-full bg-gray-50" />
                      </div>
                      <div className="h-8 w-24 rounded-lg bg-black" />
                    </div>
                    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
                      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-gray-100 p-8 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                          <Upload className="h-8 w-8 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Drop your concept here</p>
                          <p className="mt-1 text-left text-xs text-[#666666]">
                            AI will process diagrams and text automatically
                          </p>
                        </div>
                      </div>
                      <div className="grid w-full grid-cols-3 gap-4 opacity-40">
                        <div className="h-24 rounded-xl border border-gray-100 bg-gray-50" />
                        <div className="h-24 rounded-xl border border-gray-100 bg-gray-50" />
                        <div className="h-24 rounded-xl border border-gray-100 bg-gray-50" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="landing-floating-element landing-soft-shadow absolute -left-12 -top-10 z-20 hidden w-64 rounded-3xl border border-gray-50 bg-white p-6 text-left xl:block">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    Extraction Progress
                  </span>
                  <span className="text-xs font-bold text-blue-500">82%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full w-[82%] rounded-full bg-blue-500" />
                </div>
              </div>

              <div className="landing-floating-element landing-soft-shadow absolute right-[-4rem] top-12 z-20 hidden min-w-[240px] items-center gap-4 rounded-2xl border border-gray-50 bg-white p-5 lg:flex">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-50">
                  <Folder className="h-6 w-6 text-pink-400" />
                </div>
                <div className="text-left">
                  <div className="text-[14px] font-bold text-gray-900">Advanced Biology</div>
                  <div className="text-[10px] uppercase tracking-tight text-gray-400">
                    12 Sub-sections • 142 Cards
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="resources" className="bg-white px-10 py-32">
          <div className="mx-auto max-w-7xl space-y-48">
            <FeatureBlock
              title="User-Friendly Interface"
              description="Instantly turn complex readings into structured knowledge. Highlight text within your materials, and our AI generates high-fidelity flashcards in real-time, preserving the scientific context."
              visual={
                <div className="landing-soft-shadow w-[380px] space-y-4 rounded-3xl border border-gray-100 bg-white p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    Source Snippet
                  </p>
                  <p className="text-[13px] leading-relaxed text-gray-800">
                    The{" "}
                    <mark className="rounded bg-blue-100 px-0.5 font-medium text-blue-700">
                      mitochondrion
                    </mark>{" "}
                    is a double-membrane-bound organelle.
                  </p>
                  <div className="rounded-2xl border-l-4 border-l-blue-500 bg-gray-50 p-4">
                    <h4 className="text-sm font-bold text-gray-900">Mitochondria</h4>
                    <p className="mt-1 text-xs text-[#666666]">
                      The powerhouse of the cell, generating most ATP.
                    </p>
                  </div>
                </div>
              }
            />

            <FeatureBlock
              reverse
              title="Comprehensive Insights"
              description="Monitor your cognitive progress with granular retention heatmaps. Remora uses data-driven schedules to ensure topics stay fresh in your long-term memory."
              visual={
                <div className="landing-soft-shadow w-[420px] rounded-3xl border border-gray-100 bg-white p-8 text-left">
                  <div className="mb-8 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        Retention Heatmap
                      </span>
                      <div className="mt-1 text-2xl font-bold">Human Anatomy</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-green-500">88% Retention</div>
                      <div className="text-[10px] uppercase text-[#666666]">On Track</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-1.5">
                    {HEATMAP_CELLS.map((cell) => (
                      <div key={cell.id} className={`h-3 w-3 rounded-[2px] ${cell.toneClass}`} />
                    ))}
                  </div>
                </div>
              }
            />

            <FeatureBlock
              title="In-depth Flashcard Details"
              description="Master complex visuals with interactive diagrams. Every card can host hotspots, clear labeling, and source-linked references."
              visual={
                <div className="landing-soft-shadow w-[420px] rounded-3xl border border-gray-100 bg-white p-8 text-left">
                  <div className="mb-8 flex items-center justify-between">
                    <h4 className="text-lg font-bold">The Human Heart</h4>
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-500">
                      Active Review
                    </span>
                  </div>
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/50">
                    <HeartPulse className="h-48 w-48 text-red-200" />
                    <div className="absolute left-1/3 top-1/4 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-[10px] text-white">
                      1
                    </div>
                    <div className="absolute right-1/4 top-1/2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-400 text-[10px] text-white">
                      2
                    </div>
                    <div className="absolute bottom-1/4 left-1/2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-400 text-[10px] text-white">
                      3
                    </div>
                    <div className="landing-soft-shadow absolute left-1/2 top-[20%] -translate-x-1/2 rounded-lg border border-gray-100 bg-white px-3 py-1.5">
                      <span className="text-[11px] font-bold">Left Atrium</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-4 text-xs font-medium text-gray-500">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      <span>Anatomy 101</span>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </section>

        <section id="pricing" className="bg-gray-50/50 px-10 py-32">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-16 text-center">
            <div>
              <h2 className="mb-6 text-4xl font-bold text-gray-900">Study History</h2>
              <p className="mx-auto max-w-xl text-lg font-light text-[#666666]">
                Stay organized with a real-time record of your cards created and decks mastered.
              </p>
            </div>
            <div className="landing-soft-shadow w-full max-w-2xl overflow-hidden rounded-[32px] border border-gray-100 bg-white">
              <div className="flex items-center justify-between border-b border-gray-50 p-8">
                <h3 className="text-lg font-bold">Recent Flashcard Activity</h3>
                <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5">
                  <Search className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs text-gray-400">Search activity...</span>
                </div>
              </div>
              <ActivityRow
                icon={<BookOpen className="h-5 w-5 text-blue-500" />}
                title="Quantum Mechanics"
                meta="12 Cards Generated • 15m ago"
                metric="+42 XP"
              />
              <ActivityRow
                icon={<FileText className="h-5 w-5 text-purple-500" />}
                title="Cardiology Basics"
                meta="Flashcard Review • 2h ago"
                metric="92% Recall"
              />
              <ActivityRow
                icon={<HeartPulse className="h-5 w-5 text-pink-500" />}
                title="Organic Chemistry II"
                meta="New Deck Formed • 5h ago"
                metric="80% Mastered"
              />
            </div>
          </div>
        </section>

        <section id="blog" className="relative overflow-hidden bg-white px-10 py-48 text-center">
          <div className="relative z-10 mx-auto max-w-3xl">
            <h2 className="mb-10 text-6xl font-bold tracking-tight text-gray-900">
              Elevate your study.
            </h2>
            <p className="mb-12 text-xl font-light text-[#666666]">
              Join the most selective circle of learners worldwide who value design and performance
              equally.
            </p>
            <SignedOut>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="rounded-2xl bg-black px-12 py-5 text-[15px] font-bold tracking-wide text-white shadow-xl shadow-black/5 transition-all hover:bg-gray-800"
                >
                  Experience the Platform
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link
                to="/app/decks"
                className="inline-flex items-center gap-2 rounded-2xl bg-black px-12 py-5 text-[15px] font-bold tracking-wide text-white shadow-xl shadow-black/5 transition-all hover:bg-gray-800"
              >
                Experience the Platform <ArrowRight className="h-4 w-4" />
              </Link>
            </SignedIn>
            <p className="mt-8 text-[12px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              Free for individual students
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 bg-white px-10 py-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-16 md:flex-row md:items-center">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-black" />
              <span className="text-sm font-bold uppercase tracking-[0.05em]">Remora</span>
            </div>
            <p className="max-w-xs text-sm font-light leading-relaxed text-gray-500">
              A sophisticated environment for higher education and cognitive development.
            </p>
          </div>
          <div className="flex flex-wrap gap-16">
            <FooterColumn
              title="Resources"
              links={[
                { label: "Documentation", href: "#resources" },
                { label: "API Reference", href: "#resources" },
              ]}
            />
            <FooterColumn
              title="Company"
              links={[
                { label: "Philosophy", href: "#platform" },
                { label: "Contact", href: "mailto:support@remora.app" },
              ]}
            />
            <FooterColumn
              title="Legal"
              links={[
                { label: "Privacy", href: "#pricing" },
                { label: "Terms", href: "#pricing" },
              ]}
            />
          </div>
        </div>
        <div className="mx-auto mt-24 flex max-w-7xl flex-col items-center justify-between gap-6 border-t border-gray-50 pt-10 md:flex-row">
          <p className="text-[12px] tracking-wider text-gray-400">
            © {currentYear} Remora Laboratory. Designed for excellence.
          </p>
          <div className="flex gap-8">
            <a
              className="text-gray-400 transition-colors hover:text-black"
              href="https://remora.app"
              aria-label="Website"
            >
              <Globe className="h-5 w-5" />
            </a>
            <a
              className="text-gray-400 transition-colors hover:text-black"
              href="mailto:support@remora.app"
              aria-label="Email"
            >
              <Mail className="h-5 w-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureBlock({
  title,
  description,
  visual,
  reverse = false,
}: {
  title: string;
  description: string;
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-16 md:gap-32 ${reverse ? "md:flex-row-reverse" : "md:flex-row"}`}
    >
      <div className="relative flex flex-1 items-center justify-center">
        <div className="landing-dotted-pattern absolute inset-0 opacity-10" />
        <div className="relative z-10">{visual}</div>
      </div>
      <div className="flex flex-1 flex-col gap-6 text-left">
        <h2 className="text-5xl font-bold leading-tight text-gray-900">{title}</h2>
        <p className="text-xl font-light leading-relaxed text-[#666666]">{description}</p>
      </div>
    </div>
  );
}

function ActivityRow({
  icon,
  title,
  meta,
  metric,
}: {
  icon: ReactNode;
  title: string;
  meta: string;
  metric: string;
}) {
  return (
    <div className="flex items-center justify-between p-6 transition-colors hover:bg-gray-50">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50">
          {icon}
        </div>
        <div className="text-left">
          <p className="text-sm font-bold">{title}</p>
          <p className="text-[11px] uppercase text-gray-400">{meta}</p>
        </div>
      </div>
      <span className="text-sm font-bold text-gray-900">{metric}</span>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-900">
        {title}
      </span>
      {links.map((link) => (
        <a
          key={link.label}
          className="text-[13px] text-gray-500 transition-colors hover:text-black"
          href={link.href}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
