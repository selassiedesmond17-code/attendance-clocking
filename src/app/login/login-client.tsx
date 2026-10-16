"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SquareLoader } from "@/components/loaders";
import Brand from "@/components/brand";
import MadeBy from "@/components/made-by";
import { ORG_TYPES } from "@/lib/org-types";
import { checkEmailAction, registerAction, type EmailStatus } from "./actions";

type Tab = "login" | "register";

const MESSAGES: Record<Exclude<EmailStatus, "ok">, string> = {
  not_registered:
    "This email is not registered in any organization. Ask your administrator to add you, or register your organization.",
  pending:
    "Your organization registration is still waiting for approval. We will email you as soon as it is approved.",
  rejected:
    "Your registration was not approved. Please check your email for the reason.",
    error: "Something went wrong. Please try again.",
  superadmin:
    "This email is not registered in any organization. Ask your administrator to add you, or register your organization.",
};

export default function LoginClient({ initialTab }: { initialTab: Tab }) {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);

  // Log in
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Register
  const [regBusy, setRegBusy] = useState(false);
  const [regResult, setRegResult] = useState<{ ok: boolean; message: string } | null>(null);

  function fail(text: string, offerRegister = false) {
    setMessage(text);
    setIsError(true);
    setShowRegister(offerRegister);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    setShowRegister(false);

    const status = await checkEmailAction(email);
    if (status !== "ok") {
      setBusy(false);
      if (status === "pending") {
        setMessage(MESSAGES.pending);
        setIsError(false);
      } else {
        fail(MESSAGES[status], status === "not_registered");
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      fail(error.message);
    } else {
      setStep("code");
      setMessage("We sent a code to your email.");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      fail(error.message);
      return;
    }
    setSigningIn(true);
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/"
    );
    router.refresh();
  }

  async function onRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRegBusy(true);
    setRegResult(null);
    const result = await registerAction(new FormData(e.currentTarget));
    setRegBusy(false);
    setRegResult(result);
  }

  return (
    <main className="page flex min-h-screen max-w-md flex-col justify-center gap-5">
      {signingIn && (
        <div className="splash" role="status">
          <SquareLoader />
          <p className="muted mt-6 text-sm">Signing you in…</p>
          <div className="mt-4">
            <MadeBy />
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Brand size="lg" />
      </div>

      <div className="neu-card flex flex-col gap-4">
        <div className="neu-inset flex gap-2 !p-1">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`neu-btn flex-1 ${tab === "login" ? "neu-btn-primary" : ""}`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={`neu-btn flex-1 ${tab === "register" ? "neu-btn-primary" : ""}`}
          >
            Register
          </button>
        </div>

        {tab === "login" ? (
          <>
            <p className="muted text-sm">
              Sign in with the email address your organization registered. We
              will email you a one-time code.
            </p>
            {step === "email" ? (
              <form onSubmit={sendCode} className="flex flex-col gap-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address"
                  className="neu-input"
                />
                <button disabled={busy} className="neu-btn neu-btn-primary">
                  {busy ? "Checking…" : "Send me a code"}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="flex flex-col gap-4">
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter the code"
                  aria-label="One-time code"
                  className="neu-input tracking-widest"
                />
                <button disabled={busy} className="neu-btn neu-btn-primary">
                  {busy ? "Checking…" : "Sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="neu-link text-sm"
                >
                  Use a different email
                </button>
              </form>
            )}
            {message && (
              <p className={`alert ${isError ? "alert-error" : "alert-ok"}`}>
                {message}
              </p>
            )}
            {showRegister && (
              <button
                type="button"
                onClick={() => setTab("register")}
                className="neu-link text-sm"
              >
                Register your organization
              </button>
            )}
          </>
        ) : regResult?.ok ? (
          <div className="flex flex-col gap-4">
            <p className="alert alert-ok">{regResult.message}</p>
            <button
              type="button"
              onClick={() => {
                setRegResult(null);
                setTab("login");
              }}
              className="neu-btn"
            >
              Back to log in
            </button>
          </div>
        ) : (
          <form onSubmit={onRegister} className="flex flex-col gap-4">
            <p className="muted text-sm">
              Register your organization. We review every registration, and you
              can sign in once it is approved.
            </p>
            <input
              name="org_name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Organization name"
              aria-label="Organization name"
              className="neu-input"
            />
            <label className="field">
              Type of organization
              <select
                name="type"
                required
                defaultValue=""
                className="neu-input mt-1"
              >
                <option value="" disabled>
                  Choose a type…
                </option>
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Time zone
              <select name="timezone" className="neu-input mt-1">
                <option>Africa/Accra</option>
                <option>Africa/Lagos</option>
                <option>Europe/London</option>
                <option>America/New_York</option>
                <option>UTC</option>
              </select>
            </label>
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Your full name"
              aria-label="Your full name"
              className="neu-input"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="Your email address"
              aria-label="Your email address"
              className="neu-input"
            />
            <input
              name="phone"
              type="tel"
              maxLength={30}
              placeholder="Phone number (optional)"
              aria-label="Phone number"
              className="neu-input"
            />
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />
            {regResult && !regResult.ok && (
              <p className="alert alert-error">{regResult.message}</p>
            )}
            <button disabled={regBusy} className="neu-btn neu-btn-primary">
              {regBusy ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Sending…
                </>
              ) : (
                "Register organization"
              )}
            </button>
          </form>
        )}
      </div>

      <MadeBy />
    </main>
  );
}