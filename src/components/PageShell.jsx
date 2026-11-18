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

export function PageHeader({ title, subtitle }) {
  return (
    <header className="container mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-6 text-center max-w-3xl">
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground leading-tight">{title}</h1>
      {subtitle && <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">{subtitle}</p>}
    </header>
  );
}

export default PageShell;
