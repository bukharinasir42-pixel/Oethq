"use client";

/**
 * OethqContact — premium contact page (design: oethq-contact.html), rebranded to
 * the sky accent. Styles live in premium-course.css (shared shell) + premium-contact.css,
 * all scoped under `.pcl`. Contact channels are real; the message form composes a
 * mailto to the real inbox (no server endpoint exists yet) and shows a sent state.
 */
import { useState } from "react";

import "../courses/_components/premium-course.css";
import "./premium-contact.css";

const EMAIL = "info@oethq.com";
const WA_PRIMARY = "15109540245";

export function OethqContact() {
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState<{ msg: string; on: boolean }>({ msg: "", on: false });

  const showToast = (msg: string) => {
    setToast({ msg, on: true });
    window.setTimeout(() => setToast((t) => ({ ...t, on: false })), 1900);
  };

  const copyEmail = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(EMAIL)
        .then(() => showToast(`Copied ${EMAIL}`))
        .catch(() => showToast(EMAIL));
    } else {
      showToast(EMAIL);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "");
    const email = String(fd.get("email") || "");
    const profession = String(fd.get("profession") || "");
    const topic = String(fd.get("topic") || "");
    const message = String(fd.get("message") || "");
    const subject = `OET HQ enquiry — ${topic}`;
    const body =
      `Name: ${name}\nEmail: ${email}\nProfession: ${profession}\nTopic: ${topic}\n\n${message}`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <div className="pcl">
      <section className="ct">
        <div className="wrap">
          <div className="sec-head rv">
            <p className="sec-eyebrow">Contact us</p>
            <h2>Talk to <em>OET HQ</em></h2>
            <p>Course guidance, enrolment help or plan selection. Tell us where you are stuck and we will point you at the right course.</p>
          </div>

          <div className="ct-grid">
            {/* form */}
            <div className={`ct-form rv${sent ? " sent" : ""}`}>
              {sent ? (
                <div className="ct-sent" style={{ display: "block" }}>
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" /></svg>
                  <b>Message ready to send</b>
                  <p>Your email draft has opened with the details filled in — just hit send. Need an answer now? Message us on WhatsApp.</p>
                </div>
              ) : (
                <>
                  <h3>Send us a message</h3>
                  <p>Most messages are answered the same day.</p>
                  <form onSubmit={onSubmit}>
                    <div className="f-row">
                      <div className="field">
                        <label htmlFor="ct-name">Your name</label>
                        <input id="ct-name" name="name" type="text" required placeholder="Dr. Sana Ahmed" />
                      </div>
                      <div className="field">
                        <label htmlFor="ct-email">Email</label>
                        <input id="ct-email" name="email" type="email" required placeholder="you@example.com" />
                      </div>
                    </div>
                    <div className="f-row">
                      <div className="field">
                        <label htmlFor="ct-prof">Profession</label>
                        <select id="ct-prof" name="profession" defaultValue="Doctor">
                          <option>Doctor</option>
                          <option>Nurse</option>
                          <option>Dentist</option>
                          <option>Pharmacist</option>
                          <option>Physiotherapist</option>
                          <option>Other healthcare professional</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="ct-topic">What do you need</label>
                        <select id="ct-topic" name="topic" defaultValue="Which course is right for me">
                          <option>Which course is right for me</option>
                          <option>Enrolment and payment</option>
                          <option>Complete Course packages</option>
                          <option>Reading or Listening material</option>
                          <option>Live cohort class timings</option>
                          <option>Something else</option>
                        </select>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="ct-msg">Your message</label>
                      <textarea id="ct-msg" name="message" required placeholder="Tell us your last OET result and where you lost marks, and we will tell you exactly what to fix." />
                    </div>
                    <button className="btn btn-blue" type="submit">Send message
                      <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
                    <p className="f-note">
                      <svg viewBox="0 0 24 24"><path d="M12 22s8-4.5 8-10V5l-8-3-8 3v7c0 5.5 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
                      Your details are only used to answer you. No marketing lists.
                    </p>
                  </form>
                </>
              )}
            </div>

            {/* channels */}
            <aside className="ct-panel rv">
              <span className="ct-live"><span className="pulse" />Usually replies in minutes</span>
              <h3>Faster on WhatsApp</h3>
              <p>Send your last score report and we will tell you which paper is costing you the grade.</p>

              <a className="chan" href={`https://wa.me/${WA_PRIMARY}`} target="_blank" rel="noopener noreferrer">
                <span className="chan-ico"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 01-12.6 7.4L3 21l2.2-5.2A8.5 8.5 0 1121 11.5z" /></svg></span>
                <span className="chan-txt"><span>WhatsApp · fastest reply</span><b>+1 510 954 0245</b></span>
                <span className="chan-go"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
              </a>

              <span className="chan copy" role="button" tabIndex={0} onClick={copyEmail}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); copyEmail(); } }}>
                <span className="chan-ico"><svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 6 10-6" /></svg></span>
                <span className="chan-txt"><span>Email · tap to copy</span><b>{EMAIL}</b></span>
                <span className="chan-go"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg></span>
              </span>

              <div className="ct-sep" />

              <div className="ct-addr">
                <span className="chan-ico"><svg viewBox="0 0 24 24"><path d="M12 22s8-6 8-12a8 8 0 10-16 0c0 6 8 12 8 12z" /><circle cx="12" cy="10" r="3" /></svg></span>
                <div>
                  <span>Registered office</span>
                  <p>5900 Balcones Drive STE 12836<br />Austin, TX 78731, USA</p>
                  <a href="https://maps.google.com/?q=5900+Balcones+Drive+STE+12836+Austin+TX+78731" target="_blank" rel="noopener noreferrer">Get directions →</a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <div className={`toast${toast.on ? " on" : ""}`}>{toast.msg}</div>
    </div>
  );
}
