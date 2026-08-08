import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Card, Button } from "../components/ui/primitives.jsx";
import { PageHeader, Loading } from "../components/ui/states.jsx";
import LessonBlocks from "../components/LessonBlocks.jsx";
import ProctorBanner from "../components/ProctorBanner.jsx";
import { api } from "../lib/api.js";

// Student view of a LARE "living lesson": rich text (markdown + tables),
// runnable code, callouts, and inline checks that update your skill map.
export default function LessonViewer() {
  const { lid } = useParams();
  const nav = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setLesson(await api.getLesson(lid)); }
      catch { setLesson({ title: "Lesson", content: [] }); }
      finally { setLoading(false); }
    })();
  }, [lid]);

  if (loading) return <Loading />;
  const blocks = lesson?.content || [];

  return (
    <div>
      <PageHeader
        title={lesson?.title || "Lesson"}
        subtitle="Read, run, and check your understanding — this lesson learns about you as you go."
        right={<Button variant="secondary" onClick={() => nav(-1)}><ArrowLeft size={16} /> Back</Button>}
      />
      {blocks.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto grid place-items-center h-12 w-12 rounded-full bg-slate-100 text-slate-400"><BookOpen size={24} /></span>
          <p className="mt-3 text-slate-500">No material has been added to this lesson yet.</p>
        </Card>
      ) : (
        <div className="max-w-2xl">
          {blocks.some((b) => b.type === "check") && <ProctorBanner active />}
          <LessonBlocks blocks={blocks} grade={(bid, choice) => api.gradeLessonCheck(lid, bid, choice)} />
          <p className="text-center text-xs text-slate-400 pt-5">End of lesson · your skill map updates from the checks above.</p>
        </div>
      )}
    </div>
  );
}
