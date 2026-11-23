"use client"

import { useState, type ReactNode } from "react"
import useSWR, { useSWRConfig } from "swr"
import { motion } from "motion/react"
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronRight,
  Copy,
  CircleHelp,
  Clock3,
  FileImage,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Plus,
  QrCode,
  ScanLine,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LibraryView } from "@/components/library-view"
import { QRBuilder } from "@/components/qr-builder"
import { useAuth } from "@/components/auth-provider"
import { formatBytes } from "@/lib/api"
import { historyApi } from "@/lib/backend-api"
import type { HistoryStats, QRRecord, User } from "@/lib/types"

const STATS_KEY = "/api/backend/api/v1/history/stats"

type View = "create" | "library"
type EditorMode = "create" | "edit"

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "QR"
}

export function StudioApp({ user }: { user: User }) {
  const { signOut } = useAuth()
  const { mutate: globalMutate } = useSWRConfig()
  const [view, setView] = useState<View>("create")
  const [editorMode, setEditorMode] = useState<EditorMode>("create")
  const [seedRecord, setSeedRecord] = useState<QRRecord | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const { data: stats, error: statsError } = useSWR<HistoryStats>(
    STATS_KEY,
    () => historyApi.stats(),
    { revalidateOnFocus: false },
  )

  function startNew() {
    setView("create")
    setEditorMode("create")
    setSeedRecord(null)
    setEditorKey((key) => key + 1)
  }

  function editRecord(record: QRRecord) {
    setView("create")
    setEditorMode("edit")
    setSeedRecord(record)
    setEditorKey((key) => key + 1)
  }

  function duplicateRecord(record: QRRecord) {
    setView("create")
    setEditorMode("create")
    setSeedRecord(record)
    setEditorKey((key) => key + 1)
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not sign out")
    } finally {
      setSigningOut(false)
    }
  }

  async function handleSaved() {
    await globalMutate(STATS_KEY)
    await globalMutate((key) => typeof key === "string" && key.startsWith("/api/backend/api/v1/history?"))
  }

  const total = stats?.total_qr_codes ?? 0
  const media = stats?.media_qr_codes ?? 0
  const storage = formatBytes(stats?.media_bytes ?? 0)

  return (
    <div className="studio-layout">
      <aside className="studio-sidebar">
        <div className="sidebar-top">
          <button type="button" className="app-brand" onClick={startNew} aria-label="QR Studio home">
            <span className="brand-mark"><QrCode aria-hidden="true" /></span>
            <span className="brand-name">QR<span className="brand-dot">.</span>STUDIO</span>
          </button>
          <div className="sidebar-section-label">WORKSPACE</div>
          <nav className="side-navigation" aria-label="Main navigation">
            <button type="button" className={`side-nav-link ${view === "create" ? "active" : ""}`} onClick={startNew} aria-current={view === "create" ? "page" : undefined}>
              <LayoutDashboard aria-hidden="true" /><span>Studio</span><span className="nav-shortcut">01</span>
            </button>
            <button type="button" className={`side-nav-link ${view === "library" ? "active" : ""}`} onClick={() => setView("library")} aria-current={view === "library" ? "page" : undefined}>
              <FolderOpen aria-hidden="true" /><span>QR library</span><span className="nav-count">{stats ? total : "—"}</span>
            </button>
          </nav>
          <div className="sidebar-divider" />
          <div className="sidebar-section-label">QUICK START</div>
          <button type="button" className="side-quick-link" onClick={startNew}><Plus aria-hidden="true" /><span>New QR code</span></button>
          <button type="button" className="side-quick-link" onClick={() => setView("library")}><Clock3 aria-hidden="true" /><span>Recent creations</span></button>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-help-card">
            <div className="help-card-icon"><CircleHelp aria-hidden="true" /></div>
            <div><strong>Need a hand?</strong><span>Check your API setup and endpoints.</span></div>
            <ArrowUpRight aria-hidden="true" className="help-card-arrow" />
          </div>
          <div className="api-connection"><span className="status-dot" /><span>FastAPI connected</span><span className="secure-lock">TLS</span></div>
          <div className="sidebar-user">
            <div className="user-avatar" aria-hidden="true">{initials(user.name)}</div>
            <div className="user-details"><strong>{user.name}</strong><span>{user.email}</span></div>
            <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={() => void handleSignOut()} disabled={signingOut}>
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="studio-main-column">
        <header className="studio-topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight aria-hidden="true" /><strong>{view === "create" ? "Studio" : "QR library"}</strong></div>
          <div className="topbar-right"><div className="topbar-api"><span className="status-dot" /> API ready</div><div className="topbar-avatar" title={user.name}>{initials(user.name)}</div></div>
        </header>

        <main className="studio-main">
          <motion.div className="workspace-heading" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="heading-copy">
              <div className="eyebrow dark-eyebrow"><Sparkles aria-hidden="true" /> YOUR CREATIVE WORKSPACE</div>
              <h1>{view === "library" ? "Your QR library." : editorMode === "edit" ? "Refine your QR." : seedRecord ? "Make it your own." : "Create with intention."}</h1>
              <p>{view === "library" ? "Every code you have created, organized and ready to go." : editorMode === "edit" ? "Fine-tune the details and keep your design on brand." : "A considered design makes every scan feel like a first impression."}</p>
            </div>
            <div className="heading-actions">
              {view === "library" ? (
                <Button onClick={startNew}><Plus data-icon="inline-start" aria-hidden="true" />New QR code</Button>
              ) : (
                <>
                  {editorMode === "edit" && <Button variant="outline" onClick={startNew}>Cancel edit</Button>}
                  {editorMode === "create" && seedRecord && <Badge variant="secondary" className="duplicate-badge"><CopyIcon /> DUPLICATE</Badge>}
                  {!seedRecord && <Button variant="outline" onClick={startNew}><Plus data-icon="inline-start" aria-hidden="true" />Start fresh</Button>}
                </>
              )}
            </div>
          </motion.div>

          {statsError && (
            <Alert variant="destructive" className="stats-error">
              <AlertTitle>Usage stats are unavailable</AlertTitle>
              <AlertDescription>{statsError.message}</AlertDescription>
            </Alert>
          )}

          <section className="metric-grid" aria-label="QR code usage">
            <MetricCard icon={<QrCode aria-hidden="true" />} label="Total QR codes" value={stats ? String(total).padStart(2, "0") : "—"} detail="Saved in your library" accent="lime" />
            <MetricCard icon={<FileImage aria-hidden="true" />} label="Media codes" value={stats ? String(media).padStart(2, "0") : "—"} detail="Files shared by QR" accent="violet" />
            <MetricCard icon={<ChartNoAxesCombined aria-hidden="true" />} label="Media storage" value={storage} detail="Across your shared files" accent="blue" />
            <div className="metric-spark" aria-hidden="true"><div className="spark-line"><span /><span /><span /><span /><span /><span /><span /></div><div className="spark-meta"><span><ScanLine /> BUILT FOR THE NEXT SCAN</span><ArrowUpRight /></div></div>
          </section>

          {view === "create" ? (
            <div className="creator-area">
              <div className="creator-section-heading"><div><span className="section-overline">THE DESIGN DESK</span><span className="section-subline">Your QR, exactly how you imagined it.</span></div><div className="editor-status"><span className="status-dot" /> Auto preview on</div></div>
              <QRBuilder key={editorKey} initial={seedRecord} mode={editorMode} onSaved={() => void handleSaved()} />
            </div>
          ) : (
            <div className="library-area">
              <div className="creator-section-heading"><div><span className="section-overline">THE COLLECTION</span><span className="section-subline">Your codes, all in one place.</span></div><div className="editor-status"><span className="status-dot" /> Synced to your API</div></div>
              <LibraryView onCreate={startNew} onEdit={editRecord} onDuplicate={duplicateRecord} />
            </div>
          )}
          <footer className="studio-footer"><span>QR STUDIO <i /> A little more intention in every scan.</span><a href="https://fastapi.tiangolo.com/" target="_blank" rel="noreferrer">Powered by your FastAPI <ArrowUpRight aria-hidden="true" /></a></footer>
        </main>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, detail, accent }: { icon: ReactNode; label: string; value: string; detail: string; accent: string }) {
  return (
    <div className={`metric-card metric-${accent}`}>
      <div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-arrow"><ArrowUpRight aria-hidden="true" /></span></div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  )
}

function CopyIcon() {
  return <Copy aria-hidden="true" />
}
