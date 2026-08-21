import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import { accessGrant } from "./lib/api.js";
import AccessGate from "./pages/AccessGate.jsx";
import DriveAccessGate from "./pages/DriveAccessGate.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import AttendDrive from "./pages/AttendDrive.jsx";
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
import Notifications from "./pages/Notifications.jsx";
import Profile from "./pages/Profile.jsx";
import LearnProfile from "./pages/LearnProfile.jsx";
import RecruiterDrives from "./pages/recruiter/RecruiterDrives.jsx";
import DriveConsole from "./pages/recruiter/DriveConsole.jsx";
import QuestionBank from "./pages/recruiter/QuestionBank.jsx";
import DriveAccessCodes from "./pages/recruiter/DriveAccessCodes.jsx";
import Assessments from "./pages/Assessments.jsx";
import Certificates from "./pages/Certificates.jsx";
import Tutor from "./pages/Tutor.jsx";
import AdminConsole from "./pages/admin/AdminConsole.jsx";
import CurriculumStudio from "./pages/admin/CurriculumStudio.jsx";
import TrainerConsole from "./pages/admin/TrainerConsole.jsx";
import AccessCodes from "./pages/admin/AccessCodes.jsx";
import RolesPermissions from "./pages/admin/RolesPermissions.jsx";
import UserManagement from "./pages/admin/UserManagement.jsx";
import AnalyticsExplorer from "./pages/admin/AnalyticsExplorer.jsx";
import AuditLog from "./pages/admin/AuditLog.jsx";
import StudentHome from "./pages/StudentHome.jsx";
import ContentStudio from "./pages/admin/ContentStudio.jsx";
import CourseBuilder from "./pages/admin/CourseBuilder.jsx";
import PlacementAnalytics from "./pages/admin/PlacementAnalytics.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";

// Auth guard. `product` selects which app shell wraps the page; `bare` renders
// without a shell (the app chooser). LMS and Drive never share a shell.
// `roles` restricts a page to those roles — hiding a link in the nav is not a
// guard, so staff pages must reject a student who types the URL directly.
function Protected({ children, product, bare, roles, skipGate }) {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="min-h-screen grid place-items-center text-slate-400">Loading…</div>;
  // Separate logins per product — bounce to the matching one.
  if (!user) return <Navigate to={product === "drive" ? "/hire/login" : "/learn/login"} replace />;
  if (roles?.length && !(user.roles || []).some((r) => roles.includes(r)))
    return <Navigate to={product === "lms" ? "/lms" : "/drive"} replace />;
  // LMS Access Gate — a student must present their class Access ID this session
  // before entering the learning environment. Staff/admins are exempt.
  if (product === "lms" && !skipGate) {
    const isStudent = (user.roles || []).includes("student");
    const isStaff = (user.roles || []).some((r) => LMS_STAFF.includes(r));
    if (isStudent && !isStaff && !accessGrant.value)
      return <Navigate to="/lms/access-gate" replace />;
  }
  // Drive Access Gate — a candidate must present their Drive Access ID.
  if (product === "drive" && !skipGate) {
    const isStudent = (user.roles || []).includes("student");
    const isStaff = (user.roles || []).some((r) => DRIVE_STAFF.includes(r));
    if (isStudent && !isStaff && !accessGrant.value)
      return <Navigate to="/drive/access-gate" replace />;
  }
  if (bare) return children;
  return <AppShell product={product}>{children}</AppShell>;
}

// Staff role sets — the same ones the backend enforces on the matching routes.
const DRIVE_STAFF = ["super_admin", "company_admin", "recruiter", "college_admin"];
const LMS_STAFF = ["super_admin", "college_admin", "trainer", "content_manager"];

// Platform administration (RBAC, and later the Super Admin portal). The backend
// enforces the actual capability via granular permissions; this is the coarse
// route gate on top of that.
const PLATFORM_ADMIN = ["super_admin", "company_admin"];

const lms = (el) => <Protected product="lms">{el}</Protected>;
const lmsStaff = (el) => (
  <Protected product="lms" roles={LMS_STAFF}>{el}</Protected>
);
const platformAdmin = (el) => (
  <Protected product="lms" roles={PLATFORM_ADMIN}>{el}</Protected>
);
// Institution analytics — leadership & academic roles. The backend clips every
// rollup to the caller's scope, so the same page serves each role's own view.
const ANALYTICS_ROLES = ["super_admin", "company_admin", "college_admin",
  "principal", "dean", "tpo", "faculty", "trainer"];
const analyticsView = (el) => (
  <Protected product="lms" roles={ANALYTICS_ROLES}>{el}</Protected>
);
// Content authoring — admins, trainers and faculty (backend enforces the
// academic.course.manage / lms.curriculum.manage permission).
const CONTENT_AUTHORS = ["super_admin", "company_admin", "college_admin", "trainer", "faculty"];
const contentAuthor = (el) => (
  <Protected product="lms" roles={CONTENT_AUTHORS}>{el}</Protected>
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
      {/* Separate logins per product (separate accounts). /login & /register keep
          working as the Learn defaults. */}
      <Route path="/login" element={<Login product="learn" />} />
      <Route path="/register" element={<Register product="learn" />} />
      <Route path="/learn/login" element={<Login product="learn" />} />
      <Route path="/learn/register" element={<Register product="learn" />} />
      <Route path="/hire/login" element={<Login product="hire" />} />
      <Route path="/hire/register" element={<Register product="hire" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      {/* Public, no-login Drive registration */}
      <Route path="/drive/attend" element={<AttendDrive />} />
      <Route path="/verify/wallet/:verifyId" element={<WalletVerify />} />
      <Route path="/verify/:verifyId" element={<CertificateVerify />} />

      {/* ================= LARE Learn (LMS) ================= */}
      {/* Access Gate — students validate their class Access ID before entry. */}
      <Route path="/lms/access-gate" element={<Protected product="lms" bare skipGate><AccessGate /></Protected>} />
      <Route path="/lms" element={lms(<Dashboard />)} />
      <Route path="/lms/roadmap" element={lms(<StudentHome />)} />
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
      <Route path="/lms/admin" element={lmsStaff(<AdminConsole />)} />
      <Route path="/lms/curriculum" element={lmsStaff(<CurriculumStudio />)} />
      <Route path="/lms/trainer" element={lmsStaff(<TrainerConsole />)} />
      <Route path="/lms/access-codes" element={lmsStaff(<AccessCodes />)} />
      <Route path="/lms/roles" element={platformAdmin(<RolesPermissions />)} />
      <Route path="/lms/users" element={platformAdmin(<UserManagement />)} />
      <Route path="/lms/institution-analytics" element={analyticsView(<AnalyticsExplorer />)} />
      <Route path="/lms/placement" element={analyticsView(<PlacementAnalytics />)} />
      <Route path="/lms/audit" element={platformAdmin(<AuditLog />)} />
      <Route path="/lms/course-builder" element={contentAuthor(<CourseBuilder />)} />
      {/* Deep links to the individual studios still resolve; the nav uses Course Builder. */}
      <Route path="/lms/content-studio" element={contentAuthor(<ContentStudio />)} />
      <Route path="/lms/notifications" element={lms(<Notifications />)} />
      <Route path="/lms/profile" element={lms(<LearnProfile />)} />
      <Route path="/lms/settings" element={lms(<Settings />)} />

      {/* ================= LARE Hire (Drive) ================= */}
      {/* Access Gate — candidates validate their Drive Access ID before entry. */}
      <Route path="/drive/access-gate" element={<Protected product="drive" bare skipGate><DriveAccessGate /></Protected>} />
      <Route path="/drive" element={drive(<Drives />)} />
      <Route path="/drive/opportunities" element={drive(<MatchedOpportunities />)} />
      <Route path="/drive/test/:examId" element={drive(<ExamPortal />)} />
      <Route path="/drive/recruiter/drives" element={driveStaff(<RecruiterDrives />)} />
      <Route path="/drive/recruiter/drives/:id" element={driveStaff(<DriveConsole />)} />
      <Route path="/drive/recruiter/questions" element={driveStaff(<QuestionBank />)} />
      <Route path="/drive/recruiter/access-codes" element={driveStaff(<DriveAccessCodes />)} />
      <Route path="/drive/notifications" element={drive(<Notifications />)} />
      <Route path="/drive/profile" element={drive(<Profile />)} />
      <Route path="/drive/settings" element={drive(<Settings />)} />

      {/* Back-compat: the old chooser is gone — send to the home page. */}
      <Route path="/apps" element={<Navigate to="/" replace />} />
      <Route path="/app/*" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
