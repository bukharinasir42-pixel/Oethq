"use client";

import { useState } from "react";
import Link from "next/link";
import { CandidateActivePlanHomeRedirect } from "./candidate-active-plan-home-redirect";
import { WebsiteAuthActions } from "./website-auth-actions";
import { WebsiteLogo } from "./website-logo";

type WebsiteTopNavProps = {
  active?: "courses" | "blogs" | "about" | "contact";
};

export function WebsiteTopNav({ active }: WebsiteTopNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
    <CandidateActivePlanHomeRedirect />
    <header className="bg-white border-b border-slate-200">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <WebsiteLogo priority />

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <Link
            href="/website/courses"
            className={`text-lg transition-colors ${
              active === "courses" ? "text-[#1A2B4A] font-semibold" : "text-slate-600 hover:text-[#1A2B4A]"
            }`}
          >
            OET Courses
          </Link>
          <Link
            href="/blogs"
            className={`text-lg transition-colors ${
              active === "blogs" ? "text-[#1A2B4A] font-semibold" : "text-slate-600 hover:text-[#1A2B4A]"
            }`}
          >
            Blogs
          </Link>
          <Link
            href="/website/about"
            className={`text-lg transition-colors ${
              active === "about" ? "text-[#1A2B4A] font-semibold" : "text-slate-600 hover:text-[#1A2B4A]"
            }`}
          >
            About Us
          </Link>
          <Link
            href="/contact"
            className={`text-lg transition-colors ${
              active === "contact" ? "text-[#1A2B4A] font-semibold" : "text-slate-600 hover:text-[#1A2B4A]"
            }`}
          >
            Contact us
          </Link>
        </nav>

        <WebsiteAuthActions />

        <button
          type="button"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-[#1A2B4A] hover:bg-slate-50 md:hidden"
        >
          {isMobileMenuOpen ? "X" : "☰"}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="mx-4 mb-3 rounded-xl bg-white p-4 text-slate-900 shadow-xl md:hidden">
          <nav className="flex flex-col gap-4 text-base">
            <Link href="/website/courses" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-700 hover:text-slate-900">
              OET Courses
            </Link>
            <Link href="/blogs" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-700 hover:text-slate-900">
              Blogs
            </Link>
            <Link href="/website/about" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-700 hover:text-slate-900">
              About Us
            </Link>
            <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-700 hover:text-slate-900">
              Contact us
            </Link>
            <WebsiteAuthActions
              variant="mobile"
              onNavigate={() => setIsMobileMenuOpen(false)}
            />
          </nav>
        </div>
      )}
    </header>
    </>
  );
}
