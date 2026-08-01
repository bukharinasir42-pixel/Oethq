/**
 * courses-catalogue.ts — typed marketing copy for the standalone course landing
 * pages (per spec §12: page content stays in typed config, not the DB). Pricing,
 * status and entitlement come from the live /products catalogue; this file holds
 * only the editorial copy. No fabricated statistics or guarantees.
 */

export type CourseLandingCopy = {
  slug: string;
  /** SEO */
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  /** Hero */
  eyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  /** Narrative */
  problemTitle: string;
  problem: string;
  promiseTitle: string;
  promise: string;
  whoForTitle: string;
  whoFor: string[];
  /** Inclusions — grouped */
  inclusionGroups: Array<{ heading: string; items: string[] }>;
  accessNote: string;
  /** FAQ */
  faqs: Array<{ q: string; a: string }>;
  /** Cross-sell: slugs of related products to surface at the bottom */
  crossSell: string[];
};

export const COURSE_LANDING: Record<string, CourseLandingCopy> = {
  "reading-listening": {
    slug: "reading-listening",
    metaTitle: "OET Reading & Listening Course | OET HQ",
    metaDescription:
      "Master both OET receptive skills in one focused course — lectures, practice and mock tests, OET HQ past papers, and progress reports for Reading and Listening.",
    ogTitle: "OET Reading & Listening Course — OET HQ",
    ogDescription:
      "One focused programme for the two skills most candidates lose marks on. Lectures, mocks, OET HQ past papers and progress tracking for Reading and Listening.",
    eyebrow: "Receptive skills · Reading + Listening",
    heroTitle: "Lock in your Reading & Listening — the two skills that decide most OET results.",
    heroSubtitle:
      "A focused programme built around the exact question types the examiner uses. Learn the method, drill it on real-format tests, and track your band as it climbs — without paying for skills you don't need.",
    problemTitle: "The problem",
    problem:
      "Reading Part B/C and Listening Part B are where careful, capable clinicians quietly lose the marks that hold back a B. Generic mocks you've already memorised don't fix that — you need the method for each part and enough fresh, real-format practice to make it automatic.",
    promiseTitle: "What this course does",
    promise:
      "It teaches a repeatable approach for every Reading and Listening part, then gives you the volume of real-format practice, mock tests and OET HQ past papers to make that approach second nature — with a progress report that shows you when the data says you're ready.",
    whoForTitle: "Who it's for",
    whoFor: [
      "Candidates who are comfortable in Writing and Speaking but keep missing a B on Reading or Listening.",
      "Anyone who wants focused receptive-skills practice without buying a full four-skill programme.",
      "Repeat candidates who need fresh, real-format material rather than mocks they already know."
    ],
    inclusionGroups: [
      {
        heading: "Reading",
        items: [
          "Reading lectures — Part A, B and C method",
          "Reading practice tests",
          "Reading mock tests (exam format)",
          "OET HQ Reading past papers",
          "Reading progress report"
        ]
      },
      {
        heading: "Listening",
        items: [
          "Listening lectures — Part A, B and C method",
          "Listening practice tests",
          "Listening mock tests (exam format)",
          "OET HQ Listening past papers",
          "Listening progress report"
        ]
      }
    ],
    accessNote: "Full access for your course window from the day you enrol.",
    faqs: [
      {
        q: "How is this different from the Complete Course?",
        a: "The Complete Course covers all four skills plus writing corrections and analytics. This course focuses only on Reading and Listening — ideal if those are the skills holding you back and you don't need Writing and Speaking material."
      },
      {
        q: "Are the past papers the real OET HQ papers?",
        a: "Yes — it includes the OET HQ Reading and Listening past papers, in the exam format."
      },
      {
        q: "Can I upgrade later?",
        a: "Yes. If you later want the full programme, you can move up to a Complete Course — your account keeps everything you already own."
      }
    ],
    crossSell: ["reading", "listening", "complete"]
  },
  reading: {
    slug: "reading",
    metaTitle: "OET Reading Material | OET HQ",
    metaDescription:
      "A focused OET Reading course — Part A/B/C strategy, real-format practice and mock tests, OET HQ Reading past papers, and a Reading progress report.",
    ogTitle: "OET Reading Material — OET HQ",
    ogDescription:
      "Fix OET Reading with a clear method for Part A, B and C, plenty of real-format practice, OET HQ past papers and progress tracking.",
    eyebrow: "Single skill · Reading",
    heroTitle: "Turn OET Reading from your weakest section into a reliable B.",
    heroSubtitle:
      "A focused Reading programme: the method for Part A, B and C, real-format practice and mock tests, and the OET HQ Reading past papers — with a progress report that tracks your band.",
    problemTitle: "The problem",
    problem:
      "Reading punishes good clinicians for small habits — over-reading Part A, second-guessing Part B, and running out of time in Part C. Practising more of the same tests you've seen won't change the score; the method will.",
    promiseTitle: "What this course does",
    promise:
      "It gives you a clear, repeatable approach for each Reading part, then the volume of fresh, real-format practice and past papers to make it automatic under time pressure — and a progress report so you know when you're ready.",
    whoForTitle: "Who it's for",
    whoFor: [
      "Candidates whose Reading band is the one thing standing between them and a B.",
      "Anyone who wants targeted Reading practice without a full four-skill course.",
      "Repeat candidates who need new, real-format Reading material."
    ],
    inclusionGroups: [
      {
        heading: "Reading",
        items: [
          "Reading lectures — Part A, B and C method",
          "Reading practice tests",
          "Reading mock tests (exam format)",
          "OET HQ Reading past papers",
          "Reading progress report"
        ]
      }
    ],
    accessNote: "Full Reading access for your course window from the day you enrol.",
    faqs: [
      {
        q: "Does this include Listening?",
        a: "No — this is Reading only. If you want both receptive skills, the Reading & Listening Course covers them together at a better combined value."
      },
      {
        q: "Are the OET HQ Reading past papers included?",
        a: "Yes, in the exam format, alongside the practice and mock tests."
      },
      {
        q: "Can I upgrade to both skills later?",
        a: "Yes — you can move up to the Reading & Listening Course or a Complete Course, and your account keeps what you already own."
      }
    ],
    crossSell: ["reading-listening", "listening", "complete"]
  },
  listening: {
    slug: "listening",
    metaTitle: "OET Listening Material | OET HQ",
    metaDescription:
      "A focused OET Listening course — Part A/B/C strategy, real-format practice and mock tests, OET HQ Listening past papers, and a Listening progress report.",
    ogTitle: "OET Listening Material — OET HQ",
    ogDescription:
      "Fix OET Listening with a clear method for Part A, B and C, real-format practice, OET HQ past papers and progress tracking.",
    eyebrow: "Single skill · Listening",
    heroTitle: "Stop losing OET Listening marks to note-taking and Part B.",
    heroSubtitle:
      "A focused Listening programme: the method for Part A, B and C, real-format practice and mock tests, and the OET HQ Listening past papers — with a progress report that tracks your band.",
    problemTitle: "The problem",
    problem:
      "Listening moves fast: Part A rewards clean note-taking, Part B rewards catching the speaker's intent, and one lapse costs a run of marks. More untracked practice won't fix it — a method and real-format volume will.",
    promiseTitle: "What this course does",
    promise:
      "It gives you a clear approach for each Listening part, real-format practice, mock tests and OET HQ past papers to build it into a habit, and a progress report so you can see your band improving.",
    whoForTitle: "Who it's for",
    whoFor: [
      "Candidates whose Listening band is the blocker to a B.",
      "Anyone who wants targeted Listening practice without a full course.",
      "Repeat candidates who need fresh, real-format Listening material."
    ],
    inclusionGroups: [
      {
        heading: "Listening",
        items: [
          "Listening lectures — Part A, B and C method",
          "Listening practice tests",
          "Listening mock tests (exam format)",
          "OET HQ Listening past papers",
          "Listening progress report"
        ]
      }
    ],
    accessNote: "Full Listening access for your course window from the day you enrol.",
    faqs: [
      {
        q: "Does this include Reading?",
        a: "No — this is Listening only. If you want both receptive skills, the Reading & Listening Course covers them together at a better combined value."
      },
      {
        q: "Are the OET HQ Listening past papers included?",
        a: "Yes, in the exam format, alongside the practice and mock tests."
      },
      {
        q: "Can I upgrade to both skills later?",
        a: "Yes — you can move up to the Reading & Listening Course or a Complete Course, and your account keeps what you already own."
      }
    ],
    crossSell: ["reading-listening", "reading", "complete"]
  },
  writing: {
    slug: "writing",
    metaTitle: "OET Writing Course — Choose Your Plan | OET HQ",
    metaDescription:
      "The OET Writing Course from OET HQ. Four plans from US$39. Letter corrections marked by a human against all six official OET Writing criteria, case-note tasks, drills and the Pass Predictor.",
    ogTitle: "OET Writing Course — OET HQ",
    ogDescription:
      "Four plans from US$39. Human-marked letter corrections against the six official OET Writing criteria, case-note tasks, cheat sheets and the Pass Predictor.",
    eyebrow: "Single skill · Writing",
    heroTitle: "Six criteria. One letter. No second read.",
    heroSubtitle:
      "Writing is the only sub-test where a human decides your grade against six named criteria. This course teaches the letter the examiner rewards, then marks yours line by line against all six until it gets there.",
    problemTitle: "The problem",
    problem:
      "Most candidates lose the B on Purpose and Conciseness — not on grammar — and rewrite the same letter fixing things that were never the issue.",
    promiseTitle: "What this course does",
    promise:
      "Every correction names the criterion, shows your current band and projected band, and gives you the exact line to change — marked by a human, not a model.",
    whoForTitle: "Who it's for",
    whoFor: [
      "Candidates whose Writing band is the one thing between them and a B.",
      "Anyone who wants human-marked corrections against the official six criteria.",
      "Repeat candidates who need enough marked letters to actually improve."
    ],
    inclusionGroups: [
      {
        heading: "Writing",
        items: [
          "Scheduled OET Writing cohort lectures",
          "Letter corrections marked to all 6 official criteria",
          "Case-note writing tasks across professions",
          "OET HQ past-paper writing tasks",
          "Letter structure and layout drills"
        ]
      }
    ],
    accessNote: "Full Writing access for your course window from the day you enrol.",
    faqs: [
      {
        q: "Is my letter marked by a human or by AI?",
        a: "By a human, every time — against the six official OET Writing criteria, with a current and projected band and a line-by-line rewrite."
      },
      {
        q: "I only want corrections, not a whole course.",
        a: "The standalone correction packs (2, 6 and 12 letters) are still available on the Writing Corrections page."
      },
      {
        q: "Can I upgrade later?",
        a: "Yes — move up a tier and pay only the difference; your writing history carries over."
      }
    ],
    crossSell: ["writing-corrections", "complete"]
  }
};
