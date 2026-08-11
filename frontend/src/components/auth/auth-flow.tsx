"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, clearToken, getPostAuthRedirect, persistAuthSession } from "@/lib/api";
import { PROFESSIONS, HEARD_FROM } from "@/lib/profile-options";
import { getVisitorKey } from "@/lib/attribution";

type Mode = "login" | "register";
type Step = "credentials" | "otp";

type AuthFlowProps = {
  mode: Mode;
};

type AuthResponse = {
  message: string;
  accessToken?: string;
  role?: string;
  email?: string;
  name?: string;
  requiresOtp?: boolean;
  verified?: boolean;
  accessGranted?: boolean;
  accessExpired?: boolean;
  requiresPlanActivation?: boolean;
  activationUrl?: string;
};

export function AuthFlow({ mode }: AuthFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const prefilledEmail = searchParams.get("email");
  const justVerified = searchParams.get("verified") === "1";
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [profession, setProfession] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    clearToken();
  }, []);

  useEffect(() => {
    document.title = mode === "register" ? "Create Account · OET HQ" : "Sign in · OET HQ";
  }, [mode]);

  useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [prefilledEmail]);

  useEffect(() => {
    if (mode === "login" && justVerified) {
      setSuccess("OTP verified. Your email is confirmed — sign in to continue.");
    }
  }, [mode, justVerified]);

  const completeSession = async (res: AuthResponse) => {
    if (!res.accessToken) return;
    await persistAuthSession(
      {
        accessToken: res.accessToken,
        email: res.email,
        name: res.name,
        role: res.role
      },
      {
        email: email.trim(),
        name: name.trim()
      }
    );

    if (res.role === "CANDIDATE") {
      const checkoutReturn =
        Boolean(returnTo) &&
        (returnTo!.startsWith("/checkout") || returnTo!.includes("/checkout?"));

      // Active plan: never send back to payment, even if login had a checkout returnTo.
      if (res.accessGranted && (!returnTo || checkoutReturn)) {
        router.push("/portal");
        return;
      }

      if (!res.accessGranted) {
        if (res.requiresPlanActivation && res.activationUrl && !checkoutReturn) {
          try {
            const url = new URL(res.activationUrl, window.location.origin);
            router.push(`${url.pathname}${url.search}`);
            return;
          } catch {
            // fall through to plans home
          }
        }
        if (checkoutReturn && returnTo) {
          router.push(returnTo);
          return;
        }
        // Internal onboarding hand-off (e.g. free-trial /portal?selectTier=STARTER):
        // send the freshly-verified candidate straight to it so access is applied.
        if (returnTo && returnTo.startsWith("/portal")) {
          router.push(returnTo);
          return;
        }
        router.push("/#packages");
        return;
      }
    }

    router.push(getPostAuthRedirect(res.role, returnTo, { accessGranted: res.accessGranted }));
  };

  const submitPrimary = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload =
        mode === "register"
          ? {
              name: name.trim(),
              email: email.trim(),
              password,
              profession,
              heardFrom,
              // What they TYPED is `heardFrom`. This is what was MEASURED: the
              // browser's visitor id, which the server resolves to the channel
              // that actually brought them. Sending both is the point — the two
              // disagree often, and only one of them can be checked.
              visitorKey: getVisitorKey(),
              ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {})
            }
          : { email: email.trim(), password };

      const res = await apiFetch<AuthResponse>(mode === "register" ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: payload
      });

      // Never auto-login after registration — always collect OTP first.
      if (mode === "register") {
        setStep("otp");
        setOtp("");
        setSuccess(res.message || "Enter the verification code sent to your email.");
        return;
      }

      if (res.requiresOtp && !res.accessToken) {
        setStep("otp");
        setOtp("");
        setSuccess(res.message || "Enter the verification code sent to your email.");
        return;
      }

      if (res.accessToken) {
        await completeSession(res);
        return;
      }

      setError(res.message || "Unexpected response from server.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<AuthResponse>("/auth/otp/verify", {
        method: "POST",
        body: { email: email.trim(), code: otp.trim() }
      });

      // Email verification complete — send the candidate to the login form (no auto session).
      // Important: login already uses this page, so we must reset step out of "otp" or the
      // user stays on Verify and can resubmit a consumed OTP ("Invalid or expired OTP").
      if (mode === "register" || res.verified) {
        clearToken();
        const verifiedEmail = email.trim();
        const loginQuery = new URLSearchParams({
          email: verifiedEmail,
          verified: "1"
        });
        // Carry the onboarding destination (e.g. the free-trial ?selectTier=STARTER
        // hand-off) through email verification so the user lands where they intended.
        if (returnTo) loginQuery.set("returnTo", returnTo);
        setOtp("");
        setPassword("");
        setStep("credentials");
        setSuccess(res.message || "OTP verified. Your email is confirmed — sign in to continue.");
        router.replace(`/auth/login?${loginQuery.toString()}`);
        return;
      }

      if (res.accessToken) {
        await completeSession(res);
        return;
      }

      setError(res.message || "Verification failed.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<AuthResponse>("/auth/otp/resend", {
        method: "POST",
        body: { email: email.trim() }
      });
      setSuccess(res.message || "A new verification code has been sent.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const isFormDisabled =
    loading ||
    !email.trim() ||
    !password ||
    (mode === "register" && (!name.trim() || !profession || !heardFrom || !termsAccepted));
  const isOtpDisabled = loading || otp.trim().length !== 6;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length > 3;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Burning the midnight oil";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="card">
      <div className="kicker">
        {step === "otp"
          ? "Check your email"
          : mode === "register"
            ? `${greeting} · Let’s get you started`
            : `${greeting} · Welcome back`}
      </div>
      <h2>
        {step === "otp"
          ? "Enter verification code"
          : mode === "register"
            ? "Create your account"
            : "Sign in to your portal"}
      </h2>
      <p className="lede">
        {step === "otp"
          ? `Enter the 6-digit code sent to ${email.trim()}.`
          : mode === "register"
            ? "Join 30,000+ doctors and nurses preparing the honest way."
            : "Pick up your plan exactly where you left it."}
      </p>

      {step === "credentials" ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!isFormDisabled) void submitPrimary();
          }}
        >
          {mode === "register" ? (
            <div className="field">
              <input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                required
              />
              <label htmlFor="auth-name">Full name</label>
            </div>
          ) : null}

          <div className={`field${emailValid ? " valid" : ""}`}>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />
            <label htmlFor="auth-email">Email address</label>
            <span className="check">
              <svg viewBox="0 0 24 24">
                <path d="M4 12l6 6L20 7" />
              </svg>
            </span>
          </div>

          {mode === "register" ? (
            <div className="field">
              <input
                id="auth-whatsapp"
                type="tel"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp"
                autoComplete="tel"
              />
              <label htmlFor="auth-whatsapp">WhatsApp number (with country code)</label>
            </div>
          ) : null}

          {mode === "register" ? (
            <div className={`field field-select${profession ? " valid" : ""}`}>
              <select id="auth-profession" value={profession} onChange={(e) => setProfession(e.target.value)} required aria-label="Profession">
                <option value="" disabled>Select your profession…</option>
                {PROFESSIONS.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
              <span className="sel-label">Profession</span>
              <span className="sel-caret" aria-hidden><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg></span>
            </div>
          ) : null}

          {mode === "register" ? (
            <div className={`field field-select${heardFrom ? " valid" : ""}`}>
              <select id="auth-heard" value={heardFrom} onChange={(e) => setHeardFrom(e.target.value)} required aria-label="Where did you hear about us?">
                <option value="" disabled>Select an option…</option>
                {HEARD_FROM.map((h) => (<option key={h.value} value={h.value}>{h.label}</option>))}
              </select>
              <span className="sel-label">Where did you hear about us?</span>
              <span className="sel-caret" aria-hidden><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg></span>
            </div>
          ) : null}

          <PasswordField
            id="auth-password"
            value={password}
            onChange={setPassword}
            label={mode === "register" ? "Create password" : "Password"}
            placeholder={mode === "register" ? "Password" : "Password"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            showStrength={mode === "register"}
          />

          {mode === "login" ? (
            <div className="row-between">
              <label className="remember">
                <input type="checkbox" defaultChecked /> Keep me signed in
              </label>
              <Link className="forgot" href="/auth/forgot-password">
                Forgot password?
              </Link>
            </div>
          ) : (
            <label className="terms">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                required
              />
              <span>
                I agree to the{" "}
                <Link href="/website/terms-and-conditions" target="_blank">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/website/privacy-policy" target="_blank">
                  Privacy Policy
                </Link>
              </span>
            </label>
          )}

          <button className={`btn${loading ? " loading" : ""}`} type="submit" disabled={isFormDisabled}>
            <span className="spinner" aria-hidden="true" />
            <span className="btn-label">{mode === "register" ? "Create my account" : "Sign in"}</span>
            <svg
              className="arrow"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!isOtpDisabled) void submitOtp();
          }}
        >
          <div className="field">
            <input
              id="auth-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              required
            />
            <label htmlFor="auth-otp">Verification code</label>
          </div>

          <button className={`btn${loading ? " loading" : ""}`} type="submit" disabled={isOtpDisabled}>
            <span className="spinner" aria-hidden="true" />
            <span className="btn-label">Verify email</span>
            <svg
              className="arrow"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>

          <div className="row-between" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="forgot"
              style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
              disabled={loading}
              onClick={() => {
                setStep("credentials");
                setOtp("");
                setError(null);
                setSuccess(null);
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="forgot"
              style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
              disabled={loading}
              onClick={() => void resendOtp()}
            >
              Resend code
            </button>
          </div>
        </form>
      )}

      {step === "credentials" ? (
        <>
          <div className="divider">{mode === "register" ? "Already with us" : "New here"}</div>
          <p className="create">
            {mode === "register" ? "Already have an account?" : "Need an account?"}{" "}
            <Link href={mode === "register" ? "/auth/login" : "/auth/register"}>
              {mode === "register" ? "Sign in" : "Create one free"}
            </Link>
          </p>
        </>
      ) : null}

      {error ? (
        <p className="lede" style={{ color: "#b42318", marginTop: 14 }} role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="lede" style={{ color: "#067647", marginTop: 14 }} role="status">
          {success}
        </p>
      ) : null}

      <div className="trust">
        <span>
          <i />
          The N.A.S.I.R System
        </span>
        <span>
          <i />
          Readiness Tracking
        </span>
        <span>
          <i />
          Timed Practice
        </span>
      </div>
    </div>
  );
}

function passwordStrength(value: string) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

function PasswordField({
  id,
  value,
  onChange,
  label,
  placeholder,
  autoComplete,
  showStrength = false
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  autoComplete: string;
  showStrength?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const strength = passwordStrength(value);

  return (
    <>
      <div className="field">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => {
            if (typeof e.getModifierState === "function") {
              setCaps(e.getModifierState("CapsLock"));
            }
          }}
          onBlur={() => setCaps(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          className="toggle-pw"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((v) => !v)}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: show ? 0.45 : 1 }}
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
      {showStrength ? (
        <div className={`strength${strength ? ` s${strength}` : ""}`} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      ) : null}
      <div className={`hint${caps ? " show" : ""}`}>Caps Lock is on</div>
    </>
  );
}
