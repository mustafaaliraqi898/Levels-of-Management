import React, { useState, useEffect } from 'react';
import { ActiveTab, AcademicYear, AuthSession } from './types';
import { db, DatabaseState } from './services/storage';
import { authService } from './services/auth';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/Dashboard/DashboardView';
import { GradeEntryView } from './components/GradeEntry/GradeEntryView';
import { DecisionMarksView } from './components/Exemption/DecisionMarksView';
import { ResultsView } from './components/Results/ResultsView';
import { ExemptionView } from './components/Exemption/ExemptionView';
import { ReportsView } from './components/Reports/ReportsView';
import { YearsManagement } from './components/Management/YearsManagement';
import { ClassesManagement } from './components/Management/ClassesManagement';
import { StudentsManagement } from './components/Management/StudentsManagement';
import { SubjectsManagement } from './components/Management/SubjectsManagement';
import { BackupRestoreView } from './components/Backup/BackupRestoreView';
import { SettingsView } from './components/Settings/SettingsView';
import { CertificateTemplateView } from './components/CertificateTemplate/CertificateTemplateView';
import { StudentPromotionView } from './components/Management/StudentPromotionView';
import { LoginView } from './components/Auth/LoginView';
import { CreateAccessCodeView } from './components/Auth/CreateAccessCodeView';
import { ForceChangePasswordModal } from './components/Auth/ForceChangePasswordModal';
import { AccountSettingsModal } from './components/Auth/AccountSettingsModal';

export default function App() {
  // Database reactive state
  const [dbState, setDbState] = useState<DatabaseState>(() => db.getState());

  // Authentication session state
  const [authSession, setAuthSession] = useState<AuthSession | null>(() =>
    authService.getCurrentSession()
  );
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Active Tab state (defaults to dashboard upon login)
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sidebar collapse state with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('school_app_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('school_app_sidebar_collapsed', String(next));
      } catch (e) {
        console.warn('Failed to save sidebar state to localStorage', e);
      }
      return next;
    });
  };

  // Theme state with localStorage persistence (Default: 'dark')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('school_app_theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (e) {
      console.warn('Failed to load theme from localStorage', e);
    }
    return 'dark';
  });

  // Apply theme class to document element and persist
  useEffect(() => {
    try {
      localStorage.setItem('school_app_theme', theme);
      if (theme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    } catch (e) {
      console.warn(e);
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Subscribe to real-time database changes
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      const currentState = db.getState();
      setDbState({
        ...currentState,
        grades: { ...currentState.grades },
        students: [...currentState.students],
        classes: [...currentState.classes],
        sections: [...currentState.sections],
        subjects: [...currentState.subjects],
        academicYears: [...currentState.academicYears],
      });
    });
    return () => { unsubscribe(); };
  }, []);

  // Subscribe to auth session changes
  useEffect(() => {
    const unsubAuth = authService.subscribe((sess) => {
      setAuthSession(sess ? { ...sess } : null);
    });
    return () => unsubAuth();
  }, []);

  const handleLoginSuccess = (session: AuthSession) => {
    setAuthSession(session);
    // Explicit requirement: Transition to dashboard (لوحة التحكم), NOT grade_entry!
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    authService.logout();
    setAuthSession(null);
    setIsAccountModalOpen(false);
  };

  // 1. If not authenticated, render LoginView directly (first launch & subsequent cold starts)
  if (!authSession) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  // 2. If authenticated, but Access Code has NOT been configured yet, show CreateAccessCodeView once
  if (!db.isAccessCodeConfigured()) {
    return (
      <CreateAccessCodeView
        username={authSession.user.username}
        onComplete={() => {
          const curr = db.getState();
          setDbState({ ...curr });
          const refreshed = authService.getCurrentSession();
          if (refreshed) {
            setAuthSession({ ...refreshed, user: { ...refreshed.user, mustChangePassword: false } });
          }
          setActiveTab('dashboard');
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  const currentYear =
    dbState.academicYears.find((y: AcademicYear) => y.isCurrent) ||
    dbState.academicYears[0];

  return (
    <div
      className={`min-h-screen ${
        theme === 'dark' ? 'bg-[#202631] text-[#E0E6ED]' : 'bg-[#F3F5F7] text-[#414957]'
      } flex flex-row-reverse transition-colors duration-200 print:bg-white print:text-black print:block`}
      dir="rtl"
    >
      {/* Forced Password Change Modal for initial admin login */}
      {authSession.user.mustChangePassword && (
        <ForceChangePasswordModal
          userId={authSession.user.id}
          username={authSession.user.username}
          theme={theme}
          onPasswordChanged={() => {
            const refreshed = authService.getCurrentSession();
            setAuthSession(refreshed ? { ...refreshed } : null);
            setActiveTab('dashboard');
          }}
        />
      )}

      {/* Account Settings Modal */}
      {isAccountModalOpen && (
        <AccountSettingsModal
          session={authSession}
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          onUserUpdated={() => {
            const refreshed = authService.getCurrentSession();
            setAuthSession(refreshed ? { ...refreshed } : null);
          }}
          theme={theme}
        />
      )}

      {/* Right-aligned Arabic Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        settings={dbState.settings}
        currentYearName={currentYear?.name}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        currentUser={authSession.user}
        onOpenAccountSettings={() => setIsAccountModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-200 ease-in-out ${
          isSidebarCollapsed ? 'md:mr-20' : 'md:mr-72'
        } min-h-screen overflow-x-hidden print:m-0 print:p-0 print:w-full print:max-w-none print:overflow-visible`}
      >
        <Header
          activeTab={activeTab}
          settings={dbState.settings}
          currentYearName={currentYear?.name}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onNavigateToBackup={() => setActiveTab('backup')}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          currentUser={authSession.user}
          onOpenAccountSettings={() => setIsAccountModalOpen(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto min-w-0 print:m-0 print:p-0 print:max-w-none print:w-full print:overflow-visible">
          {activeTab === 'dashboard' && (
            <DashboardView
              academicYears={dbState.academicYears}
              classes={dbState.classes}
              sections={dbState.sections}
              subjects={dbState.subjects}
              students={dbState.students}
              grades={dbState.grades}
              settings={dbState.settings}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'grade_entry' && (
            <GradeEntryView
              academicYears={dbState.academicYears}
              classes={dbState.classes}
              sections={dbState.sections}
              subjects={dbState.subjects}
              students={dbState.students}
              grades={dbState.grades}
              settings={dbState.settings}
              onNavigateToReports={() => setActiveTab('reports')}
            />
          )}

          {activeTab === 'decision_marks' && (
            <DecisionMarksView
              academicYears={dbState.academicYears}
              classes={dbState.classes}
              sections={dbState.sections}
              subjects={dbState.subjects}
              students={dbState.students}
              grades={dbState.grades}
              settings={dbState.settings}
            />
          )}

          {activeTab === 'results' && (
            <ResultsView
              academicYears={dbState.academicYears}
              classes={dbState.classes}
              sections={dbState.sections}
              subjects={dbState.subjects}
              students={dbState.students}
              grades={dbState.grades}
              settings={dbState.settings}
            />
          )}

          {activeTab === 'exemption' && (
            <ExemptionView
              academicYears={dbState.academicYears}
              classes={dbState.classes}
              sections={dbState.sections}
              subjects={dbState.subjects}
              students={dbState.students}
              grades={dbState.grades}
              settings={dbState.settings}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              academicYears={dbState.academicYears}
              classes={dbState.classes}
              sections={dbState.sections}
              subjects={dbState.subjects}
              students={dbState.students}
              grades={dbState.grades}
              settings={dbState.settings}
            />
          )}

          {activeTab === 'certificate_template' && (
            <CertificateTemplateView
              settings={dbState.settings}
              academicYears={dbState.academicYears}
              classes={dbState.classes}
              sections={dbState.sections}
              students={dbState.students}
            />
          )}

          {activeTab === 'student_promotion' && (
            <StudentPromotionView
              academicYears={dbState.academicYears}
              classes={dbState.classes}
              sections={dbState.sections}
              subjects={dbState.subjects}
              students={dbState.students}
              grades={dbState.grades}
              settings={dbState.settings}
              onNavigateToStudents={() => setActiveTab('students')}
            />
          )}

          {activeTab === 'years' && (
            <YearsManagement years={dbState.academicYears} />
          )}

          {activeTab === 'classes' && (
            <ClassesManagement
              classes={dbState.classes}
              sections={dbState.sections}
              students={dbState.students}
              subjects={dbState.subjects}
              grades={dbState.grades}
              academicYears={dbState.academicYears}
            />
          )}

          {activeTab === 'students' && (
            <StudentsManagement
              students={dbState.students}
              classes={dbState.classes}
              sections={dbState.sections}
              academicYears={dbState.academicYears}
              onNavigateToPromotion={() => setActiveTab('student_promotion')}
            />
          )}

          {activeTab === 'subjects' && (
            <SubjectsManagement
              subjects={dbState.subjects}
              classes={dbState.classes}
              academicYears={dbState.academicYears}
            />
          )}

          {activeTab === 'backup' && <BackupRestoreView />}

          {activeTab === 'settings' && (
            <SettingsView
              settings={dbState.settings}
              currentUserId={authSession.user.id}
              userRole={authSession.user.role}
              currentAcademicYearId={currentYear?.id}
            />
          )}
        </main>
      </div>
    </div>
  );
}
