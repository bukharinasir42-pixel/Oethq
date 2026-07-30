import { Poppins } from "next/font/google";
import { WebsiteFooter } from "../_components/website-footer";
import { WebsiteTopNav } from "../_components/website-top-nav";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap"
});

export default function WebsiteTermsPage() {
  return (
    <main className={`${poppins.className} min-h-screen bg-slate-50 text-slate-900`}>
      <WebsiteTopNav />

      <section className="mx-auto w-full max-w-5xl px-4 py-12 md:py-16">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Legal</p>
          <h1 className="mt-3 text-3xl font-bold text-[#1A2B4A] md:text-5xl">Terms &amp; Conditions</h1>

          <div className="mt-8 space-y-6 text-slate-700">
            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">1. Acceptance of Terms</h2>
              <p className="mt-2">
                By accessing or purchasing from this platform, you agree to comply with these Terms. If you do not
                agree, you must not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">2. Services Offered</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>OET preparation courses (Reading, Listening, Writing, Speaking)</li>
                <li>Mock tests, past papers, and study materials</li>
                <li>Recorded lectures, live classes, and feedback services</li>
              </ul>
              <p className="mt-2">All services are digital and proprietary.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">3. User Responsibilities</h2>
              <p className="mt-2">You agree:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Not to share login credentials</li>
                <li>Not to distribute, reproduce, or resell any content</li>
                <li>To use services only for personal educational purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">4. Intellectual Property &amp; Copyright Protection</h2>
              <p className="mt-2">All content including videos, PDFs, mock tests, cheat sheets, and strategies are the exclusive intellectual property of Let&apos;s Crack OET by Dr. Nasir.</p>
              <h3 className="mt-4 text-lg font-semibold text-[#1A2B4A]">Strict Prohibition</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Recording lectures</li>
                <li>Taking screenshots</li>
                <li>Sharing materials (free or paid)</li>
                <li>Uploading content on any platform (Telegram, WhatsApp, YouTube, etc.)</li>
              </ul>
              <h3 className="mt-4 text-lg font-semibold text-[#1A2B4A]">Enforcement Actions</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>First violation: Warning + temporary suspension (5-7 days)</li>
                <li>Second violation: Permanent account termination</li>
                <li>Device &amp; IP ban enforced</li>
              </ul>
              <h3 className="mt-4 text-lg font-semibold text-[#1A2B4A]">Legal Action</h3>
              <p className="mt-2">
                Unauthorized distribution or copyright violation may result in legal proceedings under applicable
                intellectual property laws, including claims for damages, financial losses, and legal costs.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">5. Account Access &amp; Security</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Each user gets single-user access</li>
                <li>Multiple logins or suspicious activity: immediate suspension</li>
                <li>We reserve the right to terminate accounts without refund if misuse is detected</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">6. Payment Terms</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>All payments are final unless covered under refund policy</li>
                <li>Prices may change at any time without prior notice</li>
                <li>Promotional offers are time-limited</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">7. Limitation of Liability</h2>
              <p className="mt-2">We do not guarantee:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Exam success</li>
                <li>Score improvement</li>
                <li>Visa or job outcomes</li>
              </ul>
              <p className="mt-2">We provide educational support only.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">8. Disclaimer</h2>
              <p className="mt-2">
                Our materials are based on experience and training strategies. We are not affiliated with official OET
                authorities.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">9. Termination Rights</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Suspend or terminate accounts</li>
                <li>Restrict access without notice if terms are violated</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">10. Governing Law</h2>
              <p className="mt-2">
                These terms are governed under applicable international digital commerce and intellectual property laws.
                Disputes shall be resolved in a competent legal jurisdiction determined by the platform.
              </p>
            </section>

            <section className="border-t border-slate-200 pt-6">
              <h2 className="text-2xl font-bold text-[#1A2B4A]">Refund Policy</h2>
              <section className="mt-4">
                <h3 className="text-lg font-semibold text-[#1A2B4A]">1. Eligibility for Refund</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Refunds are only applicable if the course has not been accessed, started, or consumed</li>
                </ul>
              </section>
              <section className="mt-4">
                <h3 className="text-lg font-semibold text-[#1A2B4A]">2. Non-Refundable Cases</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Course content has been accessed (even partially)</li>
                  <li>Login credentials have been used</li>
                  <li>Materials have been downloaded or viewed</li>
                </ul>
              </section>
              <section className="mt-4">
                <h3 className="text-lg font-semibold text-[#1A2B4A]">3. Partial Refund (Depreciation Model)</h3>
                <p className="mt-2">Refund = Total Amount - Value of Consumed Content</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Each lecture, test, or resource is considered consumed value</li>
                  <li>Administrative charges may apply</li>
                </ul>
              </section>
              <section className="mt-4">
                <h3 className="text-lg font-semibold text-[#1A2B4A]">4. Strict No Refund Cases</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Account misuse</li>
                  <li>Content sharing</li>
                  <li>Violation of policies</li>
                </ul>
              </section>
              <section className="mt-4">
                <h3 className="text-lg font-semibold text-[#1A2B4A]">5. Processing Time</h3>
                <p className="mt-2">Approved refunds will be processed within 7-14 working days.</p>
              </section>
            </section>

            <section className="border-t border-slate-200 pt-6">
              <h2 className="text-2xl font-bold text-[#1A2B4A]">Additional Platform Rules (Important)</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>Screenshots are monitored and penalized</li>
                <li>Sharing materials is strictly prohibited</li>
                <li>Fake claims or defamation may result in legal action</li>
                <li>Multiple account creation is banned</li>
              </ul>
            </section>
          </div>
        </article>
      </section>

      <WebsiteFooter />
    </main>
  );
}
