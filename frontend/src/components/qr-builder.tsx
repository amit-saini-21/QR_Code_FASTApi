"use client"

import Image from "next/image"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { motion } from "motion/react"
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Palette,
  QrCode,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { saveBlob } from "@/lib/api"
import { qrApi } from "@/lib/backend-api"
import type { QRPayload, QRRecord } from "@/lib/types"

interface QRBuilderProps {
  initial?: QRRecord | null
  mode?: "create" | "edit"
  onSaved: (record: QRRecord) => void
}

interface BuilderState {
  qr_type: string
  title: string
  content: string
  qr_format: "png" | "jpg"
  qr_size: number
  qr_color: string
  background_color: string
  corner_eye_color: string
  qr_pattern_style: string
  corner_eye_style: string
  qr_logo: string | null
}

const defaults: BuilderState = {
  qr_type: "url",
  title: "",
  content: "",
  qr_format: "png",
  qr_size: 1024,
  qr_color: "#152a24",
  background_color: "#f9f8f3",
  corner_eye_color: "#152a24",
  qr_pattern_style: "rounded",
  corner_eye_style: "rounded",
  qr_logo: null,
}

const typeOptions = [
  { value: "url", label: "Website", hint: "Paste a URL or web address." },
  { value: "text", label: "Plain text", hint: "Encode a note, phrase, or short message." },
  { value: "email", label: "Email", hint: "Use a mailto: address or any exact payload." },
  { value: "phone", label: "Phone", hint: "Use a tel: number or any exact payload." },
  { value: "wifi", label: "Wi-Fi", hint: "Paste your exact Wi-Fi QR payload." },
  { value: "media", label: "File or media", hint: "Create a QR code that opens a shared file." },
]

const MAX_MEDIA_BYTES = 50 * 1024 * 1024
const MAX_LOGO_BYTES = 5 * 1024 * 1024
const MEDIA_MIME_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf",
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg",
  "video/mp4", "video/webm", "video/quicktime",
])
const LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i

function payloadFromState(state: BuilderState): QRPayload {
  return {
    qr_type: state.qr_type,
    content: state.content.trim(),
    title: state.title.trim() || "Untitled QR",
    qr_format: state.qr_format,
    qr_size: state.qr_size,
    qr_color: state.qr_color,
    background_color: state.background_color,
    corner_eye_color: state.corner_eye_color,
    qr_pattern_style: state.qr_pattern_style,
    corner_eye_style: state.corner_eye_style,
    qr_logo: state.qr_logo,
  }
}

function initialState(initial?: QRRecord | null): BuilderState {
  if (!initial) return defaults
  return {
    qr_type: initial.qr_type || "url",
    title: initial.title || "",
    content: initial.content || initial.media_url || "",
    qr_format: initial.qr_format?.toLowerCase() === "jpg" || initial.qr_format?.toLowerCase() === "jpeg" ? "jpg" : "png",
    qr_size: initial.qr_size || 1024,
    qr_color: initial.qr_color || defaults.qr_color,
    background_color: initial.background_color || defaults.background_color,
    corner_eye_color: initial.corner_eye_color || initial.qr_color || defaults.corner_eye_color,
    qr_pattern_style: initial.qr_pattern_style || defaults.qr_pattern_style,
    corner_eye_style: initial.corner_eye_style || defaults.corner_eye_style,
    qr_logo: initial.qr_logo || null,
  }
}

function safeFilename(value: string) {
  return (value || "qr-code").toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-|-$/g, "") || "qr-code"
}

export function QRBuilder({ initial, mode = "create", onSaved }: QRBuilderProps) {
  const [form, setForm] = useState<BuilderState>(() => initialState(initial))
  const [colorDrafts, setColorDrafts] = useState(() => ({
    qr_color: form.qr_color,
    background_color: form.background_color,
    corner_eye_color: form.corner_eye_color,
  }))
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [logoName, setLogoName] = useState<string | null>(null)
  const [mediaName, setMediaName] = useState<string | null>(initial?.media_name || null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedRecord, setSavedRecord] = useState<QRRecord | null>(initial ?? null)
  const previewRef = useRef<string | null>(null)
  const isEditing = mode === "edit" && Boolean(initial?.qr_id)
  const isNewMedia = form.qr_type === "media" && !isEditing
  const typeDetail = typeOptions.find((item) => item.value === form.qr_type)

  function clearPreview() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setPreviewUrl(null)
    setPreviewError(null)
    setPreviewLoading(false)
  }

  function update<K extends keyof BuilderState>(key: K, value: BuilderState[K]) {
    if ((key === "content" && typeof value === "string" && !value.trim()) || (key === "qr_type" && value === "media" && !isEditing)) {
      clearPreview()
    }
    setForm((current) => ({ ...current, [key]: value }))
    setSavedRecord(null)
  }

  useEffect(() => {
    const content = form.content.trim()
    const colors = [form.qr_color, form.background_color, form.corner_eye_color]
    if (!content || colors.some((color) => !HEX_COLOR_PATTERN.test(color))) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const rendered = await qrApi.preview(payloadFromState(form), controller.signal)
        const nextUrl = URL.createObjectURL(rendered)
        if (controller.signal.aborted) {
          URL.revokeObjectURL(nextUrl)
          return
        }
        if (previewRef.current) URL.revokeObjectURL(previewRef.current)
        previewRef.current = nextUrl
        setPreviewUrl(nextUrl)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setPreviewError(cause instanceof Error ? cause.message : "Could not render this QR preview.")
        }
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false)
      }
    }, 420)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [form, isNewMedia])

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!LOGO_MIME_TYPES.has(file.type)) {
      toast.error("Choose a PNG, JPEG, or WebP logo.")
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo files must be 5 MB or smaller.")
      return
    }

    setUploadingLogo(true)
    try {
      const result = await qrApi.uploadLogo(file)
      setLogoName(result.file_name || file.name)
      update("qr_logo", result.path)
      toast.success("Logo added to your QR design")
    } catch (cause) {
      setLogoName(null)
      toast.error(cause instanceof Error ? cause.message : "Logo upload failed")
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!MEDIA_MIME_TYPES.has(file.type)) {
      toast.error("Choose a PNG, JPEG, WebP, GIF, PDF, MP3, WAV, OGG, MP4, WebM, or MOV file.")
      return
    }
    if (file.size > MAX_MEDIA_BYTES) {
      toast.error("Media files must be 50 MB or smaller.")
      return
    }

    setMediaUploading(true)
    try {
      const uploaded = await qrApi.uploadMedia(file)
      setMediaFile(file)
      setMediaName(uploaded.file_name || file.name)
      update("content", uploaded.public_url)
      toast.success("File uploaded — live QR preview is ready.")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Media upload failed")
    } finally {
      setMediaUploading(false)
    }
  }

  function clearLogo() {
    update("qr_logo", null)
    setLogoName(null)
  }

  function resetDesign() {
    setForm((current) => ({
      ...current,
      qr_format: defaults.qr_format,
      qr_size: defaults.qr_size,
      qr_color: defaults.qr_color,
      background_color: defaults.background_color,
      corner_eye_color: defaults.corner_eye_color,
      qr_pattern_style: defaults.qr_pattern_style,
      corner_eye_style: defaults.corner_eye_style,
      qr_logo: null,
    }))
    setColorDrafts({
      qr_color: defaults.qr_color,
      background_color: defaults.background_color,
      corner_eye_color: defaults.corner_eye_color,
    })
    setLogoName(null)
    setSavedRecord(null)
  }

  async function handleSave() {
    if (isNewMedia && !mediaFile) {
      toast.error("Choose a file before generating a media QR code.")
      return
    }
    if (!isNewMedia && !form.content.trim()) {
      toast.error("Add the content you want the QR code to open.")
      return
    }

    setSaving(true)
    try {
      let record: QRRecord
      const payload = payloadFromState(form)
      if (isNewMedia && mediaFile) {
        record = await qrApi.generateMedia(mediaFile, payload)
        if (record.content) update("content", record.content)
      } else if (isEditing) {
        if (!payload.qr_logo) payload.qr_logo = ""
        record = await qrApi.update(initial?.qr_id ?? 0, payload)
      } else {
        record = await qrApi.generate(payload)
      }
      setSavedRecord(record)
      setMediaFile(null)
      onSaved(record)
      toast.success(isEditing ? "QR code updated" : "Your QR code is ready")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save this QR code")
    } finally {
      setSaving(false)
    }
  }

  async function handleDownload() {
    const record = savedRecord
    if (!record?.qr_id) return
    try {
      const blob = await qrApi.download(record.qr_id)
      saveBlob(blob, `${safeFilename(record.title)}.${record.qr_format === "jpg" ? "jpg" : "png"}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Download failed")
    }
  }

  const imageCandidate = savedRecord?.public_url || savedRecord?.qr_public_url || ""
  const savedImage = imageCandidate.startsWith("http://") || imageCandidate.startsWith("https://") || imageCandidate.startsWith("/") ? imageCandidate : null
  const imageToShow = previewUrl || savedImage
  const saveLabel = isEditing ? "Save changes" : savedRecord ? "Saved to your library" : "Create QR code"

  return (
    <motion.section
      className="builder-grid"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="builder-form-column">
        <section className="panel builder-panel">
          <div className="panel-heading">
            <div className="step-heading"><span className="step-number">01</span><div><h2>Content</h2><p>What should happen when someone scans?</p></div></div>
            <span className="panel-icon"><WandSparkles aria-hidden="true" /></span>
          </div>
          <FieldGroup className="builder-fields">
            <Field>
              <FieldLabel htmlFor="qr-title">Name this QR code</FieldLabel>
              <Input
                id="qr-title"
                value={form.title}
                maxLength={120}
                placeholder="e.g. Spring campaign"
                onChange={(event) => update("title", event.target.value)}
              />
            </Field>
            <div className="builder-field-row">
              <Field>
                <FieldLabel htmlFor="qr-type">Content type</FieldLabel>
                <Select value={form.qr_type} onValueChange={(value) => value && update("qr_type", value)}>
                  <SelectTrigger id="qr-type" className="w-full"><SelectValue placeholder="Choose a type" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {typeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="qr-format">File format</FieldLabel>
                <Select value={form.qr_format} onValueChange={(value) => value && update("qr_format", value as "png" | "jpg")}>
                  <SelectTrigger id="qr-format" className="w-full"><SelectValue placeholder="Choose format" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="png">PNG · crisp</SelectItem>
                      <SelectItem value="jpg">JPG · compact</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {isNewMedia ? (
              <Field>
                <FieldLabel htmlFor="qr-media-file">Choose a file to share</FieldLabel>
                <label className={`upload-dropzone ${mediaFile ? "has-file" : ""}`} htmlFor="qr-media-file" aria-busy={mediaUploading}>
                  <span className="upload-icon">{mediaUploading ? <LoaderCircle className="spin" aria-hidden="true" /> : <FileImage aria-hidden="true" />}</span>
                  <span className="upload-copy"><strong>{mediaUploading ? "Uploading for preview…" : mediaName || "Choose a file to share"}</strong><small>{mediaFile ? "Click to choose a different file." : "PNG, JPEG, WebP, GIF, PDF, MP3, WAV, OGG, MP4, WebM, or MOV · up to 50 MB"}</small></span>
                  <Upload aria-hidden="true" className="upload-trailing" />
                  <input id="qr-media-file" type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,video/mp4,video/webm,video/quicktime" onChange={(event) => void handleMediaChange(event)} disabled={mediaUploading} />
                </label>
                <FieldDescription>The file is uploaded so the QR preview can use its public share URL.</FieldDescription>
              </Field>
            ) : (
              <Field>
                <div className="field-label-line"><FieldLabel htmlFor="qr-content">{form.qr_type === "url" ? "Destination URL" : "Content to encode"}</FieldLabel><span className="character-count">{form.content.length.toLocaleString()} characters</span></div>
                <textarea
                  id="qr-content"
                  className="content-textarea"
                  value={form.content}
                  placeholder={form.qr_type === "url" ? "https://yourwebsite.com" : "Paste the exact content to encode…"}
                  onChange={(event) => update("content", event.target.value)}
                  rows={4}
                  required
                />
                <FieldDescription>{typeDetail?.hint || "Your content is encoded exactly as entered."}</FieldDescription>
                {form.content.length > 512 && <p className="content-warning" role="status">Long payloads create denser QR codes and can be harder to scan. Use a short URL when possible.</p>}
              </Field>
            )}
          </FieldGroup>
        </section>

        <section className="panel builder-panel style-panel">
          <div className="panel-heading">
            <div className="step-heading"><span className="step-number">02</span><div><h2>Make it yours</h2><p>Choose a look that fits your brand.</p></div></div>
            <div className="style-heading-actions"><Button variant="ghost" size="sm" onClick={resetDesign}><RotateCcw data-icon="inline-start" aria-hidden="true" />Reset</Button><span className="panel-icon"><Palette aria-hidden="true" /></span></div>
          </div>

          <div className="color-grid">
            <ColorField id="qr-color" label="Pattern color" value={form.qr_color} draft={colorDrafts.qr_color} onDraftChange={(draft) => setColorDrafts((current) => ({ ...current, qr_color: draft }))} onChange={(value) => update("qr_color", value)} />
            <ColorField id="background-color" label="Background" value={form.background_color} draft={colorDrafts.background_color} onDraftChange={(draft) => setColorDrafts((current) => ({ ...current, background_color: draft }))} onChange={(value) => update("background_color", value)} />
            <ColorField id="eye-color" label="Corner eyes" value={form.corner_eye_color} draft={colorDrafts.corner_eye_color} onDraftChange={(draft) => setColorDrafts((current) => ({ ...current, corner_eye_color: draft }))} onChange={(value) => update("corner_eye_color", value)} />
          </div>

          <div className="style-options">
            <div className="style-row"><div><span className="style-label">Pattern</span><span className="style-hint">The QR modules</span></div>
              <ToggleGroup value={[form.qr_pattern_style]} onValueChange={(value) => value[0] && update("qr_pattern_style", value[0])} className="style-toggle-group" aria-label="QR pattern style">
                <ToggleGroupItem value="square" aria-label="Square pattern"><span className="pattern-glyph pattern-square" />Square</ToggleGroupItem>
                <ToggleGroupItem value="rounded" aria-label="Rounded pattern"><span className="pattern-glyph pattern-rounded" />Soft</ToggleGroupItem>
                <ToggleGroupItem value="dot" aria-label="Dot pattern"><span className="pattern-glyph pattern-dots" />Dots</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="style-row"><div><span className="style-label">Corner eyes</span><span className="style-hint">Finder frame shape</span></div>
              <ToggleGroup value={[form.corner_eye_style]} onValueChange={(value) => value[0] && update("corner_eye_style", value[0])} className="style-toggle-group" aria-label="Corner eye style">
                <ToggleGroupItem value="square" aria-label="Square corners"><span className="eye-glyph eye-square" />Sharp</ToggleGroupItem>
                <ToggleGroupItem value="rounded" aria-label="Rounded corners"><span className="eye-glyph eye-rounded" />Soft</ToggleGroupItem>
                <ToggleGroupItem value="dot" aria-label="Circular corners"><span className="eye-glyph eye-dot" />Round</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="builder-field-row compact-row">
            <Field>
              <FieldLabel htmlFor="qr-size">Export size</FieldLabel>
              <Select value={String(form.qr_size)} onValueChange={(value) => value && update("qr_size", Number(value))}>
                <SelectTrigger id="qr-size" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup><SelectItem value="256">256 px</SelectItem><SelectItem value="512">512 px</SelectItem><SelectItem value="1024">1024 px</SelectItem><SelectItem value="2048">2048 px</SelectItem></SelectGroup></SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Brand mark</FieldLabel>
              {form.qr_logo ? (
                <div className="logo-uploaded"><span className="logo-check"><Check aria-hidden="true" /></span><span className="truncate">{logoName || "Logo added"}</span><button type="button" onClick={clearLogo} aria-label="Remove QR logo">×</button></div>
              ) : (
                <label className="logo-upload-trigger" htmlFor="qr-logo"><ImagePlus aria-hidden="true" /><span>{uploadingLogo ? "Uploading…" : "Add a logo"}</span><input id="qr-logo" type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} disabled={uploadingLogo} /></label>
              )}
            </Field>
          </div>
          <p className="logo-note">A high-contrast logo keeps your QR code easier to scan.</p>
        </section>
      </div>

      <aside className="preview-column">
        <div className="preview-card">
          <div className="preview-header"><div><span className="preview-label"><span className="preview-live-dot" /> LIVE PREVIEW</span><h2>Your QR, in focus.</h2></div><button type="button" className="preview-refresh" aria-label="Regenerate preview" onClick={() => setForm((current) => ({ ...current }))}><RefreshCw aria-hidden="true" className={previewLoading ? "spin" : ""} /></button></div>
          <div className="qr-stage" style={{ backgroundColor: form.background_color }}>
            <div className="qr-paper">
              {previewLoading && !previewUrl && <div className="preview-loader"><LoaderCircle aria-hidden="true" /></div>}
              {imageToShow ? (
                <Image src={imageToShow} alt="Live preview of your QR code" width={440} height={440} unoptimized className="qr-preview-image" />
              ) : isNewMedia ? (
                <div className="media-preview-empty"><div className="media-preview-icon"><FileImage aria-hidden="true" /></div><strong>{mediaFile ? "File ready to scan" : "Your file goes here"}</strong><span>{mediaFile ? "Create the code to generate its share link." : "Add a file to create a shareable QR."}</span></div>
              ) : (
                <div className="qr-empty"><div className="qr-empty-icon"><QrCode aria-hidden="true" /></div><span>ADD CONTENT TO PREVIEW</span></div>
              )}
              {previewLoading && previewUrl && <span className="preview-updating"><LoaderCircle aria-hidden="true" /> Updating</span>}
            </div>
            <div className="stage-caption"><span>{form.title.trim() || "Untitled QR"}</span><span className="stage-format">{form.qr_format.toUpperCase()} · {form.qr_size}px</span></div>
          </div>
          {previewError && <Alert variant="destructive" className="preview-error"><AlertTitle>Preview unavailable</AlertTitle><AlertDescription>{previewError}</AlertDescription></Alert>}
          <div className="preview-footnote"><Sparkles aria-hidden="true" /><span>Preview updates as you design. Fine-tune with your colors, style, and logo.</span></div>
          <div className="preview-actions">
            <Button className="create-button" onClick={handleSave} disabled={saving || uploadingLogo || mediaUploading || (isNewMedia && !mediaFile) || (!isNewMedia && !form.content.trim())}>
              {saving ? <LoaderCircle data-icon="inline-start" className="spin" aria-hidden="true" /> : savedRecord && !isEditing ? <Check data-icon="inline-start" aria-hidden="true" /> : <WandSparkles data-icon="inline-start" aria-hidden="true" />}
              {saving ? "Creating your code…" : saveLabel}
              {!saving && !savedRecord && <ArrowRight data-icon="inline-end" aria-hidden="true" />}
            </Button>
            {savedRecord?.qr_id && (
              <Button variant="outline" className="download-button" onClick={handleDownload}>
                <ArrowDownToLine data-icon="inline-start" aria-hidden="true" /> Download
              </Button>
            )}
          </div>
          {savedRecord && <div className="saved-indicator"><span className="status-dot" /> Saved in your QR library</div>}
        </div>
        <div className="preview-tip"><div className="tip-icon"><Sparkles aria-hidden="true" /></div><div><strong>Scan-ready by design</strong><span>Keep strong contrast between your pattern and background for the best results.</span></div></div>
      </aside>
    </motion.section>
  )
}

function ColorField({ id, label, value, draft, onChange, onDraftChange }: { id: string; label: string; value: string; draft: string; onChange: (value: string) => void; onDraftChange: (draft: string) => void }) {
  const isValid = HEX_COLOR_PATTERN.test(draft)

  return (
    <Field className="color-field" data-invalid={!isValid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="color-input-wrap">
        <input id={id} type="color" value={value} onChange={(event) => { onDraftChange(event.target.value); onChange(event.target.value) }} aria-label={`${label} picker`} />
        <Input value={draft.toUpperCase()} maxLength={7} aria-label={`${label} hex value`} aria-invalid={!isValid} onChange={(event) => { const next = event.target.value; onDraftChange(next); if (HEX_COLOR_PATTERN.test(next)) onChange(next) }} onBlur={() => { if (!HEX_COLOR_PATTERN.test(draft)) onDraftChange(value) }} />
      </div>
      {!isValid && <FieldDescription>Enter a 6-digit hex color, such as #2A3B4C.</FieldDescription>}
    </Field>
  )
}
