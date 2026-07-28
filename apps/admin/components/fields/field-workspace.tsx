"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, Check, ExternalLink, ImageIcon, Plus, Save, Search, Trash2, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { fieldPublishEligibility, reorderFieldMemberIds, RoadmapService, roadmapBackendEnabled, slugify, type CallerRole, type Field, type PublishStatus, type RoadmapNode } from "@workspace/core"
import { FIELD_DESCRIPTION_MAX, FIELD_DESCRIPTION_WARN } from "@workspace/core"

import { BASE_PATH } from "@/lib/paths"
import { deleteFieldCover, replaceFieldCover, uploadFieldCover } from "@/app/fields/actions"
import { inspectFieldImage } from "@/app/fields/field-image-policy"

const STATUS_LABEL: Record<PublishStatus, string> = { DRAFT: "Nháp", PUBLISHED: "Đã xuất bản", PRIVATE: "Riêng tư" }
const PUBLIC_WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"

export function FieldWorkspace({ id, role }: { id: string; role: CallerRole }) {
  const service = useMemo(() => new RoadmapService(), [])
  const isNew = id === "new"
  const [field, setField] = useState<Field | null>(null)
  const [nodes, setNodes] = useState<RoadmapNode[]>([])
  const [membershipIds, setMembershipIds] = useState<string[]>([])
  const [membershipOrderReady, setMembershipOrderReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState("")
  const [pickerSelection, setPickerSelection] = useState<string[]>([])
  const [pickerTag, setPickerTag] = useState<string | null>(null)
  const pickerDialogRef = useRef<HTMLDivElement>(null)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [lastDetached, setLastDetached] = useState<RoadmapNode | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)

  const load = async () => {
    if (!roadmapBackendEnabled()) throw new Error("CMS cần svc-api. Đặt NEXT_PUBLIC_SVC_API_URL trước khi dùng Field.")
    const allNodes = await service.listNodes()
    setNodes(allNodes.filter((node) => node.nodeType !== "article" && !node.isDeleted))
    if (isNew) {
      const draft: Field = { id: "", title: "", slug: "", description: null, imageUrl: null, order: 0, publishStatus: "DRAFT" }
      setField(draft)
      setSavedSnapshot(snapshot(draft))
      return
    }
    const allFields = await service.listAdminFields(role)
    const loaded = allFields.find((item) => item.id === id) ?? null
    setField(loaded)
    if (loaded) {
      // Old deployments have the legacy implicit relation but no ordered join
      // endpoint yet. Keep the workspace usable during a rolling deploy; the
      // next successful refresh switches to FieldMembership order.
      let orderedIds: string[]
      try {
        orderedIds = await service.listFieldNodeIds(loaded.id, role)
        setMembershipOrderReady(true)
      } catch {
        // Older deployments still have the implicit relation. Render it but
        // don't expose reordering until the ordered join endpoint is ready.
        orderedIds = allNodes
          .filter((node) => node.fields?.some((item) => item.id === loaded.id))
          .map((node) => node.id)
        setMembershipOrderReady(false)
      }
      setMembershipIds(orderedIds)
    } else {
      setMembershipIds([])
      setMembershipOrderReady(false)
    }
    setSavedSnapshot(loaded ? snapshot(loaded) : "")
  }
  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Không thể tải Field Workspace.")) }, [])

  const dirty = field ? snapshot(field) !== savedSnapshot : false
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  if (!field) return <div className="grid min-h-[50vh] place-items-center px-5 text-center text-sm text-muted-foreground">{error ? <p role="alert" className="max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">{error}</p> : "Đang tải Field Workspace…"}</div>

  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const membership = membershipIds
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is RoadmapNode => Boolean(node))
  const publishedRoadmap = membership.some((node) => node.publishStatus === "PUBLISHED")
  const eligibility = fieldPublishEligibility({ title: field.title, slug: field.slug, description: field.description, imageUrl: field.imageUrl, publicBlockCount: publishedRoadmap ? 1 : 0 })
  const update = <K extends keyof Field>(key: K, value: Field[K]) => {
    const next = { ...field, [key]: value }
    if (isNew && key === "title" && !slugTouched) {
      next.slug = String(value).trim() ? slugify(String(value)) : ""
    }
    setField(next)
  }

  const uploadImage = async (file: File | undefined) => {
    if (!file) return
    setError("")
    try {
      const bitmap = await createImageBitmap(file)
      const policy = inspectFieldImage({ name: file.name, size: file.size, type: file.type, width: bitmap.width, height: bitmap.height })
      bitmap.close()
      if (!policy.ok) throw new Error(fieldImageMessage(policy.code))
      const form = new FormData()
      form.set("file", file)
      // #47: when a Field already has an image, replacing it must delete the
      // old Blob so we don't leak a file nobody references. New Fields keep the
      // plain upload path.
      const previous = !isNew ? field.imageUrl : null
      const uploaded = previous
        ? await replaceFieldCover(form, previous)
        : await uploadFieldCover(form)
      update("imageUrl", uploaded.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải ảnh lên.")
    }
  }

  const save = async () => {
    if ((field.publishStatus === "PUBLISHED" || field.publishStatus === "PRIVATE") && !eligibility.ok) {
      setError(fieldMessage(eligibility.code))
      return
    }
    setSaving(true); setError("")
    try {
      const saved = isNew
        ? await service.createField({ title: field.title, slug: field.slug, description: field.description, imageUrl: field.imageUrl, publishStatus: field.publishStatus }, role)
        : await service.updateField(field.id, { title: field.title, description: field.description, imageUrl: field.imageUrl, publishStatus: field.publishStatus, order: field.order }, role)
      setField(saved)
      setSavedSnapshot(snapshot(saved))
      if (isNew) { window.location.assign(`${BASE_PATH}/fields/${saved.id}`); return }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu lĩnh vực.")
    } finally { setSaving(false) }
  }

  const toggle = async (node: RoadmapNode) => {
    const selected = node.fields?.some((item) => item.id === field.id) ?? false
    const fieldIds = selected
      ? (node.fields ?? []).filter((item) => item.id !== field.id).map((item) => item.id)
      : [...(node.fields ?? []).map((item) => item.id), field.id]
    setError("")
    try {
      await service.updateNode(node.id, { fieldIds }, role)
      if (selected) setLastDetached(node)
      await load()
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật roadmap.") }
  }

  const openPicker = () => {
    setPickerQuery("")
    setPickerSelection([])
    setPickerTag(null)
    setPickerOpen(true)
  }

  const addSelected = async () => {
    if (pickerSelection.length === 0) return
    setError("")
    try {
      for (const nodeId of pickerSelection) {
        const node = nodesById.get(nodeId)
        if (!node) continue
        const fieldIds = [...(node.fields ?? []).map((item) => item.id), field.id]
        await service.updateNode(node.id, { fieldIds: [...new Set(fieldIds)] }, role)
      }
      setPickerOpen(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể thêm roadmap vào lĩnh vực.")
    }
  }

  const undoDetach = async () => {
    if (!lastDetached) return
    try {
      const fieldIds = [...(lastDetached.fields ?? []).map((item) => item.id), field.id]
      await service.updateNode(lastDetached.id, { fieldIds: [...new Set(fieldIds)] }, role)
      setLastDetached(null)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể hoàn tác thao tác gỡ roadmap.")
    }
  }

  const moveMembershipTo = async (activeId: string, overId: string) => {
    const next = reorderFieldMemberIds(membershipIds, activeId, overId)
    if (next.join("|") === membershipIds.join("|")) return
    setMembershipIds(next)
    setError("")
    try {
      await service.reorderFieldMembership(field.id, next, role)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể sắp xếp roadmap.")
      await load()
    }
  }

  const moveMembership = async (nodeId: string, direction: -1 | 1) => {
    const index = membershipIds.indexOf(nodeId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= membershipIds.length) return
    const overId = membershipIds[target]
    if (!overId) return
    await moveMembershipTo(nodeId, overId)
  }

  const remove = async () => {
    if (field.publishStatus !== "DRAFT" || deleting) return
    if (!window.confirm(`Xóa bản nháp “${field.title}”? Roadmap blocks vẫn được giữ lại.`)) return
    setDeleting(true); setError("")
    try {
      await service.deleteField(field.id, role)
      // #47: the Field's image is cleaned up when the Field is deleted. Best
      // effort via the server action so a Blob deletion failure does not leave
      // the deletion half-done.
      if (field.imageUrl) await deleteFieldCover(field.imageUrl).catch(() => {})
      window.location.assign(`${BASE_PATH}/fields`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa lĩnh vực.")
      setDeleting(false)
    }
  }

  return <main className="min-h-[calc(100vh-57px)] bg-background text-foreground">
    <header className="flex h-[58px] items-center justify-between border-b px-4 lg:px-7"><nav className="flex items-center gap-2 text-sm"><Link href={`${BASE_PATH}/fields`} className="text-muted-foreground hover:text-foreground">CMS</Link><span className="text-muted-foreground">›</span><Link href={`${BASE_PATH}/fields`} className="text-muted-foreground hover:text-foreground">Lĩnh vực</Link><span className="text-muted-foreground">›</span><span className="font-semibold">{field.title || "Lĩnh vực mới"}</span></nav><div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{saving ? "Đang lưu…" : dirty ? "Chưa lưu" : "Đã lưu"}</span>{!isNew && field.publishStatus === "DRAFT" && <button type="button" onClick={() => void remove()} disabled={deleting} className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 sm:flex"><Trash2 className="size-3.5" />{deleting ? "Đang xóa…" : "Xóa nháp"}</button>}{!isNew && field.publishStatus !== "DRAFT" && <a href={`${PUBLIC_WEB_ORIGIN}/?field=${encodeURIComponent(field.slug)}`} target="_blank" rel="noreferrer" className="hidden h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold sm:flex"><ExternalLink className="size-3.5" />Xem trước</a>}<Button onClick={() => void save()} disabled={saving || !dirty || !field.title.trim()} className="h-9 rounded-lg bg-[#ff385c] px-3 text-xs font-semibold hover:bg-[#e31c5f]"><Save className="mr-1.5 size-3.5" />{isNew ? "Tạo lĩnh vực" : "Lưu lĩnh vực"}</Button></div></header>

    <div className="grid min-h-[calc(100vh-115px)] lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="border-b p-4 lg:border-b-0 lg:border-r lg:p-5"><h1 className="text-xl font-bold tracking-tight">Thông tin lĩnh vực</h1><p className="mt-1 text-sm leading-5 text-muted-foreground">Ảnh được dùng cho cả thumbnail và nền toàn màn hình ở trang chủ.</p>
        <div className="mt-7 space-y-4"><label className="block text-sm font-semibold">Tiêu đề<Input className="mt-2 h-11" value={field.title} onChange={(event) => update("title", event.target.value)} /></label><label className="block text-sm font-semibold">Slug<span className="float-right text-xs font-normal text-muted-foreground">{isNew ? "Cố định sau lần lưu đầu" : "Slug đã cố định để giữ liên kết"}</span>{isNew ? <Input className="mt-2 h-10 font-normal" value={field.slug} onChange={(event) => { setSlugTouched(true); update("slug", event.target.value) }} placeholder="ai" /> : <span className="mt-2 block rounded-lg border bg-muted/30 px-3 py-2.5 text-sm font-normal text-muted-foreground">/ {field.slug}</span>}</label><label className="block text-sm font-semibold">Mô tả<span className={cn("float-right text-xs font-normal", (field.description?.length ?? 0) >= FIELD_DESCRIPTION_WARN ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{field.description?.length ?? 0}/{FIELD_DESCRIPTION_MAX}</span><textarea value={field.description ?? ""} maxLength={FIELD_DESCRIPTION_MAX} onChange={(event) => update("description", event.target.value)} className="mt-2 min-h-24 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm font-normal outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" placeholder="Mô tả lĩnh vực cho người học…" /></label>
          <label className="block text-sm font-semibold">Thứ tự hiển thị<Input type="number" min={0} value={field.order} onChange={(event) => update("order", Math.max(0, Number(event.target.value) || 0))} className="mt-2 h-10 font-normal" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Số nhỏ hiển thị trước trong Field Explorer.</span></label><label className="block text-sm font-semibold">Ảnh nền<span className="mt-2 flex aspect-[3/1.15] items-center justify-center rounded-lg border border-dashed bg-muted/35 text-center text-xs font-normal text-muted-foreground" style={field.imageUrl ? { backgroundImage: `linear-gradient(#0006,#0006),url(${field.imageUrl})`, backgroundPosition: "center", backgroundSize: "cover", color: "white" } : undefined}><span><ImageIcon className="mx-auto mb-1 size-5" />{field.imageUrl ? "Ảnh nền đang dùng" : "JPG hoặc WebP, tỷ lệ 3:2"}</span></span><Input type="file" accept="image/jpeg,image/webp" onChange={(event) => void uploadImage(event.currentTarget.files?.[0])} className="mt-2 h-10 cursor-pointer pt-1.5 font-normal" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Tối thiểu 2400×1600, dưới 2 MB. Ảnh chỉ được cập nhật bằng upload đã kiểm tra.</span></label>
        </div>
      </aside>

      <section className="relative min-h-[600px] overflow-hidden bg-[radial-gradient(#d7d7d7_1px,transparent_1px)] dark:bg-[radial-gradient(#3a3a3a_1px,transparent_1px)] bg-[size:18px_18px] p-5 lg:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Roadmap trong lĩnh vực</h2><p className="text-sm text-muted-foreground">{isNew ? "Lưu lĩnh vực nháp trước khi thêm roadmap." : `${membership.length} roadmap · block có thể thuộc nhiều lĩnh vực.`}</p></div><button type="button" disabled={isNew} onClick={openPicker} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-semibold shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" />Thêm roadmap</button></div>
        {membership.length === 0 && <p className="mt-5 rounded-xl border border-dashed bg-card/60 p-5 text-sm text-muted-foreground">Lĩnh vực chưa có roadmap nên người học chưa có điểm đến. Thêm ít nhất một roadmap đã xuất bản trước khi xuất bản lĩnh vực.</p>}
        {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
        {lastDetached && <p role="status" className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm"><span>Đã gỡ <strong>{lastDetached.title}</strong> khỏi lĩnh vực.</span><button type="button" onClick={() => void undoDetach()} className="font-semibold text-[#d6284f] underline">Hoàn tác</button></p>}
        {!isNew && !membershipOrderReady && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">Danh sách đang đồng bộ thứ tự lĩnh vực. Tải lại khi backend hoàn tất để sắp xếp roadmap.</p>}<div className="mt-5 flex flex-wrap gap-4">{membership.map((node, index) => <RoadmapCard key={node.id} node={node} nodeCount={nodes.filter((item) => item.parentId === node.id).length} reorderable={membershipOrderReady} dragging={membershipOrderReady && draggingNodeId === node.id} onDragStart={() => membershipOrderReady && setDraggingNodeId(node.id)} onDragEnd={() => setDraggingNodeId(null)} onDrop={() => { if (membershipOrderReady && draggingNodeId) void moveMembershipTo(draggingNodeId, node.id); setDraggingNodeId(null) }} onRemove={() => void toggle(node)} onMoveUp={membershipOrderReady && index > 0 ? () => void moveMembership(node.id, -1) : undefined} onMoveDown={membershipOrderReady && index < membership.length - 1 ? () => void moveMembership(node.id, 1) : undefined} />)}<button type="button" disabled={isNew} onClick={openPicker} className="grid h-[210px] w-[240px] place-items-center rounded-2xl border border-dashed bg-card/55 text-sm font-medium text-muted-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"><span className="text-center"><Plus className="mx-auto mb-3 size-7" />Thêm roadmap</span></button></div>
        <div className="absolute bottom-5 right-5 flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-xs shadow-lg"><span className="text-muted-foreground">Trạng thái</span>{(["DRAFT", "PUBLISHED", "PRIVATE"] as const).map((status) => <button key={status} type="button" onClick={() => update("publishStatus", status)} className={cn("rounded-full px-2.5 py-1 font-semibold", field.publishStatus === status ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>{STATUS_LABEL[status]}</button>)}</div>
      </section>
    </div>

    {pickerOpen && (() => {
      const allTags = [...new Set(nodes.flatMap((node) => node.tags ?? []))].sort()
      const pickerResults = nodes
        .filter((node) => `${node.title} ${node.slug}`.toLocaleLowerCase("vi").includes(pickerQuery.trim().toLocaleLowerCase("vi")))
        .filter((node) => !pickerTag || (node.tags ?? []).includes(pickerTag))
      // Simple, dependency-free focus trap: Tab/Shift+Tab wrap within the
      // dialog's own focusable elements instead of escaping to the page
      // behind it, which the fixed+z-50 overlay would otherwise let happen.
      const trapTab = (event: React.KeyboardEvent) => {
        if (event.key === "Escape") { setPickerOpen(false); return }
        if (event.key !== "Tab" || !pickerDialogRef.current) return
        const focusables = pickerDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
      return <div role="dialog" aria-modal="true" aria-labelledby="roadmap-picker-title" className="fixed inset-0 z-50 flex justify-end bg-black/25" onKeyDown={trapTab}><section ref={pickerDialogRef} tabIndex={-1} className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-background p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h2 id="roadmap-picker-title" className="text-lg font-bold">Thêm roadmap</h2><p className="mt-1 text-sm text-muted-foreground">Chọn một hoặc nhiều block rồi xác nhận.</p></div><button type="button" onClick={() => setPickerOpen(false)} aria-label="Đóng"><X className="size-5" /></button></div><label className="relative mt-5 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} className="h-10 pl-9" placeholder="Tìm theo tên hoặc slug…" /></label>{allTags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5"><button type="button" onClick={() => setPickerTag(null)} className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", pickerTag === null ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>Tất cả</button>{allTags.map((tag) => <button key={tag} type="button" onClick={() => setPickerTag((current) => current === tag ? null : tag)} className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", pickerTag === tag ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>{tag}</button>)}</div>}<div className="mt-4 flex-1 space-y-2">{pickerResults.map((node) => { const attached = membershipIds.includes(node.id); const selected = pickerSelection.includes(node.id); return <button key={node.id} type="button" disabled={attached} onClick={() => setPickerSelection((current) => selected ? current.filter((item) => item !== node.id) : [...current, node.id])} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-55", selected && "border-[#ff385c] bg-[#fff6f8] dark:bg-[#ff385c]/10")}><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted" style={node.coverUrl ? { backgroundImage: `url(${node.coverUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{!node.coverUrl && <ImageIcon className="size-4 text-muted-foreground" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{node.title}</span><span className="block truncate text-xs text-muted-foreground">{node.description || "Chưa có mô tả"} · {nodes.filter((item) => item.parentId === node.id).length} block · {node.level || "Chưa chọn cấp độ"}</span></span><span className={cn("grid size-5 place-items-center rounded-full border", (attached || selected) && "border-[#ff385c] bg-[#ff385c] text-white")}>{(attached || selected) && <Check className="size-3" />}</span></button> })}{pickerResults.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Không có roadmap phù hợp. <button type="button" onClick={() => { setPickerQuery(""); setPickerTag(null) }} className="font-semibold text-foreground underline">Xóa tìm kiếm</button></p>}</div><div className="mt-5 flex items-center justify-between border-t pt-4"><span className="text-sm text-muted-foreground">Đã chọn {pickerSelection.length} roadmap</span><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setPickerOpen(false)}>Hủy</Button><Button type="button" disabled={pickerSelection.length === 0} className="bg-[#ff385c] hover:bg-[#e31c5f]" onClick={() => void addSelected()}>Thêm đã chọn</Button></div></div></section></div>
    })()}
  </main>
}

function RoadmapCard({ node, nodeCount, reorderable, dragging, onDragStart, onDragEnd, onDrop, onRemove, onMoveUp, onMoveDown }: { node: RoadmapNode; nodeCount: number; reorderable: boolean; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onDrop: () => void; onRemove: () => void; onMoveUp?: () => void; onMoveDown?: () => void }) {
  // Native title tooltip: the detail (description, block count, level) shows
  // on hover without navigating off the canvas, and needs no floating-UI
  // dependency or extra state to manage.
  const detail = [node.description, `${nodeCount} block`, node.level || "Chưa chọn cấp độ"]
    .filter(Boolean)
    .join(" · ")
  return <article title={detail} draggable={reorderable} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={(event) => reorderable && event.preventDefault()} onDrop={onDrop} className={cn("relative w-[240px] overflow-hidden rounded-2xl border bg-card p-2 shadow-sm", reorderable && "cursor-grab active:cursor-grabbing", dragging && "opacity-45")}><button type="button" onClick={onRemove} aria-label={`Bỏ ${node.title}`} className="absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-full bg-black/55 text-white hover:bg-black"><X className="size-3.5" /></button><div role="img" aria-label={`Ảnh bìa ${node.title}`} className="grid h-32 place-items-center rounded-xl bg-muted text-muted-foreground" style={node.coverUrl ? { backgroundImage: `linear-gradient(#0005,#0005),url(${node.coverUrl})`, backgroundPosition: "center", backgroundSize: "cover", color: "white" } : undefined}><ImageIcon className="size-6" /></div><div className="flex items-end gap-2 px-1 pb-1 pt-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{node.title}</p><p className="mt-1 text-xs text-muted-foreground">{nodeCount} block · {node.level || "Chưa chọn cấp độ"}</p></div><div className="flex rounded-md border bg-background"><button type="button" disabled={!onMoveUp} onClick={onMoveUp} aria-label={`Đưa ${node.title} lên`} className="grid size-7 place-items-center disabled:cursor-not-allowed disabled:opacity-35"><ArrowUp className="size-3.5" /></button><button type="button" disabled={!onMoveDown} onClick={onMoveDown} aria-label={`Đưa ${node.title} xuống`} className="grid size-7 place-items-center border-l disabled:cursor-not-allowed disabled:opacity-35"><ArrowDown className="size-3.5" /></button></div></div></article>
}

function snapshot(field: Field) {
  return JSON.stringify({
    title: field.title,
    slug: field.slug,
    description: field.description,
    imageUrl: field.imageUrl,
    publishStatus: field.publishStatus,
    order: field.order,
  })
}

function fieldMessage(code: string) {
  const messages: Record<string, string> = {
    FIELD_TITLE_REQUIRED: "Cần tiêu đề trước khi xuất bản.",
    FIELD_SLUG_REQUIRED: "Cần slug trước khi xuất bản.",
    FIELD_DESCRIPTION_REQUIRED: "Cần mô tả trước khi xuất bản.",
    FIELD_IMAGE_REQUIRED: "Cần ảnh HTTPS trước khi xuất bản.",
    FIELD_PUBLIC_BLOCK_REQUIRED: "Cần ít nhất một roadmap đã xuất bản trước khi xuất bản lĩnh vực.",
  }
  return messages[code] ?? "Lĩnh vực chưa đủ điều kiện xuất bản."
}

function fieldImageMessage(code: string) {
  if (code === "FILE_TOO_LARGE") return "Ảnh phải nhỏ hơn 2 MB."
  if (code === "UNSUPPORTED_FILE_TYPE") return "Chỉ nhận ảnh JPG hoặc WebP."
  if (code === "INVALID_DIMENSIONS") return "Ảnh cần tỷ lệ 3:2 và tối thiểu 2400×1600."
  return "Không tìm thấy ảnh để tải lên."
}
