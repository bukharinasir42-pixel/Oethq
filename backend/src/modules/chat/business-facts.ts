/**
 * business-facts.ts — the ONLY authority for prices, plans, policies and claims.
 *
 * Supplied by the owner, compiled from four years of real conversations and
 * checked against the live oethq.com catalogue. The assistant is instructed to
 * state nothing factual that is not in here.
 *
 * Shipped as TypeScript rather than JSON on purpose: the backend builds with
 * `tsc`, which does not copy .json files into dist/, so a JSON version would be
 * present in development and missing in production — where the failure would be
 * an assistant confidently answering with no facts at all.
 *
 * Keys beginning with an underscore are notes to the owner, not content for the
 * model; `factsForPrompt()` strips them.
 *
 * To change a price or a policy, edit this file. Prices for the live catalogue
 * are ALSO read from the database at request time and override anything here,
 * so a price changed in admin is never contradicted by this file.
 */

export type BusinessFacts = Record<string, unknown>;

export const BUSINESS_FACTS: BusinessFacts = {
  "_meta": {
    "purpose": "Single source of truth for the OET HQ assistant. The model answers ONLY from this file. Never from memory, never from historical WhatsApp messages.",
    "brand": "OET HQ",
    "website": "https://oethq.com",
    "retired_brand": [
      "Dr Nasir Academy",
      "drnasiracademy.com"
    ],
    "currency_policy": "USD only. All prices are one-time investments.",
    "catalogue_source": "Read from oethq.com on 2026-08-10 via rendered browser; confirmed by owner as authoritative.",
    "policy_source": "Owner interview, 2026-08-10.",
    "still_needed_from_owner": [
      "Per-tier checkout URLs. The assistant currently sends a bare oethq.com link, which drops the candidate on the homepage after they have already been recommended a specific tier.",
      "Confirmation of the payment methods surfaced from four years of history: card/debit, bank transfer PKR, Wise USA, UPI India, STC Pay. The assistant says 'pay by card at checkout' and nothing else until this is confirmed.",
      "Which platform the scheduled cohort classes run on. The owner confirmed the classes exist and that students pick their own time slot, but not the platform, so the assistant never names one.",
      "Website fixes: the Reading page says 99% where the owner confirmed 90%; 'Up to 60d' contradicts the 9-month tier; deep links 404 on direct load; oethq.com links to wa.me/15109540245 rather than the business number."
    ]
  },
  "products": {
    "complete_materials": {
      "name": "OET Complete Materials",
      "covers": [
        "Reading",
        "Listening",
        "Writing",
        "Speaking"
      ],
      "price_range_usd": [
        187,
        773
      ],
      "tiers": [
        {
          "tier": 0,
          "name": "Free Trial",
          "price_usd": 0,
          "access_days": 7,
          "card_required": false,
          "includes": [
            "1 scheduled cohort lecture",
            "1 Reading mock test",
            "1 Listening mock test",
            "1 day of live spelling",
            "1 podcast episode"
          ],
          "excludes": [
            "past papers",
            "cheat sheets",
            "live drills",
            "Pass Predictor"
          ],
          "link": "https://oethq.com/auth/register?returnTo=%2Fportal%3FselectTier%3DSTARTER"
        },
        {
          "tier": 1,
          "name": "Foundation Sprint",
          "price_usd": 187,
          "access_days": 45,
          "positioning": "Build the base, sit the exam soon.",
          "mocks": "6 Reading + 6 Listening",
          "past_papers": "2 Reading + 2 Listening",
          "writing_corrections": 2,
          "includes": [
            "Scheduled cohort lectures - all four skills"
          ],
          "excludes": [
            "cheat sheets",
            "Pass Predictor tracker",
            "daily live drills"
          ]
        },
        {
          "tier": 2,
          "name": "Precision Engine",
          "price_usd": 331,
          "access_days": 60,
          "positioning": "Where the score actually moves.",
          "mocks": "10 Reading + 10 Listening",
          "past_papers": "3 Reading + 3 Listening",
          "writing_corrections": 3,
          "includes": [
            "Everything in Foundation",
            "Daily live Reading Part A drills",
            "Skimming & scanning drills",
            "Listening Part A drills + daily live spelling",
            "Daily reading article from official OET sources",
            "Cheat sheets + lectures on using them",
            "Speaking lectures + Speaking Hack PDFs",
            "Daily podcasts",
            "Pass Predictor tracker"
          ]
        },
        {
          "tier": 3,
          "name": "Elite Clearance",
          "price_usd": 503,
          "access_days": 150,
          "most_chosen": true,
          "positioning": "Room to fail a mock and still fix it.",
          "mocks": "30 Reading + 30 Listening total",
          "past_papers": "12 Reading + 12 Listening",
          "writing_corrections": 7,
          "refresh_note": "Starts at 15+15 mocks and 6+6 past papers; refreshes and doubles on day 45.",
          "includes": [
            "Everything in Precision",
            "WhatsApp accountability group with Dr. Nasir",
            "Fresh material on day 45 - nothing recycled"
          ]
        },
        {
          "tier": 4,
          "name": "Total Clearance",
          "price_usd": 773,
          "access_days": 270,
          "positioning": "The whole library, start to PIN.",
          "mocks": "40 Reading + 40 Listening total",
          "past_papers": "20 Reading + 20 Listening",
          "writing_corrections": 10,
          "refresh_note": "Starts at 20+20 mocks and 10+10 past papers; refreshes and doubles on day 45.",
          "includes": [
            "Everything in Elite",
            "Reading Part A core-skill programme",
            "Reading Part A spelling programme",
            "Daily podcasts for the full 9 months",
            "Covers a retake without paying twice"
          ]
        }
      ]
    },
    "reading": {
      "name": "OET Reading Material",
      "price_range_usd": [
        39,
        139
      ],
      "tiers": [
        {
          "tier": 1,
          "name": "Reading Foundation",
          "price_usd": 39,
          "access_days": 30,
          "mocks": 4,
          "past_papers": 1,
          "includes": [
            "Reading cohort lectures",
            "Part A drills"
          ],
          "excludes": [
            "Part C drills",
            "cheat sheets",
            "Pass Predictor"
          ]
        },
        {
          "tier": 2,
          "name": "Reading Momentum",
          "price_usd": 65,
          "access_days": 40,
          "mocks": 4,
          "past_papers": 3,
          "includes": [
            "Everything in Foundation",
            "Part C drills",
            "Part C lectures from official OET sources"
          ],
          "excludes": [
            "cheat sheets",
            "Pass Predictor"
          ]
        },
        {
          "tier": 3,
          "name": "Reading Precision",
          "price_usd": 93,
          "access_days": 60,
          "most_chosen": true,
          "mocks": 10,
          "past_papers": 5,
          "includes": [
            "Everything in Momentum",
            "Reading cheat sheets",
            "Lectures on using cheat sheets",
            "Daily articles from official OET sources",
            "Pass Predictor tracker"
          ]
        },
        {
          "tier": 4,
          "name": "Reading Mega",
          "price_usd": 139,
          "access_days": 60,
          "mocks": 15,
          "past_papers": 10,
          "includes": [
            "Everything in Precision",
            "Full Reading bank - nothing held back"
          ]
        }
      ]
    },
    "listening": {
      "name": "OET Listening Material",
      "price_range_usd": [
        39,
        139
      ],
      "tiers": [
        {
          "tier": 1,
          "name": "Listening Foundation",
          "price_usd": 39,
          "access_days": 30,
          "mocks": 4,
          "past_papers": 1,
          "includes": [
            "Listening cohort lectures",
            "Part A note-completion drills"
          ],
          "excludes": [
            "Part C drills",
            "cheat sheets",
            "Pass Predictor"
          ]
        },
        {
          "tier": 2,
          "name": "Listening Momentum",
          "price_usd": 65,
          "access_days": 40,
          "mocks": 4,
          "past_papers": 3,
          "includes": [
            "Everything in Foundation",
            "Part C drills",
            "Part C lectures from official OET sources"
          ],
          "excludes": [
            "cheat sheets",
            "Pass Predictor"
          ]
        },
        {
          "tier": 3,
          "name": "Listening Precision",
          "price_usd": 93,
          "access_days": 60,
          "most_chosen": true,
          "mocks": 10,
          "past_papers": 5,
          "includes": [
            "Everything in Momentum",
            "Listening B/C cheat sheets",
            "Lectures on using cheat sheets",
            "Daily live spelling sessions",
            "Daily podcasts from official OET sources",
            "Pass Predictor tracker"
          ]
        },
        {
          "tier": 4,
          "name": "Listening Mega",
          "price_usd": 139,
          "access_days": 60,
          "mocks": 15,
          "past_papers": 10,
          "includes": [
            "Everything in Precision",
            "Full Listening bank"
          ]
        }
      ]
    },
    "writing": {
      "name": "OET Writing Material",
      "price_range_usd": [
        39,
        139
      ],
      "marking": "Marked line by line against all six official OET Writing criteria, by a human, not a model.",
      "criteria": [
        "Purpose",
        "Content",
        "Conciseness & Clarity",
        "Genre & Style",
        "Organisation & Layout",
        "Language"
      ],
      "tiers": [
        {
          "tier": 1,
          "name": "Writing Foundation",
          "price_usd": 39,
          "access_days": 30,
          "letter_corrections": 2,
          "case_note_tasks": 4,
          "past_paper_tasks": 1,
          "includes": [
            "Writing cohort lectures",
            "Letter structure and layout drills"
          ],
          "excludes": [
            "writing cheat sheets",
            "Pass Predictor"
          ]
        },
        {
          "tier": 2,
          "name": "Writing Momentum",
          "price_usd": 65,
          "access_days": 40,
          "letter_corrections": 4,
          "case_note_tasks": 8,
          "past_paper_tasks": 3,
          "includes": [
            "Everything in Foundation",
            "Fix, rewrite, re-submit",
            "Criterion-by-criterion drills",
            "Model letter bank with annotated rewrites"
          ],
          "excludes": [
            "writing cheat sheets",
            "Pass Predictor"
          ]
        },
        {
          "tier": 3,
          "name": "Writing Precision",
          "price_usd": 93,
          "access_days": 60,
          "most_chosen": true,
          "letter_corrections": 6,
          "case_note_tasks": 12,
          "past_paper_tasks": 5,
          "includes": [
            "Everything in Momentum",
            "Projected Grade B score per correction",
            "Per-profession case note sets",
            "Writing cheat sheets",
            "Pass Predictor tracker"
          ]
        },
        {
          "tier": 4,
          "name": "Writing Mega",
          "price_usd": 139,
          "access_days": 60,
          "letter_corrections": 12,
          "case_note_tasks": 20,
          "past_paper_tasks": 10,
          "includes": [
            "Everything in Precision",
            "One correction every five days",
            "Full writing bank"
          ],
          "value_note": "12 corrections bought separately cost US$147 - Mega is cheaper and includes everything else."
        }
      ]
    },
    "speaking": {
      "name": "OET Speaking Material",
      "status": "COMING SOON - NOT SELLABLE",
      "assistant_rule": "Do not quote a price or take payment. May say it is launching and offer to record interest."
    }
  },
  "recommendation_engine": {
    "_designed_by": "Assistant, at the owner's request ('recommend what's best'). Rationale: the Complete tiers are primarily ACCESS-DURATION products, so the exam date sets the floor; the size of the score gap then raises it if the gap is large.",
    "step_0_before_recommending": {
      "_owner_directive_2026_08_11": "No diagnostic test at all. Free value means diagnosing the student in conversation, not handing them homework. Analyse first, build trust, then suggest.",
      "rule": "Do not quote a price or name a tier until you have (a) heard which sub-test is failing and roughly what score, and (b) given them a specific free diagnosis of why they are losing those marks.",
      "if_they_know_their_scores": "Use them. Diagnose from them, then recommend.",
      "if_they_do_not_know_their_scores": "Ask what happened in the exam and which section felt worst. That is enough to diagnose. Never fall back on sending a test.",
      "if_they_want_something_concrete": "Offer the 7 day free trial, which includes a real Reading mock and a real Listening mock, no card required. That is the only practice material the assistant offers before purchase.",
      "never": "Never offer, send or link a diagnostic test, and never make any test a gate the student must pass before you will help them."
    },
    "step_1_single_skill_vs_complete": {
      "single_skill_if": "Only ONE sub-test is below Grade B (350) and the others are at or above it.",
      "complete_if": "Two or more sub-tests are below 350, or the candidate does not know their sub-test breakdown.",
      "hard_rule": "If the candidate ASKS about a single skill, sell that single skill. Never cross-sell to Complete Materials."
    },
    "step_2_duration_floor_complete": [
      {
        "weeks_to_exam": "under 6",
        "tier": "Foundation Sprint",
        "price_usd": 187
      },
      {
        "weeks_to_exam": "6 to 9",
        "tier": "Precision Engine",
        "price_usd": 331
      },
      {
        "weeks_to_exam": "9 to 21",
        "tier": "Elite Clearance",
        "price_usd": 503
      },
      {
        "weeks_to_exam": "over 21, or no exam booked",
        "tier": "Total Clearance",
        "price_usd": 773
      }
    ],
    "step_3_gap_floor_complete": [
      {
        "condition": "weakest sub-test 330-349 (very near miss)",
        "floor": "Foundation Sprint",
        "price_usd": 187
      },
      {
        "condition": "weakest sub-test 300-329",
        "floor": "Precision Engine",
        "price_usd": 331,
        "why": "needs cheat sheets, daily drills and the Pass Predictor"
      },
      {
        "condition": "weakest sub-test 250-299",
        "floor": "Elite Clearance",
        "price_usd": 503,
        "why": "needs room to fail a mock and still fix it, plus the day-45 refresh"
      },
      {
        "condition": "weakest sub-test under 250, OR has failed OET twice or more, OR does not know their scores",
        "floor": "Total Clearance",
        "price_usd": 773,
        "why": "the whole library, 40+40 mocks and 20+20 past papers, and 9 months covers a retake without paying twice"
      }
    ],
    "_owner_directive_2026_08_11": "A big gap gets the TOP tier, not a cautious middle one. A candidate scoring under 250, or who has failed twice, does not have a small problem, and selling them a small plan sets them up to fail again and blame the course. Recommend Total Clearance and justify it on the gap, never on price.",
    "step_4_final": "Recommend the HIGHER of the duration floor and the gap floor. Never recommend a tier whose access expires before the exam date.",
    "step_5_single_skill_plan": {
      "_source": "OET HQ's own guidance on the Reading material page.",
      "rules": [
        {
          "condition": "Part A speed is the only problem and the exam is close",
          "plan": "Foundation",
          "price_usd": 39
        },
        {
          "condition": "Losing marks in Part C",
          "plan": "Momentum",
          "price_usd": 65
        },
        {
          "condition": "Has failed this sub-test before",
          "plan": "Precision",
          "price_usd": 93
        },
        {
          "condition": "Wants the entire bank / sitting a mock every third day",
          "plan": "Mega",
          "price_usd": 139
        }
      ]
    },
    "presentation_rule": "Recommend exactly ONE plan and say why in one sentence, tied to their score and exam date. Do not list all tiers unless asked."
  },
  "sales_policy": {
    "qualify_before_quoting": true,
    "qualification_flow": [
      "1. Ask for their WhatsApp number, before helping.",
      "2. Do NOT quote a price on first contact.",
      "3. Provide value first, IN CONVERSATION. Ask which sub-test is failing and roughly what score, then tell them specifically why those marks are being lost. Never send a test to do.",
      "4. Ask profession (doctor / nurse / other) and exam date.",
      "5. Recommend ONE plan using recommendation_engine.",
      "6. If they want something concrete to try, offer the 7 day free trial, no card."
    ],
    "upsell": {
      "rule": "NO cross-sell. Asked about one skill, sell that skill."
    },
    "free_trial": {
      "offer_to": "Anyone hesitating.",
      "detail": "7 days, no card required.",
      "link": "https://oethq.com/auth/register?returnTo=%2Fportal%3FselectTier%3DSTARTER"
    },
    "discounts": {
      "may_offer_on_request": false,
      "_owner_directive_2026_08_11": "NO DISCOUNTS. Not on request, not to close, not ever. Do not drop to a cheaper tier just because someone pushed back on price either, that is a discount wearing a different hat. Sell the plan the candidate's gap actually needs, using sales psychology.",
      "response_pattern": [
        "1. Never name a lower number and never offer a percentage off.",
        "2. Reframe with a question before defending anything: 'How do you think a discount would help you clear faster?'",
        "3. Move the comparison from price to COST OF THE PROBLEM: another exam fee, another few months without the registration, another delayed start date. The expensive option is failing again.",
        "4. Restate concrete deliverables from this file, never vague value: mock counts, past-paper counts, human-marked letter corrections, access length, the day-45 refresh.",
        "5. Remove the risk instead of the price: the 7-day free trial, no card.",
        "6. Close by returning to their gap and their exam date, and restate the ONE plan you recommended."
      ],
      "never_do": [
        "Offer a percentage off, a 'special price', or a 'just for you' rate.",
        "Recommend a cheaper tier as a response to a price objection.",
        "Apologise for the price or describe it as expensive.",
        "Invent a figure for the OET exam fee or any other cost not in this file."
      ],
      "cheaper_tier_rule": "A smaller plan is only correct when the candidate's NEED is smaller (one weak sub-test, or an exam that is very close). It is never the answer to 'it costs too much'."
    },
    "follow_up": {
      "policy": "Indefinite, but TAPERING. Owner instruction was 'follow up doesn't stop'.",
      "schedule_hours": [
        48,
        120,
        336,
        720
      ],
      "schedule_plain": "48 hours, then 5 days, then 14 days, then 30 days, then once a month indefinitely.",
      "tone": "Warm and personal. Owner's framing: 'I took three minutes out of my day to think about you - we did not hear back. Is there anything you would like to discuss?'",
      "hard_stops": [
        "Candidate says stop / not interested / unsubscribe",
        "Candidate purchases",
        "Candidate blocks or reports"
      ],
      "compliance_note": "On the official WhatsApp Business API, messages outside the 24-hour service window need approved templates, and repeated unwanted marketing raises block/report rates, which lowers the number's quality rating and messaging limits. Tapering plus honouring opt-out keeps follow-up indefinite without endangering the number."
    },
    "lead_capture": {
      "enabled": true,
      "fields": [
        "name",
        "whatsapp number",
        "profession",
        "exam date",
        "sub-test scores",
        "tier recommended",
        "objection raised",
        "outcome",
        "follow-up stage"
      ]
    },
    "payment": {
      "method": "Send the oethq.com checkout link for the recommended tier.",
      "never": "Never send bank account numbers, IBANs or card details. Hand off to a human for anything unusual."
    }
  },
  "checkout_links": {
    "_tested": "Every URL below was requested from outside the site on 2026-08-11. Only the homepage returns 200. Everything else returns HTTP 404 to a real visitor, including the free trial registration link.",
    "_site_bug": "oethq.com serves 404 for every route except '/'. Client-side navigation inside the app works, so the pages look fine while you browse, but a link pasted into chat, WhatsApp, email or a new tab is a dead end. This is a Next.js routing/deploy problem, most likely missing SPA fallback or unprerendered routes. Until it is fixed, ANY deep link the assistant sends loses the sale at the moment of highest intent.",
    "assistant_rule": "Send ONLY a URL marked working:true. Never build a path from a pattern. When the tier link is not yet available, send the homepage and name the exact tier and material in words, so the student knows precisely what to click when they arrive.",
    "working": [
      {
        "url": "https://oethq.com",
        "working": true,
        "use_for": "everything, until the routing bug is fixed"
      }
    ],
    "blocked_until_site_is_fixed": [
      {
        "url": "https://oethq.com/courses",
        "working": false,
        "would_be": "OET Complete Materials"
      },
      {
        "url": "https://oethq.com/courses/reading",
        "working": false,
        "would_be": "OET Reading Material"
      },
      {
        "url": "https://oethq.com/courses/listening",
        "working": false,
        "would_be": "OET Listening Material"
      },
      {
        "url": "https://oethq.com/courses/writing",
        "working": false,
        "would_be": "OET Writing Material"
      },
      {
        "url": "https://oethq.com/courses/reading-listening",
        "working": false,
        "would_be": "Reading + Listening"
      },
      {
        "url": "https://oethq.com/courses/writing-corrections",
        "working": false,
        "would_be": "standalone correction packs"
      },
      {
        "url": "https://oethq.com/auth/register?returnTo=%2Fportal%3FselectTier%3DSTARTER",
        "working": false,
        "would_be": "7 day free trial, no card. This is the risk-reversal CTA and it is currently dead."
      }
    ],
    "per_tier": {
      "_status": "NOT AVAILABLE. The site has no per-tier checkout URL. Every 'Invest now' button on every material page is an on-page anchor to #enroll, which tells the student to message WhatsApp. There is nothing tier-specific to link to yet.",
      "_to_enable": "Once the developer ships per-tier URLs and fixes the routing, put them here as {\"Reading Precision\": \"https://...\"} and set _status to READY. The assistant reads this map and will start using them with no other change.",
      "_ask_the_developer_for": "A URL that lands the student directly on checkout for one named tier, for example Reading Precision, that returns 200 when opened cold in a new browser."
    },
    "_owner_note": "Fixing the routing is worth more than anything else on this list. The assistant is already qualifying students and recommending the right tier; right now the last click drops them on a 404."
  },
  "social_proof": {
    "_source": "Read from oethq.com on 2026-08-11. Owner approved using the website wording.",
    "_rule": "These are the ONLY social proof numbers the assistant may use. Round them down when speaking, so they do not go stale or overstate: say 'over 130,000 subscribers', not the exact figure. Never invent a testimonial or name a student.",
    "youtube": {
      "channel": "Let's Crack OET ~ Dr. Nasir",
      "subscribers_shown": "133,580+",
      "say": "over 130,000 subscribers"
    },
    "trustpilot": {
      "rating": 4.8,
      "reviews": 122,
      "listed_as": "OET HQ",
      "say": "4.8 on Trustpilot across more than 120 reviews"
    },
    "track_record": {
      "say": "four years of OET training, and more than 1,000 doctors and nurses through the system"
    },
    "material_provenance": {
      "say": "built in-house by OET examiners and applied linguistics professors, calibrated to the 2026 OET difficulty index"
    },
    "_discrepancy_to_fix": "The homepage says 'Clear the OET HQ past papers before your exam and you have a 90% chance of clearing the real one', which states ONE condition. The owner-confirmed framing in claims_policy requires TWO (past papers AND above 70% on the Pass Predictor). The assistant uses the two-condition version because it is the defensible one. Worth aligning the site to match."
  },
  "claims_policy": {
    "unconditional_guarantee_allowed": false,
    "approved_pass_rate": "90%",
    "approved_framing": "Candidates who clear the OET HQ Reading and Listening past papers AND hold above 70% on the Pass Predictor clear the real exam 90% of the time. Always state BOTH conditions; never the number alone.",
    "forbidden": [
      "Any unconditional promise to pass",
      "'100% guarantee', 'guaranteed pass', 'you will definitely clear'",
      "The 99% figure (owner confirmed 90% is correct; the 99% on the Reading page is an error to be fixed)",
      "The '250 to 280' cheat-sheet movement claim",
      "The 'more than US$200,000 of materials' claim - see value_claim_decision",
      "Any statistic not written in this file"
    ],
    "value_claim_decision": {
      "claim": "'We provide more than US$200,000 of materials'",
      "decision": "DO NOT USE.",
      "reasoning": "It is unverifiable, invites challenge, and sits in the same risk class as guarantee language. Concrete specifics persuade better and are defensible: 40+40 mock tests, 20+20 past papers, human-marked letter corrections, 9 months of access - and Writing Mega genuinely undercuts buying 12 corrections separately ($139 vs $147).",
      "status": "Assistant is forbidden from using it unless the owner overrides."
    }
  },
  "policies": {
    "refund": "Zero refund policy once you invest.",
    "student_fails_exam": {
      "process": [
        "Ask for their official score report.",
        "Identify which sub-tests lost marks and say so plainly.",
        "Recommend the tier that closes that gap, at full price.",
        "A repeat failure means a BIGGER gap, so it means a HIGHER tier, never a cheaper one."
      ],
      "comeback_discount": {
        "assistant_may_offer": false,
        "status": "WITHDRAWN by owner 2026-08-11. There are no discounts anywhere, for any reason. Supersedes the 25% offer confirmed on 2026-08-10.",
        "assistant_rule": "Never mention that a discount exists. Never invite a candidate to share a score report in exchange for a better price. Review the report to diagnose the gap, then recommend the right tier at full price."
      }
    },
    "recordings": "Recorded/scheduled cohort classes are provided.",
    "scheduling": "Candidate picks start date, class time and which sessions to attend.",
    "live_classes": {
      "_owner_directive_2026_08_11": "Live classes are now termed SCHEDULED COHORT CLASSES, and the student picks his or her own time slot.",
      "status": "Running. This supersedes the retired live Zoom 'One Month Premium Course' from the Dr Nasir Academy era, which the assistant must never describe.",
      "how_to_describe": "Scheduled cohort classes, included with the material rather than sold separately, and the student picks the time slot that suits them rather than being fixed to one timing.",
      "never_say": "Do not say there are no live classes. Do not name a delivery platform, it is not confirmed in this file. Do not describe fixed weekly timings, batches, or a demo class.",
      "which_tiers": "Free Trial includes 1 scheduled cohort lecture. Foundation Sprint and above include cohort lectures across all four skills. Precision Engine and above add daily live Reading Part A drills and daily live spelling. Elite Clearance adds the WhatsApp accountability group with Dr. Nasir."
    }
  },
  "handoff_to_human": {
    "always": [
      "Refund requests",
      "Complaints",
      "Payment disputes",
      "Anything involving login credentials or passwords",
      "An angry or distressed candidate",
      "Anything this file does not cover"
    ],
    "tone_on_handoff": "Polite and calm. Acknowledge, do not argue, promise a human will follow up."
  },
  "channels": {
    "whatsapp": {
      "api": "Official WhatsApp Business API.",
      "number": "+92 332 2477237",
      "site_mismatch": "oethq.com currently links to wa.me/15109540245. Until that is changed, inquiries generated by the website go to a different number than the assistant runs on."
    },
    "website_bot": {
      "required": true,
      "note": "Same knowledge and rules, different surface."
    },
    "availability": "24/7",
    "languages": "Reply in whatever language the candidate writes in. Historical base is English + Romanised Urdu; also expect Arabic, Hindi, Malayalam, Tagalog."
  },
  "diagnostic_test": {
    "status": "WITHDRAWN by owner 2026-08-11. The assistant does not send a diagnostic PDF, does not link to one, and does not offer one.",
    "_owner_directive_2026_08_11": "Remove the hosted PDF. Do not give one.",
    "assistant_rule": "Never offer, attach or link a diagnostic test. Diagnose in conversation instead: ask which sub-test is failing and roughly what score, then give a specific free read of why those marks are being lost. That IS the free value.",
    "why_this_is_better": "It also removes three blockers that were holding the flow up: there was no answer key in the PDF, no hosted URL, and no raw-score to band mapping, so a candidate could never have marked it themselves anyway. It also retires the ETHQ vs OET HQ branding mismatch on that document.",
    "if_a_candidate_asks_for_a_practice_test": "Point them at the 7 day free trial, which includes a real Reading mock and a real Listening mock with no card required."
  },
  "website_issues_to_fix": [
    "Reading page states a 99% pass rate; owner confirms 90% is correct. Fix the Reading page.",
    "Complete Materials card shows 'Up to 60d ACCESS RANGE' but tiers sell up to 9 months.",
    "Deep links 404 on direct load - https://oethq.com/courses/reading returns 'Not Found' unless reached by clicking from the homepage. Every link the assistant sends would break. Needs a server-side catch-all route.",
    "wa.me link points to +1 510 954 0245, not the assistant's number."
  ]
};
