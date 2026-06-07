import React, { useState } from "react";
import { useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import jsPDF from "jspdf";
import { RootState } from "../../redux/store";
import { getUserInfo } from "../../services/auth.service";
import logo from "../../assets/logoNew.png";
import ChapterSidebar from "./ChapterSidebar";
import StoryViewer from "./StoryViewer";
import ContinueStoryButton from "./ContinueStoryButton";
import CharacterNetwork from "../CharacterNetwork";
import { getSafeFileName, downloadBlob, createWorkspaceDocxBlob } from "../../utils/story-export.utils";

const StoryWorkspace = () => {
  const currentStory = useSelector((state: RootState) => state.story.currentStory);
  const [workspaceMode, setWorkspaceMode] = useState<"editor" | "network">("editor");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleExportMarkdown = () => {
    if (!currentStory) { toast.error("No story available to export."); return; }
    try {
      const title = currentStory.title || "Story";
      const user = getUserInfo();
      const authorName = user?.name || "Anonymous";
      const isoDate = new Date().toISOString().split("T")[0];
      let chaptersContent = "";
      if (currentStory.chapters && currentStory.chapters.length > 0) {
        currentStory.chapters.forEach((chapter) => { chaptersContent += `## ${chapter.title}\n\n${chapter.content}\n\n`; });
      } else { chaptersContent = "*No chapters in this story.*"; }
      const markdownContent = `---\ntitle: "${title.replace(/"/g, '\\"')}"\nauthor: "${authorName.replace(/"/g, '\\"')}"\ndate: "${isoDate}"\n---\n\n# ${title}\n\n${chaptersContent}`;
      const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8;" });
      downloadBlob(blob, getSafeFileName(title, "md"));
      toast.success("Markdown downloaded!");
    } catch (error) { console.error(error); toast.error("Failed to export Markdown."); }
  };

  const handleExportPDF = async () => {
    if (!currentStory) { toast.error("No story available to export."); return; }
    const toastId = toast.loading("Preparing your premium PDF...");
    try {
      const loadImageWithTimeout = (src: string, timeoutMs = 3000): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const timeout = setTimeout(() => { img.src = ""; reject(new Error(`Timeout: ${src}`)); }, timeoutMs);
          img.onload = () => { clearTimeout(timeout); resolve(img); };
          img.onerror = (e) => { clearTimeout(timeout); reject(e); };
          img.src = src;
        });
      let logoImg: HTMLImageElement | null = null;
      try { logoImg = await loadImageWithTimeout(logo); } catch (err) { console.warn("Logo load failed", err); }
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const title = currentStory.title || "Untitled Story";
      const lm = 20, rm = 20, tm = 20, bm = 20;
      const pw = 210 - lm - rm;
      const maxY = 297 - bm - 10;
      let y = tm;
      if (logoImg) {
        const lh = 8, lw = (logoImg.width / logoImg.height) * lh;
        doc.addImage(logoImg, "PNG", lm, y, lw, lh);
      } else {
        doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(99, 102, 241);
        doc.text("StorySparkAI", lm, y + 6);
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
      doc.text("PREMIUM GENERATED STORY", 190, y + 5, { align: "right" });
      y += 10;
      doc.setDrawColor(99, 102, 241); doc.setLineWidth(0.5); doc.line(lm, y, 190, y); y += 8;
      doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(30, 41, 59);
      doc.splitTextToSize(title, pw).forEach((line: string) => { doc.text(line, lm, y); y += 9; });
      y += 1;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
      const fd = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
      doc.text(`Generated on ${fd}`, lm, y);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      const tag = "STORY", tw = doc.getTextWidth(tag), cw = tw + 5, ch = 5, cx = 190 - cw, cy = y - 3.8;
      doc.setFillColor(99, 102, 241); doc.roundedRect(cx, cy, cw, ch, 1, 1, "F");
      doc.setTextColor(255, 255, 255); doc.text(tag, cx + 2.5, cy + 3.5);
      y += 4.5;
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(lm, y, 190, y); y += 10;
      if (currentStory.chapters && currentStory.chapters.length > 0) {
        currentStory.chapters.forEach((chapter, idx) => {
          if (idx > 0) { doc.addPage(); y = 30; }
          doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 41, 59);
          doc.splitTextToSize(chapter.title || `Chapter ${idx + 1}`, pw).forEach((line: string) => {
            if (y > maxY) { doc.addPage(); y = 30; }
            doc.text(line, lm, y); y += 7;
          });
          y += 3;
          doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 41, 59);
          (chapter.content || "").split(/\n+/).forEach((para: string, pi: number, arr: string[]) => {
            const cp = para.trim(); if (!cp) return;
            doc.splitTextToSize(cp, pw).forEach((line: string) => {
              if (y > maxY) { doc.addPage(); y = 30; }
              doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 41, 59);
              doc.text(line, lm, y); y += 6.5;
            });
            if (pi < arr.length - 1) { if (y > maxY) { doc.addPage(); y = 30; } else { y += 4.5; } }
          });
        });
      } else {
        doc.setFont("helvetica", "italic"); doc.setFontSize(11); doc.setTextColor(148, 163, 184);
        doc.text("No chapters in this story.", lm, y);
      }
      const tp = doc.getNumberOfPages();
      for (let i = 1; i <= tp; i++) {
        doc.setPage(i);
        doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.25); doc.line(lm, 280, 190, 280);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
        doc.text("Generated with StorySparkAI", lm, 285);
        doc.text(`Page ${i} of ${tp}`, 190, 285, { align: "right" });
        if (i > 1) {
          doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(99, 102, 241);
          doc.text("StorySparkAI", lm, 14);
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
          doc.text(title.length > 50 ? title.substring(0, 50) + "..." : title, 190, 14, { align: "right" });
          doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.2); doc.line(lm, 17, 190, 17);
        }
      }
      const st = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "story";
      doc.save(`${st}.pdf`);
      toast.dismiss(toastId); toast.success("Premium PDF downloaded!");
    } catch (error) { console.error(error); toast.dismiss(toastId); toast.error("Failed to export PDF."); }
  };

  const handleExportDOCX = () => {
    if (!currentStory) { toast.error("No story available to export."); return; }
    try {
      const title = currentStory.title || "Story";
      const user = getUserInfo();
      const authorName = user?.name || "Anonymous";
      const formattedDate = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
      const blob = createWorkspaceDocxBlob({ title, authorName, dateStr: formattedDate, chapters: currentStory.chapters || [] });
      downloadBlob(blob, getSafeFileName(title, "docx"));
      toast.success("DOCX downloaded!");
    } catch (error) { console.error(error); toast.error("Failed to export DOCX."); }
  };

  if (!currentStory) return <div className="text-white p-10">No Story Available</div>;

  return (
    <div className="flex bg-black min-h-screen relative">
      <Toaster position="top-right" reverseOrder={false} />
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`fixed top-0 left-0 h-full z-30 transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 lg:min-w-[220px] lg:max-w-[260px] lg:flex-shrink-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <ChapterSidebar chapters={currentStory.chapters} />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex flex-wrap justify-between items-center gap-2 p-3 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-2 min-w-0">
            <button className="lg:hidden text-white p-1 rounded hover:bg-zinc-700 transition" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">☰</button>
            <h2 className="text-white text-base font-bold truncate max-w-[180px] sm:max-w-xs">{currentStory.title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
              <button onClick={() => setWorkspaceMode("editor")} className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${workspaceMode === "editor" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}>
                📖 <span className="hidden sm:inline">Read Story</span>
              </button>
              <button onClick={() => setWorkspaceMode("network")} className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${workspaceMode === "network" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}>
                🕸️ <span className="hidden sm:inline">Character Network</span>
              </button>
            </div>
            <button onClick={handleExportMarkdown} className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1.5 rounded shadow transition flex items-center gap-1.5 font-semibold cursor-pointer text-xs">⬇️ <span className="hidden sm:inline">Markdown</span></button>
            <button onClick={handleExportDOCX} className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1.5 rounded shadow transition flex items-center gap-1.5 font-semibold cursor-pointer text-xs">⬇️ <span className="hidden sm:inline">Word (DOCX)</span></button>
            <button onClick={handleExportPDF} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded shadow transition flex items-center gap-1.5 font-semibold cursor-pointer text-xs">📄 <span className="hidden sm:inline">Export PDF</span></button>
          </div>
        </div>
        {workspaceMode === "editor" ? (
          <>
            <StoryViewer chapters={currentStory.chapters} storyId={currentStory.id} />
            <div className="p-6 border-t border-zinc-800"><ContinueStoryButton /></div>
          </>
        ) : (
          <CharacterNetwork storyId={currentStory.id} />
        )}
      </div>
    </div>
  );
};

export default StoryWorkspace;
