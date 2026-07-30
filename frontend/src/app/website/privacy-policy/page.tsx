import { Poppins } from "next/font/google";
import { WebsiteFooter } from "../_components/website-footer";
import { WebsiteTopNav } from "../_components/website-top-nav";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap"
});

export default function WebsitePrivacyPolicyPage() {
  return (
    <main className={`${poppins.className} min-h-screen bg-slate-50 text-slate-900`}>
      <WebsiteTopNav />

      <section className="mx-auto w-full max-w-5xl px-4 py-12 md:py-16">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Legal</p>
          <h1 className="mt-3 text-3xl font-bold text-[#1A2B4A] md:text-5xl">Privacy Policy</h1>

          <div className="mt-8 space-y-6 text-slate-700">
            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">1. Information We Collect</h2>
              <p className="mt-2">We may collect:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Name</li>
                <li>Email</li>
                <li>Phone number</li>
                <li>Payment details (via third-party processors)</li>
                <li>IP address and device data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">2. Use of Information</h2>
              <p className="mt-2">We use your data to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Provide course access</li>
                <li>Improve services</li>
                <li>Communicate updates</li>
                <li>Prevent fraud and misuse</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">3. Data Protection</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>We implement industry-standard security measures</li>
                <li>Your data is not sold to third parties</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">4. Cookies &amp; Tracking</h2>
              <p className="mt-2">We use cookies to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Improve user experience</li>
                <li>Track usage analytics</li>
                <li>Enhance platform performance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">5. Third-Party Services</h2>
              <p className="mt-2">
                Payments and analytics may involve third-party tools. We are not responsible for their independent
                policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">6. Data Sharing</h2>
              <p className="mt-2">We do not sell your personal data. Data may only be shared if:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Required by law</li>
                <li>Necessary for platform security</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">7. User Rights</h2>
              <p className="mt-2">You may request:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Access to your data</li>
                <li>Correction of incorrect data</li>
                <li>Deletion (subject to legal obligations)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">8. Security Notice</h2>
              <p className="mt-2">Unauthorized access attempts, hacking, or misuse will result in:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Account suspension</li>
                <li>Legal action if required</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#1A2B4A]">Contact</h2>
              <p className="mt-2">
                For privacy requests, contact us at <span className="font-semibold">nasirbukhari230@gmail.com</span>.
              </p>
            </section>
          </div>
        </article>
      </section>

      <WebsiteFooter />
    </main>
  );
}
