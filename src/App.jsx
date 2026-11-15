import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

import { HeroSection } from './components/HeroSection';
import { AboutSection } from './components/AboutSection';
import { ServicesSection } from './components/ServicesSection';
import { VisionSection } from './components/VisionSection';
import { ValuesSection } from './components/ValuesSection';
import { PartnersSection } from './components/PartnersSection';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';
import ChatPage from "./components/ChatPage";
import PartnerDetailsPage from "./pages/PartnerDetailsPage";
import CalendarPage from "./pages/CalendarPage";
import ManageAppointmentPage from "./pages/ManageAppointmentPage";
import AdminPage from "./pages/AdminPage";
import ProjectsPage from "./pages/ProjectsPage.tsx";
import ProjectDetailsPage from "./pages/ProjectDetailsPage.tsx";
import MemberVerifyPage from "./pages/MemberVerifyPage.tsx";
import NotFound from "./pages/NotFound";

function PartnershipRedirect() {
  const { id } = useParams();
  return <Navigate to={`/partners/${id}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
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
              <VisionSection />
              <ValuesSection />
              <CTASection />
              <Footer />
            </div>
          }
        />

        {/* 🤝 Partner Contract Details Page */}
        <Route path="/partners/:id" element={<PartnerDetailsPage />} />

        {/* 🔀 Legacy Partnership Redirect */}
        <Route path="/partnership/:id" element={<PartnershipRedirect />} />

        {/* 🚀 Projects Gallery & Details */}
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/project/:id" element={<ProjectDetailsPage />} />

        {/* 🛡️ Member Verification */}
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
    </BrowserRouter>
  );
}

export default App;