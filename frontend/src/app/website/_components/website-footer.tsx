import Link from "next/link";

export function WebsiteFooter() {
  return (
    <footer className="bg-[#1a2b4a] py-14 text-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 md:grid-cols-3">
        <div>
          <h3 className="text-lg font-semibold">Quick Links</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            <li>
              <Link href="/" className="hover:underline text-white">
                Home
              </Link>
            </li>
            <li>
              <Link href="/website/courses" className="hover:underline text-white">
                OET Courses
              </Link>
            </li>
            <li>
              <Link href="/blogs" className="hover:underline text-white">
                Blogs
              </Link>
            </li>
            <li>
              <Link href="/website/about" className="hover:underline text-white">
                About Us
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:underline text-white">
                Contact us
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold">Help &amp; Support</h3>
          <p className="mt-4 text-sm text-white">Phone: +15109540245</p>
          <p className="text-sm text-white">Email: nasirbukhari230@gmail.com</p>
          <p className="text-sm text-white">Address: 5900 BALCONES DRIVE STE 12836, Austin, TX, 78731, USA</p>
        </div>
        <div>
          <h3 className="text-lg font-semibold">Legal</h3>
          <ul className="mt-4 space-y-2 text-sm text-white">
            <li>
              <Link href="/website/privacy-policy" className="hover:underline text-white">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/website/terms-and-conditions" className="hover:underline text-white">
                Terms &amp; Conditions
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-10 text-center text-sm text-white">© Copyright DrNasirAcademy 2026, All Rights Reserved.</p>
    </footer>
  );
}
