"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getStoredUser } from "@/lib/api";
import { useSession } from "@/hooks/use-session";

type WebsiteAuthActionsProps = {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  /** Match reference homepage Sign In / account controls. */
  appearance?: "default" | "oethq";
};

function resolveDisplayName(profile: ReturnType<typeof useSession>["profile"]) {
  const stored = getStoredUser();
  return (
    profile?.name?.trim() ||
    stored?.name?.trim() ||
    profile?.email?.trim() ||
    stored?.email?.trim() ||
    "Account"
  );
}

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name[0] || "U").toUpperCase();
}

function isCandidateSession(
  token: string | null,
  profile: ReturnType<typeof useSession>["profile"],
  status: ReturnType<typeof useSession>["status"]
) {
  if (!token || status === "unauth") return false;
  if (status === "authed" && profile?.role === "CANDIDATE") return true;
  if (status === "loading" || status === "idle") {
    const stored = getStoredUser();
    return Boolean(stored?.email || stored?.name || stored?.role === "CANDIDATE");
  }
  return false;
}

export function WebsiteAuthActions({
  variant = "desktop",
  onNavigate,
  appearance = "default"
}: WebsiteAuthActionsProps) {
  const { token, profile, status, logout } = useSession();
  const loggedInCandidate = isCandidateSession(token, profile, status);
  const displayName = resolveDisplayName(profile);
  const initials = getInitials(displayName);
  const isOethq = appearance === "oethq";

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const button = profileButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuWidth = 224;
    setMenuPosition({
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - menuWidth)
    });
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    updateMenuPosition();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (profileButtonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setDropdownOpen(false);
    }

    function handleViewportChange() {
      updateMenuPosition();
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [dropdownOpen, updateMenuPosition]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleLogout = useCallback(() => {
    setDropdownOpen(false);
    onNavigate?.();
    logout("/", { hard: true });
  }, [logout, onNavigate]);

  if (!mounted) {
    return null;
  }

  if (loggedInCandidate) {
    if (variant === "mobile") {
      return (
        <div className={isOethq ? "space-y-3" : "mt-2 space-y-3 border-t border-slate-200 pt-4"}>
          <p className="text-sm font-semibold text-slate-900">{displayName}</p>
          <button
            type="button"
            onClick={handleLogout}
            className={
              isOethq
                ? "hp-signin w-full text-center"
                : "inline-flex w-fit rounded-md border border-[#1A2B4A] px-5 py-2 font-semibold text-[#1A2B4A] hover:bg-slate-50"
            }
          >
            Logout
          </button>
        </div>
      );
    }

    const dropdownMenu =
      dropdownOpen && mounted
        ? createPortal(
            <div
              ref={menuRef}
              style={{ top: menuPosition.top, left: menuPosition.left }}
              className="fixed z-[9999] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">Candidate</p>
              </div>
              <div className="p-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>,
            document.body
          )
        : null;

    return (
      <>
        <div className={isOethq ? "relative" : "relative hidden md:block"}>
          <button
            ref={profileButtonRef}
            type="button"
            aria-label="Profile menu"
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
            onClick={() => {
              setDropdownOpen((prev) => !prev);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1A2B4A] text-sm font-bold text-white transition-shadow hover:ring-2 hover:ring-[#1A2B4A]/30 hover:ring-offset-2"
          >
            {initials}
          </button>
        </div>
        {dropdownMenu}
      </>
    );
  }

  if (variant === "mobile") {
    return (
      <Link
        href="/auth/login"
        onClick={onNavigate}
        className={
          isOethq
            ? "hp-signin"
            : "mt-2 inline-flex w-fit rounded-md bg-[#1A2B4A] px-5 py-2 font-semibold text-white hover:bg-[#152038]"
        }
      >
        {isOethq ? "Sign In" : "Login"}
      </Link>
    );
  }

  return (
    <Link
      href="/auth/login"
      className={
        isOethq
          ? "hp-signin"
          : "hidden items-center rounded-md bg-[#1A2B4A] px-5 py-2 font-semibold text-white transition-colors hover:bg-[#152038] md:inline-flex"
      }
    >
      {isOethq ? "Sign In" : "Login"}
    </Link>
  );
}
