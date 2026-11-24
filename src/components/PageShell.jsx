import { SiteNavbar } from './SiteNavbar';
import { Footer } from './layout/Footer';

// Shared layout for content pages (About, FAQ, Contact, Legal, Team): site navbar + main + footer.
export function PageShell({ children }) {
  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
      <SiteNavbar />
      <main className="flex-1 w-full">{children}</main>
      <Footer />
    </div>
  );
}

// DEV-191 (trial): content pages open with the same deep-navy band as the home hero.
export function PageHeader({ title, subtitle }) {
  return (
    <header className="hero-navy relative overflow-hidden text-white mb-6 sm:mb-10">
      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center max-w-3xl">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#f0913e] leading-tight">{title}</h1>
        {subtitle && <p className="mt-4 text-base sm:text-lg text-white/85 leading-relaxed">{subtitle}</p>}
      </div>
    </header>
  );
}

export default PageShell;
