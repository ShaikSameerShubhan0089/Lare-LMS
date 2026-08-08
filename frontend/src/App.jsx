import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import AttendDrive from "./pages/AttendDrive.jsx";
import AppChooser from "./pages/AppChooser.jsx";
import Settings from "./pages/Settings.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import MyLearning from "./pages/MyLearning.jsx";
import Achievements from "./pages/Achievements.jsx";
import ExamPortal from "./pages/ExamPortal.jsx";
import Drives from "./pages/Drives.jsx";
import SkillMap from "./pages/SkillMap.jsx";
import CodingPractice from "./pages/CodingPractice.jsx";
import CareerReadiness from "./pages/CareerReadiness.jsx";
import MatchedOpportunities from "./pages/MatchedOpportunities.jsx";
import KeepSharp from "./pages/KeepSharp.jsx";
import Wallet from "./pages/Wallet.jsx";
import WalletVerify from "./pages/WalletVerify.jsx";
import CertificateVerify from "./pages/CertificateVerify.jsx";
import AdaptiveDrill from "./pages/AdaptiveDrill.jsx";
import PeerMesh from "./pages/PeerMesh.jsx";
import Lessons from "./pages/Lessons.jsx";
import PracticeWorlds from "./pages/PracticeWorlds.jsx";
import LessonViewer from "./pages/LessonViewer.jsx";
import Analytics from "./pages/Analytics.jsx";
import Notifications from "./pages/Notifications.jsx";
import Profile from "./pages/Profile.jsx";
import RecruiterDrives from "./pages/recruiter/RecruiterDrives.jsx";
import DriveConsole from "./pages/recruiter/DriveConsole.jsx";
import QuestionBank from "./pages/recruiter/QuestionBank.jsx";
import Assessments from "./pages/Assessments.jsx";
import Certificates from "./pages/Certificates.jsx";
import Tutor from "./pages/Tutor.jsx";
import AdminConsole from "./pages/admin/AdminConsole.jsx";
import CurriculumStudio from "./pages/admin/CurriculumStudio.jsx";
import TrainerConsole from "./pages/admin/TrainerConsole.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";

// Auth guard. `product` selects which app shell wraps the page; `bare` renders
// without a shell (the app chooser). LMS and Drive never share a shell.
// `roles` restricts a page to those roles — hiding a link in the nav is not a
// guard, so staff pages must reject a student who types the URL directly.
function Protected({ children, product, bare, roles }) {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="min-h-screen grid place-items-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles?.length && !(user.roles || []).some((r) => roles.includes(r)))
    return <Navigate to={product === "lms" ? "/lms" : "/drive"} replace />;
  if (bare) return children;
  return <AppShell product={product}>{children}</AppShell>;
}

// Staff role sets — the same ones the backend enforces on the matching routes.
const DRIVE_STAFF = ["super_admin", "company_admin", "recruiter", "college_admin"];
const LMS_STAFF = ["super_admin", "college_admin", "trainer", "content_manager"];

const lms = (el) => <Protected product="lms">{el}</Protected>;
const lmsStaff = (el) => (
  <Protected product="lms" roles={LMS_STAFF}>{el}</Protected>
);
const drive = (el) => <Protected product="drive">{el}</Protected>;
const driveStaff = (el) => (
  <Protected product="drive" roles={DRIVE_STAFF}>{el}</Protected>
);

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      {/* Public, no-login Drive registration */}
      <Route path="/drive/attend" element={<AttendDrive />} />
      <Route path="/verify/wallet/:verifyId" element={<WalletVerify />} />
      <Route path="/verify/:verifyId" element={<CertificateVerify />} />

      {/* Post-login app chooser (two standalone apps, one platform) */}
      <Route path="/apps" element={<Protected bare><AppChooser /></Protected>} />

      {/* ================= LARE Learn (LMS) ================= */}
      <Route path="/lms" element={lms(<Dashboard />)} />
      <Route path="/lms/learning" element={lms(<MyLearning />)} />
      <Route path="/lms/assessments" element={lms(<Assessments />)} />
      <Route path="/lms/skill-map" element={lms(<SkillMap />)} />
      <Route path="/lms/practice" element={lms(<CodingPractice />)} />
      <Route path="/lms/careers" element={lms(<CareerReadiness />)} />
      <Route path="/lms/keep-sharp" element={lms(<KeepSharp />)} />
      <Route path="/lms/wallet" element={lms(<Wallet />)} />
      <Route path="/lms/drill" element={lms(<AdaptiveDrill />)} />
      <Route path="/lms/mesh" element={lms(<PeerMesh />)} />
      <Route path="/lms/lessons" element={lms(<Lessons />)} />
      <Route path="/lms/lesson/:lid" element={lms(<LessonViewer />)} />
      <Route path="/lms/worlds" element={lms(<PracticeWorlds />)} />
      <Route path="/lms/achievements" element={lms(<Achievements />)} />
      <Route path="/lms/tutor" element={lms(<Tutor />)} />
      <Route path="/lms/certificates" element={lms(<Certificates />)} />
      <Route path="/lms/analytics" element={lms(<Analytics />)} />
      <Route path="/lms/admin" element={lmsStaff(<AdminConsole />)} />
      <Route path="/lms/curriculum" element={lmsStaff(<CurriculumStudio />)} />
      <Route path="/lms/trainer" element={lmsStaff(<TrainerConsole />)} />
      <Route path="/lms/notifications" element={lms(<Notifications />)} />
      <Route path="/lms/profile" element={lms(<Profile />)} />
      <Route path="/lms/settings" element={lms(<Settings />)} />

      {/* ================= LARE Hire (Drive) ================= */}
      <Route path="/drive" element={drive(<Drives />)} />
      <Route path="/drive/opportunities" element={drive(<MatchedOpportunities />)} />
      <Route path="/drive/test/:examId" element={drive(<ExamPortal />)} />
      <Route path="/drive/recruiter/drives" element={driveStaff(<RecruiterDrives />)} />
      <Route path="/drive/recruiter/drives/:id" element={driveStaff(<DriveConsole />)} />
      <Route path="/drive/recruiter/questions" element={driveStaff(<QuestionBank />)} />
      <Route path="/drive/notifications" element={drive(<Notifications />)} />
      <Route path="/drive/profile" element={drive(<Profile />)} />
      <Route path="/drive/settings" element={drive(<Settings />)} />

      {/* Back-compat: old /app/* → chooser */}
      <Route path="/app/*" element={<Navigate to="/apps" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
