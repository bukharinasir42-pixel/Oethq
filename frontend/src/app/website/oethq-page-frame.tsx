import { OethqFooter } from "./oethq-footer";
import { OethqNav } from "./oethq-nav";

export function OethqPageFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OethqNav />
      <main>{children}</main>
      <OethqFooter />
    </>
  );
}
