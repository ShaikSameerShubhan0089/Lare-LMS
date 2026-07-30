// Thin fetch client for the LARE API. Talks to /api (dev-proxied to the Gateway
// at :8000, which routes onward to every service). Handles the
// { data, meta, errors } envelope and JWT tokens.

const ACCESS_KEY = "lare_access";
const REFRESH_KEY = "lare_refresh";

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ access_token, refresh_token }) {
    if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Silently exchange the refresh token for a new access token. De-duplicated so a
// burst of concurrent 401s triggers only one refresh, and everyone awaits it.
// Returns "ok" | "expired" (refresh token invalid → log out) | "error"
// (network/server blip → keep the session, do NOT log out).
let _refreshing = null;
async function refreshAccess() {
  if (_refreshing) return _refreshing;
  const rt = tokens.refresh;
  if (!rt) return "expired";
  _refreshing = (async () => {
    try {
      const res = await fetch("/api/auth/v1/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload?.data?.access_token) { tokens.set(payload.data); return "ok"; }
        return "error";
      }
      // Only a 401/403 means the refresh token itself is invalid/expired.
      // 5xx / anything else is transient — never nuke the session for it.
      return res.status === 401 || res.status === 403 ? "expired" : "error";
    } catch {
      return "error"; // network failure (e.g. tunnel hiccup) — keep session
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

async function request(path, opts = {}) {
  const { method = "GET", body, auth = true, raw = false, _retried = false } = opts;
  const headers = { "Content-Type": "application/json" };
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // Never let the browser reuse a cached response: these are per-user (the
    // cache key is the URL, not the token), so on a shared machine a cached
    // /me would leak the previous user's profile to the next student.
    cache: "no-store",
  });

  if (raw) return res;

  // Access token expired mid-session: refresh once and replay the request, so a
  // long session never dumps the user back to login. Only clear the session when
  // the refresh token is genuinely invalid ("expired") — a transient network or
  // server error keeps the session so the user can retry (critical mid-exam).
  if (res.status === 401 && auth && !_retried && tokens.refresh) {
    const outcome = await refreshAccess();
    if (outcome === "ok") {
      return request(path, { ...opts, _retried: true });
    }
    if (outcome === "expired") {
      tokens.clear();
    }
    // outcome === "error": leave tokens in place; surface the 401 to the caller.
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* empty / non-JSON */
  }

  if (!res.ok) {
    const err = payload?.errors?.[0];
    throw new ApiError(
      err?.message || `Request failed (${res.status})`,
      err?.code,
      res.status,
      err?.details,
    );
  }
  return payload?.data;
}

export const api = {
  // ---- auth ----
  register: (email, password, full_name) =>
    request("/auth/v1/register", { method: "POST", auth: false, body: { email, password, full_name } }),
  login: (email, password) =>
    request("/auth/v1/login", { method: "POST", auth: false, body: { email, password, device: "web" } }),
  refresh: (refresh_token) =>
    request("/auth/v1/refresh", { method: "POST", auth: false, body: { refresh_token } }),
  forgotPassword: (email) =>
    request("/auth/v1/password/forgot", { method: "POST", auth: false, body: { email } }),
  resetPassword: (token, new_password) =>
    request("/auth/v1/password/reset", { method: "POST", auth: false, body: { token, new_password } }),
  requestOtp: (email) =>
    request("/auth/v1/otp/request", { method: "POST", auth: false, body: { email } }),
  verifyOtp: (email, code) =>
    request("/auth/v1/otp/verify", { method: "POST", auth: false, body: { email, code, device: "web" } }),
  requestEmailVerify: () => request("/auth/v1/email/verify/request", { method: "POST" }),
  confirmEmail: (token) =>
    request("/auth/v1/email/confirm", { method: "POST", auth: false, body: { token } }),
  setNotifyPref: (channel, enabled) =>
    request("/notify/v1/preferences", { method: "PUT", body: { channel, enabled } }),
  setPhoto: (photo_file_id) =>
    request("/drive/v1/candidate/photo", { method: "POST", body: { photo_file_id } }),
  logout: (refresh_token) =>
    request("/auth/v1/logout", { method: "POST", auth: false, body: { refresh_token } }),
  me: () => request("/auth/v1/me"),

  // ---- LMS ----
  curriculumTree: (id) => request(`/lms/v1/curricula/${id}/tree`),
  curricula: () => request("/lms/v1/curricula"),
  playlist: (learnerId, lessonId) =>
    request(`/lms/v1/content/playlist?learner_id=${learnerId}${lessonId ? `&lesson_id=${lessonId}` : ""}`),
  recommendations: (learnerId) =>
    request(`/lms/v1/content/recommendations?learner_id=${learnerId}`),
  contentProgress: (contentId, learnerId, position, completed) =>
    request(`/lms/v1/content/${contentId}/progress`, {
      method: "POST",
      body: { learner_id: learnerId, position_sec: position, completed },
    }),
  progressSummary: (learnerId) => request(`/lms/v1/progress/${learnerId}`),
  scorecard: (learnerId) => request(`/lms/v1/progress/${learnerId}/scorecard`),
  game: (learnerId) => request(`/lms/v1/gamification/${learnerId}`),
  leaderboard: () => request("/lms/v1/gamification/leaderboard/global"),
  certificates: (learnerId) => request(`/lms/v1/certificates/for/${learnerId}`),
  assessmentSummary: (learnerId) => request(`/lms/v1/assessments/summary?learner_id=${learnerId}`),

  // ---- Drive (candidate) ----
  drives: (status) => request(`/drive/v1/drives${status ? `?status=${status}` : ""}`),
  drive: (id) => request(`/drive/v1/drives/${id}`),

  // ---- Drive (recruiter/admin management) ----
  createDrive: (body) => request("/drive/v1/drives", { method: "POST", body }),
  deleteDrive: (id) => request(`/drive/v1/drives/${id}`, { method: "DELETE" }),
  addRole: (id, body) => request(`/drive/v1/drives/${id}/roles`, { method: "POST", body }),
  setEligibility: (id, body) => request(`/drive/v1/drives/${id}/eligibility`, { method: "POST", body }),
  addRound: (id, body) => request(`/drive/v1/drives/${id}/rounds`, { method: "POST", body }),
  getWorkflow: (id) => request(`/drive/v1/drives/${id}/workflow`),
  setWorkflow: (id, stages) => request(`/drive/v1/drives/${id}/workflow`, { method: "PUT", body: { stages } }),
  deleteRound: (id, order) => request(`/drive/v1/drives/${id}/rounds/${order}`, { method: "DELETE" }),
  roundScores: (id, order) => request(`/drive/v1/drives/${id}/rounds/${order}/scores`),
  setRoundScore: (id, order, body) => request(`/drive/v1/drives/${id}/rounds/${order}/scores`, { method: "POST", body }),
  addRoundCandidate: (id, order, candidate_id) => request(`/drive/v1/drives/${id}/rounds/${order}/candidates`, { method: "POST", body: { candidate_id } }),
  removeRoundCandidate: (id, order, candidate_id) => request(`/drive/v1/drives/${id}/rounds/${order}/candidates/${candidate_id}`, { method: "DELETE" }),
  publishRound: (id, order) => request(`/drive/v1/drives/${id}/rounds/${order}/publish`, { method: "POST" }),
  openDrive: (id) => request(`/drive/v1/drives/${id}/open`, { method: "POST" }),
  registerCandidate: (id, body) => request(`/drive/v1/drives/${id}/register`, { method: "POST", body }),
  shortlist: (id, candidate_ids) => request(`/drive/v1/drives/${id}/shortlist`, { method: "POST", body: { candidate_ids } }),
  advance: (id, candidate_id) => request(`/drive/v1/drives/${id}/advance`, { method: "POST", body: { candidate_id } }),
  funnel: (id) => request(`/drive/v1/drives/${id}/funnel`),
  driveAnalytics: (id) => request(`/drive/v1/drives/${id}/analytics`),
  // Download a round's marks as .xlsx (cleared=true → only cleared students).
  downloadRoundXlsx: async (id, order, cleared = false) => {
    const res = await request(
      `/drive/v1/drives/${id}/rounds/${order}/export${cleared ? "?cleared=true" : ""}`,
      { raw: true },
    );
    if (!res.ok) throw new Error(res.status === 401 ? "Session expired — sign in again." : "Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drive-${cleared ? "cleared" : "attendees"}-round${order}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  driveRegistrations: (id) => request(`/drive/v1/drives/${id}/registrations`),
  setPpo: (id, body) => request(`/drive/v1/drives/${id}/ppo-config`, { method: "POST", body }),

  // ---- Interview (recruiter) ----
  scheduleInterview: (body) => request("/drive/v1/interviews/schedule", { method: "POST", body }),
  allocateInterview: (id, interviewer_id) => request(`/drive/v1/interviews/${id}/allocate`, { method: "POST", body: { interviewer_id } }),
  rateInterview: (id, body) => request(`/drive/v1/interviews/${id}/rate`, { method: "POST", body }),
  decideInterview: (id, body) => request(`/drive/v1/interviews/${id}/decision`, { method: "POST", body }),
  driveInterviews: (driveId) => request(`/drive/v1/interviews/drive/${driveId}`),

  // ---- Evaluation / Result (recruiter) ----
  computeRanks: (exam_id) => request("/drive/v1/evaluations/rank", { method: "POST", body: { exam_id } }),
  examRanks: (examId) => request(`/drive/v1/evaluations/exam/${examId}/ranks`),
  examDifficulty: (examId) => request(`/drive/v1/evaluations/exam/${examId}/difficulty`),
  compileResults: (body) => request("/drive/v1/results/compile", { method: "POST", body }),
  driveResults: (driveId) => request(`/drive/v1/results/${driveId}`),
  publishResults: (driveId) => request(`/drive/v1/results/${driveId}/publish`, { method: "POST" }),
  generateOffer: (body) => request("/drive/v1/offers/generate", { method: "POST", body }),
  offerStatus: (offerId, status) => request(`/drive/v1/offers/${offerId}/status`, { method: "POST", body: { status } }),

  // ---- Question Bank & Exam authoring (recruiter) ----
  createQuestion: (body) => request("/drive/v1/questions", { method: "POST", body }),
  listQuestions: (status) => request(`/drive/v1/questions${status ? `?status=${status}` : ""}`),
  activateQuestion: (id) => request(`/drive/v1/questions/${id}/activate`, { method: "POST" }),
  createBlueprint: (body) => request("/drive/v1/blueprints", { method: "POST", body }),
  generatePaper: (id) => request(`/drive/v1/blueprints/${id}/generate-paper`, { method: "POST" }),
  createExam: (body) => request("/drive/v1/exams", { method: "POST", body }),
  upsertEvalKey: (body) => request("/drive/v1/evaluations/keys", { method: "POST", body }),
  generateQuestions: (body) => request("/drive/v1/questions/generate", { method: "POST", body }),

  // ---- Proctoring (browser hooks) ----
  proctorStart: (body) => request("/drive/v1/proctor/start", { method: "POST", body }),
  proctorEvent: (examSessionId, type, meta) => request(`/drive/v1/proctor/${examSessionId}/events`, { method: "POST", body: { type, meta } }),
  // Public "Attend Drive" registration (no login). Returns { student_id, drive,
  // access_token, refresh_token, ... }.
  attendDrive: (body) => request("/drive/v1/attend", { method: "POST", auth: false, body }),
  attendResume: (student_id) =>
    request("/drive/v1/attend/resume", { method: "POST", auth: false, body: { student_id } }),
  apply: (drive_id, drive_role_id) =>
    request("/drive/v1/candidate/apply", { method: "POST", body: { drive_id, drive_role_id } }),
  myApplications: () => request("/drive/v1/candidate/applications"),
  candidateProfile: () => request("/drive/v1/candidate/profile"),
  listExams: (driveId) => request(`/drive/v1/exams${driveId ? `?drive_id=${driveId}` : ""}`),
  examMeta: (examId) => request(`/drive/v1/exams/${examId}`),
  examPaper: (examId) => request(`/drive/v1/exams/${examId}/paper`),
  examStart: (examId, candidateId) =>
    request(`/drive/v1/exams/${examId}/start`, { method: "POST", body: candidateId ? { candidate_id: candidateId } : {} }),
  examState: (sessionId) => request(`/drive/v1/exam-sessions/${sessionId}/state`),
  examSave: (sessionId, answers) =>
    request(`/drive/v1/exam-sessions/${sessionId}/save`, { method: "POST", body: { answers } }),
  examSubmit: (sessionId) =>
    request(`/drive/v1/exam-sessions/${sessionId}/submit`, { method: "POST" }),
  updateProfile: (body) => request("/drive/v1/candidate/profile", { method: "PUT", body }),
  runCode: (language, code, cases) =>
    request("/drive/v1/coding/run-adhoc", { method: "POST", body: { language, code, cases } }),
  codingLanguages: () => request("/drive/v1/coding/languages"),
  codingOpen: (problem_id) =>
    request("/drive/v1/coding/session", { method: "POST", body: { problem_id } }),
  codingRun: (sid, code) =>
    request(`/drive/v1/coding/${sid}/run`, { method: "POST", body: { code } }),
  codingSubmit: (sid, code) =>
    request(`/drive/v1/coding/${sid}/submit`, { method: "POST", body: { code } }),

  // ---- Analytics ----
  dashboard: (role) => request(`/analytics/v1/dashboard/${role}`),
  ranking: () => request("/analytics/v1/colleges/ranking"),

  // ---- Notifications ----
  inbox: () => request("/notify/v1/inbox"),
  markRead: (id) => request(`/notify/v1/inbox/${id}/read`, { method: "POST" }),

  // ---- Institution (Super Admin / College Admin) ----
  colleges: () => request("/lms/v1/colleges"),
  createCollege: (body) => request("/lms/v1/colleges", { method: "POST", body }),
  collegeCohorts: (cid) => request(`/lms/v1/colleges/${cid}/cohorts`),
  createCohort: (cid, body) => request(`/lms/v1/colleges/${cid}/cohorts`, { method: "POST", body }),

  // ---- Learner roster (TPO / College Admin) ----
  learners: (params = "") => request(`/lms/v1/learners${params}`),
  createLearner: (body) => request("/lms/v1/learners", { method: "POST", body }),
  bulkImportLearners: (body) => request("/lms/v1/learners/import", { method: "POST", body }),
  verifyLearner: (lid) => request(`/lms/v1/learners/${lid}/verify`, { method: "POST" }),
  promoteLearner: (lid) => request(`/lms/v1/learners/${lid}/promote`, { method: "POST" }),

  // ---- Curriculum authoring (Trainer / Admin) ----
  createCurriculum: (body) => request("/lms/v1/curricula", { method: "POST", body }),
  addYear: (cid, body) => request(`/lms/v1/curricula/${cid}/years`, { method: "POST", body }),
  addModule: (yid, body) => request(`/lms/v1/years/${yid}/modules`, { method: "POST", body }),
  addLesson: (mid, body) => request(`/lms/v1/modules/${mid}/lessons`, { method: "POST", body }),
  publishCurriculum: (cid) => request(`/lms/v1/curricula/${cid}/publish`, { method: "POST" }),

  // ---- Progress writes (Trainer) ----
  markAttendance: (body) => request("/lms/v1/attendance", { method: "POST", body }),
  computeYear: (body) => request("/lms/v1/progress/compute-year", { method: "POST", body }),
  gradeAnswer: (answerId, score) => request(`/lms/v1/answers/${answerId}/grade`, { method: "POST", body: { score } }),

  // ---- LMS assessments (student take-flow) ----
  createAssessment: (body) => request("/lms/v1/assessments", { method: "POST", body }),
  getAssessment: (aid) => request(`/lms/v1/assessments/${aid}`),
  startAttempt: (aid, learnerId) => request(`/lms/v1/assessments/${aid}/attempts`, { method: "POST", body: { learner_id: learnerId } }),
  submitAttempt: (attemptId, answers) => request(`/lms/v1/attempts/${attemptId}/submit`, { method: "POST", body: { answers } }),

  // ---- Certification ----
  issueCertificate: (body) => request("/lms/v1/certificates/issue", { method: "POST", body }),
  verifyCertificate: (verifyId) => request(`/verify/${verifyId}`, { auth: false }),

  // ---- AI Tutor ----
  tutorChat: (message, session_id, context) => request("/ai/v1/tutor/chat", { method: "POST", body: { message, session_id, context } }),
  tutorSessions: () => request("/ai/v1/tutor/sessions"),
  tutorMessages: (sid) => request(`/ai/v1/tutor/sessions/${sid}/messages`),
  studyPlan: (variables) => request("/ai/v1/tutor/study-plan", { method: "POST", body: { variables } }),
  streamAdvice: (variables) => request("/ai/v1/tutor/stream-advice", { method: "POST", body: { variables } }),

  // ---- File upload (pre-signed 3-step) ----
  requestUpload: (body) => request("/files/v1/upload-url", { method: "POST", body }),
  completeUpload: (fileId) => request(`/files/v1/${fileId}/complete`, { method: "POST" }),
  // raw PUT of bytes to the pre-signed token URL
  uploadBytes: (token, bytes, mime) =>
    fetch(`/api/files/v1/upload/${token}`, { method: "PUT", headers: { "Content-Type": mime }, body: bytes }),
  setResume: (resume_file_id) => request("/drive/v1/candidate/resume", { method: "POST", body: { resume_file_id } }),
};

// Wrap a live call so a page still renders (with demo data) when the backend
// isn't running — every screen has a real code path + a graceful fallback.
export async function withFallback(promise, fallback) {
  try {
    const data = await promise;
    return { data, live: true };
  } catch {
    return { data: fallback, live: false };
  }
}
