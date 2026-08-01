import Link from "next/link";
import "./oethq-premium-footer.css";

/**
 * OethqFooter — premium site footer (design: oethq-footer.html), rebranded from
 * gold to the sky accent. All CSS is scoped under `.oethq-ft`. Internal links use
 * next/link to the real site routes (matching the previous footer); external
 * links open in a new tab.
 */

const WA = "https://wa.me/15109540245";
const YT = "https://www.youtube.com/@docnasirofficial";
const TP = "https://www.trustpilot.com/review/oethq.com";

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export function OethqFooter() {
  return (
    <div className="oethq-ft">
      <footer className="ft">
        <div className="wrap">

          <div className="ft-cta">
            <div>
              <p className="eyebrow">Not sure where you are losing marks?</p>
              <h3>Talk to the team before you buy</h3>
            </div>
            <a className="btn btn-gold" href={WA} target="_blank" rel="noopener noreferrer">
              Enrol on WhatsApp <ArrowIcon />
            </a>
          </div>

          <div className="ft-grid">
            <div className="ft-brand">
              <img src="/images/oethq/logo-footer.png" alt="OET HQ" width={123} height={44} />
              <p>Study with focus. Practice with purpose. OET preparation engineered for healthcare professionals in 40+ countries.</p>
              <div className="ft-trust">
                <span className="ft-chip"><svg viewBox="0 0 24 24" className="ft-star"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" /></svg>4.8 on Trustpilot</span>
                <span className="ft-chip"><svg viewBox="0 0 24 24"><path className="st" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle className="st" cx="9" cy="7" r="4" /></svg>1,000+ passed</span>
                <span className="ft-chip"><svg viewBox="0 0 24 24"><rect className="st" x="2" y="5" width="20" height="14" rx="4" /><path className="st" d="M10 9l5 3-5 3z" /></svg>133,580+ subscribers</span>
              </div>
              <div className="ft-social">
                <a href={YT} target="_blank" rel="noopener noreferrer" aria-label="YouTube"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9l5 3-5 3z" /></svg></a>
                <a href={WA} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 01-12.6 7.4L3 21l2.2-5.2A8.5 8.5 0 1121 11.5z" /></svg></a>
                <a href={TP} target="_blank" rel="noopener noreferrer" aria-label="Trustpilot"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" /></svg></a>
              </div>
            </div>

            <div className="ft-col">
              <h4>Courses</h4>
              <Link href="/courses">Complete Material</Link>
              <Link href="/courses/reading-listening">Reading &amp; Listening</Link>
              <Link href="/courses/reading">Reading</Link>
              <Link href="/courses/listening">Listening</Link>
              <Link href="/courses/writing-corrections">Writing Corrections</Link>
              <Link href="/courses">Speaking Role Plays<span className="ft-soon">Soon</span></Link>
            </div>

            <div className="ft-col">
              <h4>OET HQ</h4>
              <Link href="/">Home</Link>
              <Link href="/stories">Success Stories</Link>
              <Link href="/#pricing">Pricing</Link>
              <Link href="/about">About Us</Link>
              <Link href="/contact">Contact Us</Link>
              <Link href="/auth/login">Candidate Portal</Link>
            </div>

            <div className="ft-col">
              <h4>Help &amp; support</h4>
              <a href={YT} target="_blank" rel="noopener noreferrer">YouTube: Let&apos;s Crack OET</a>
              <a href={TP} target="_blank" rel="noopener noreferrer">Reviews on Trustpilot</a>
              <a href={WA} target="_blank" rel="noopener noreferrer">Enrol on WhatsApp</a>
              <Link href="/blogs">Blog</Link>
            </div>
          </div>

          <div className="ft-bar">
            <p>&copy; 2026 OET HQ. All rights reserved.</p>
            <nav className="ft-legal">
              <Link href="/website/terms-and-conditions">Terms</Link>
              <Link href="/website/privacy-policy">Privacy</Link>
              <Link href="/contact">Refund policy</Link>
            </nav>
            <span className="ft-sig">Your friends flew, now you!</span>
          </div>

        </div>
      </footer>
    </div>
  );
}
