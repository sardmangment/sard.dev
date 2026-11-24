import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

import { HeroSection } from './components/HeroSection';
import { AboutSection } from './components/AboutSection';
import { ServicesSection } from './components/ServicesSection';
import { PartnersSection } from './components/PartnersSection';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';
import NotFound from "./pages/NotFound";

// CC-15: route-level code splitting (Home stays in the main bundle).
const ChatPage = lazy(() => import("./components/ChatPage"));
const PartnerDetailsPage = lazy(() => import("./pages/PartnerDetailsPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ManageAppointmentPage = lazy(() => import("./pages/ManageAppointmentPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage.tsx"));
const ProjectDetailsPage = lazy(() => import("./pages/ProjectDetailsPage.tsx"));
const MemberVerifyPage = lazy(() => import("./pages/MemberVerifyPage.tsx"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const LegalNoticePage = lazy(() => import("./pages/LegalNoticePage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const CollaborationsPage = lazy(() => import("./pages/CollaborationsPage"));

function PartnershipRedirect() {
  const { id } = useParams();
  return <Navigate to={`/partners/${id}`} replace />;
}

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite">
      <div className="w-8 h-8 rounded-full border-2 border-brand-orange border-t-transparent animate-spin" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>

          {/* 🏠 Home Page */}
          <Route
            path="/"
            element={
              <div className="bg-background text-foreground min-h-screen selection:bg-brand-orange/20 selection:text-foreground">
                <HeroSection />
                <PartnersSection />
                <AboutSection />
                <ServicesSection />
                <CTASection />
                <Footer />
              </div>
            }
          />

          {/* ℹ️ Content pages (CC-13, CC-22, CC-23, CC-24) */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<LegalNoticePage kind="privacy" />} />
          <Route path="/terms" element={<LegalNoticePage kind="terms" />} />

          {/* 🤝 Partner Page (public summary only, C-F03) */}
          <Route path="/partners/:id" element={<PartnerDetailsPage />} />

          {/* 🔀 Legacy Partnership Redirect */}
          <Route path="/partnership/:id" element={<PartnershipRedirect />} />

          {/* 🚀 Projects Gallery & Details (Sard's current projects, no client names — DEV-188) */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/project/:id" element={<ProjectDetailsPage />} />

          {/* 🛡️ Team (direct link only, not in nav/footer, noindex — C-G03/D-35) & Member Verification */}
          <Route path="/team" element={<TeamPage />} />

          {/* 💼 Careers: jobs & training (DEV-192) */}
          <Route path="/careers" element={<CareersPage />} />
          {/* 🤝 Collaborations (DEV-193) */}
          <Route path="/collaborations" element={<CollaborationsPage />} />
          <Route path="/member/:id" element={<MemberVerifyPage />} />

          {/* 🤖 AI Chat Page */}
          <Route path="/ai" element={<ChatPage />} />

          {/* 📅 Calendar Booking Page & Management */}
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/calendar/manage/:id" element={<ManageAppointmentPage />} />

          {/* 🔐 Admin Dashboard Page */}
          <Route path="/admin" element={<AdminPage />} />

          {/* ❓ 404 Catch-All */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
