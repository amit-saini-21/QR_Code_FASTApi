"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { ArrowDownToLine, ArrowUpRight, Copy, Link2, LoaderCircle, Pencil, Plus, QrCode, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatBytes, friendlyDate, saveBlob } from "@/lib/api"
import { historyApi, qrApi } from "@/lib/backend-api"
import type { HistoryResponse, QRRecord } from "@/lib/types"

const PAGE_SIZE = 12
const HISTORY_STATS_KEY = "/api/backend/api/v1/history/stats"

interface LibraryViewProps {
  onCreate: () => void
  onEdit: (record: QRRecord) => void
  onDuplicate: (record: QRRecord) => void
}

function imageSource(record: QRRecord) {
  const source = record.qr_public_url || record.public_url || ""
  return source.startsWith("http://") || source.startsWith("https://") || source.startsWith("/") ? source : null
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    url: "Website",
    text: "Text",
    email: "Email",
    phone: "Phone",
    wifi: "Wi-Fi",
    media: "Media",
  }
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1)
}

function safeFilename(value: string) {
  return (value || "qr-code").toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-|-$/g, "") || "qr-code"
}

export function LibraryView({ onCreate, onEdit, onDuplicate }: LibraryViewProps) {
  const [search, setSearch] = useState("")
  const [activeSearch, setActiveSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [offset, setOffset] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<QRRecord | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const { mutate: globalMutate } = useSWRConfig()

  const params = useMemo(() => {
    const values = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
    if (activeSearch.trim()) values.set("search", activeSearch.trim())
    if (typeFilter !== "all") values.set("qr_type", typeFilter)
    return values.toString()
  }, [activeSearch, offset, typeFilter])

  const historyKey = `/api/backend/api/v1/history?${params}`
  const { data, error, isLoading, mutate } = useSWR<HistoryResponse>(
    historyKey,
    () => historyApi.list({ limit: PAGE_SIZE, offset, search: activeSearch, qrType: typeFilter }),
    { keepPreviousData: true, revalidateOnFocus: false },
  )
  const items = data?.items ?? []
  const total = data?.total ?? 0

  function applySearch() {
    setOffset(0)
    setActiveSearch(search)
  }

  async function handleEdit(item: QRRecord) {
    setBusyId(item.qr_id)
    try {
      const fullRecord = await qrApi.get(item.qr_id)
      onEdit(fullRecord)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not open this QR code")
    } finally {
      setBusyId(null)
    }
  }

  function handleDuplicate(item: QRRecord) {
    const duplicate = {
      ...item,
      qr_type: item.qr_type === "media" ? "url" : item.qr_type,
      content: item.qr_type === "media" ? item.media_url || item.content : item.content,
      title: `${item.title || "QR code"} copy`,
      qr_id: 0,
    }
    onDuplicate(duplicate)
  }

  async function handleDownload(item: QRRecord) {
    setBusyId(item.qr_id)
    try {
      const blob = await qrApi.download(item.qr_id)
      saveBlob(blob, `${safeFilename(item.title)}.${item.qr_format === "jpg" ? "jpg" : "png"}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Download failed")
    } finally {
      setBusyId(null)
    }
  }

  async function copyShareLink(item: QRRecord) {
    const value = item.qr_type === "media"
      ? item.media_url || item.content
      : item.public_url || item.qr_public_url || item.content
    if (!value) {
      toast.error("No share URL is available for this QR code.")
      return
    }
    if (!navigator.clipboard?.writeText) {
      toast.error("Clipboard access is not available in this browser.")
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Share URL copied")
    } catch {
      toast.error("Could not copy the share URL.")
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const item = deleteTarget
    setBusyId(item.qr_id)
    try {
      await historyApi.delete(item.qr_id)
      setDeleteTarget(null)
      toast.success("QR code removed from your library")
      await mutate()
      await globalMutate(HISTORY_STATS_KEY)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not delete this QR code")
    } finally {
      setBusyId(null)
    }
  }

  const pageLabel = total === 0 ? "No QR codes yet" : `${offset + 1}–${Math.min(offset + items.length, total)} of ${total}`
  const canGoBack = offset > 0
  const canGoForward = offset + PAGE_SIZE < total

  return (
    <section className="library-view" aria-labelledby="library-heading">
      <div className="library-toolbar">
        <div className="library-search-row">
          <div className="library-search"><Search aria-hidden="true" /><Input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) applySearch() }} placeholder="Search by name, content, or file" aria-label="Search QR library" /></div>
          <Select value={typeFilter} onValueChange={(value) => { if (value) { setTypeFilter(value); setOffset(0) } }}>
            <SelectTrigger className="type-filter" aria-label="Filter by type"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="all">All types</SelectItem><SelectItem value="url">Website</SelectItem><SelectItem value="text">Text</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="wifi">Wi-Fi</SelectItem><SelectItem value="media">Media</SelectItem></SelectGroup></SelectContent>
          </Select>
          <Button variant="outline" onClick={applySearch}><Search data-icon="inline-start" aria-hidden="true" />Search</Button>
        </div>
        <div className="library-count"><span className="library-count-dot" /> {pageLabel}</div>
      </div>

      {error && (
        <Alert variant="destructive" className="library-error">
          <AlertTitle>Your library could not load</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="library-loading" aria-label="Loading QR library"><LoaderCircle className="spin" aria-hidden="true" /><span>Gathering your QR codes</span></div>
      ) : items.length === 0 ? (
        <div className="library-empty">
          <div className="empty-orbit" aria-hidden="true"><QrCode /></div>
          <span className="empty-kicker">{activeSearch || typeFilter !== "all" ? "NO MATCHES" : "YOUR LIBRARY STARTS HERE"}</span>
          <h2>{activeSearch || typeFilter !== "all" ? "Nothing found this time." : "A little space for your big ideas."}</h2>
          <p>{activeSearch || typeFilter !== "all" ? "Try a different phrase or reset your filters." : "Your saved QR codes will live here, ready to edit, download, and share."}</p>
          {activeSearch || typeFilter !== "all" ? (
            <Button variant="outline" onClick={() => { setSearch(""); setActiveSearch(""); setTypeFilter("all"); setOffset(0) }}>Clear filters</Button>
          ) : (
            <Button onClick={onCreate}><Plus data-icon="inline-start" aria-hidden="true" />Create your first QR</Button>
          )}
        </div>
      ) : (
        <div className="qr-library-grid">
          {items.map((item) => {
            const source = imageSource(item)
            const isBusy = busyId === item.qr_id
            return (
              <Card className="library-card" key={item.qr_id}>
                <CardContent className="library-card-content">
                  <div className="library-card-top">
                    <div className="library-code-preview">
                      {source ? <Image src={source} width={76} height={76} alt={`QR code for ${item.title}`} unoptimized /> : <QrCode aria-hidden="true" />}
                    </div>
                    <div className="library-card-actions">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${item.title}`} title="Edit" onClick={() => void handleEdit(item)} disabled={isBusy}><Pencil data-icon="inline-start" aria-hidden="true" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Duplicate ${item.title}`} title="Duplicate" onClick={() => handleDuplicate(item)}><Copy data-icon="inline-start" aria-hidden="true" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Copy share URL for ${item.title}`} title="Copy share URL" onClick={() => void copyShareLink(item)}><Link2 aria-hidden="true" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Download ${item.title}`} title="Download" onClick={() => void handleDownload(item)} disabled={isBusy}>{isBusy ? <LoaderCircle className="spin" aria-hidden="true" /> : <ArrowDownToLine aria-hidden="true" />}</Button>
                    </div>
                  </div>
                  <div className="library-card-info">
                    <div className="library-card-title-row"><h3 title={item.title}>{item.title || "Untitled QR"}</h3><Badge variant="secondary">{typeLabel(item.qr_type)}</Badge></div>
                    <p className="library-card-content-text">{item.qr_type === "media" ? item.media_name || item.content : item.content}</p>
                    <div className="library-card-meta"><span>{friendlyDate(item.created_at)}</span><span>{item.qr_type === "media" ? `${item.media_type || "Media"} · ${formatBytes(item.media_size || 0)}` : `${item.qr_format?.toUpperCase()} · ${item.qr_size || 1024}px`}</span></div>
                  </div>
                  <div className="library-card-footer">
                    <button type="button" className="card-edit-link" onClick={() => void handleEdit(item)} disabled={isBusy}>Open in studio <ArrowUpRight aria-hidden="true" /></button>
                    <button type="button" className="card-delete" onClick={() => setDeleteTarget(item)} aria-label={`Delete ${item.title}`}><Trash2 aria-hidden="true" /></button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="pagination-row">
          <span>{pageLabel}</span>
          <div><Button variant="outline" size="sm" disabled={!canGoBack} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}>Previous</Button><Button variant="outline" size="sm" disabled={!canGoForward} onClick={() => setOffset((value) => value + PAGE_SIZE)}>Next</Button></div>
        </div>
      )}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this QR code?</AlertDialogTitle>
            <AlertDialogDescription>This removes “{deleteTarget?.title || "Untitled QR"}” from your library and deletes its stored files. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === deleteTarget?.qr_id}>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()} disabled={busyId === deleteTarget?.qr_id}>{busyId === deleteTarget?.qr_id ? "Deleting…" : "Delete QR code"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
