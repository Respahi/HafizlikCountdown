import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_DAYS    = 600
const TOTAL_JUZ     = 30
const PPJ           = 20   // pages per juz

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dayInfo(d) {
  return {
    month: Math.floor((d - 1) / TOTAL_JUZ) + 1,   // 1–20  (pages per day this cycle)
    juz:   ((d - 1) % TOTAL_JUZ) + 1,              // 1–30  (which juz today)
  }
}

// cell (j, r): j = juz 1–30 (column), r = 1–20 (row, r=1 = page 20 = first memorized)
// r=1 is at the BOTTOM of the grid; r=20 is at the TOP
function cellState(j, r, d) {
  const { month, juz } = dayInfo(d)
  if (j === juz && r <= month) return r === month ? 'ham' : 'has'
  const firstDay = (r - 1) * TOTAL_JUZ + j
  return firstDay < d ? 'done' : 'empty'
}

function globalPage(j, r) {
  return (j - 1) * PPJ + (PPJ + 1 - r)   // r=1 → page 20, r=20 → page 1
}

// ─── Component ───────────────────────────────────────────────────────────────
export function SistemView() {
  // ── State ───────────────────────────────────────────────────────────────────
  const dayRef      = useRef(1)
  const [day, _setDay]    = useState(1)
  const isAnimRef   = useRef(false)
  const pdfRef      = useRef(null)
  const canvasRef   = useRef(null)

  const [animKey,   setAnimKey]   = useState(null)      // `${j},${r}` while pulsing
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCell, setModalCell] = useState(null)      // { j, r, page, pageInJuz }
  const [pdfStatus, setPdfStatus] = useState('idle')    // idle|loading|loaded|missing
  const [canvasKey, setCanvasKey] = useState(0)         // force canvas re-render

  // ── Day setter (syncs ref) ──────────────────────────────────────────────────
  const setDay = useCallback((d) => {
    dayRef.current = d
    _setDay(d)
  }, [])

  // ── Load PDF.js + static PDF ────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        if (!window.pdfjsLib) {
          await new Promise((res, rej) => {
            const s = document.createElement('script')
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
            s.onload = res; s.onerror = rej
            document.head.appendChild(s)
          })
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        }
        setPdfStatus('loading')
        const resp = await fetch(import.meta.env.BASE_URL + 'quran.pdf')
        if (!resp.ok) throw new Error('not found')
        const buf = await resp.arrayBuffer()
        pdfRef.current = await window.pdfjsLib.getDocument({ data: buf }).promise
        setPdfStatus('loaded')
      } catch {
        setPdfStatus('missing')
      }
    }
    init()
  }, [])

  // ── Render PDF page when modal opens ───────────────────────────────────────
  useEffect(() => {
    if (!modalOpen || !modalCell || pdfStatus !== 'loaded') return
    const canvas = canvasRef.current
    if (!canvas) return
    ;(async () => {
      try {
        const pg   = await pdfRef.current.getPage(modalCell.page)
        const vp   = pg.getViewport({ scale: 1.5 })
        canvas.width  = vp.width
        canvas.height = vp.height
        await pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
      } catch {}
    })()
  }, [modalOpen, modalCell, pdfStatus, canvasKey])

  // ── Navigation ──────────────────────────────────────────────────────────────
  const advance = useCallback(() => {
    if (isAnimRef.current) return
    const next = Math.min(TOTAL_DAYS, dayRef.current + 1)
    if (next === dayRef.current) return
    setDay(next)
    const { month, juz } = dayInfo(next)
    setAnimKey(`${juz},${month}`)
    setTimeout(() => setAnimKey(null), 400)
  }, [setDay])

  const retreat = useCallback(() => {
    if (isAnimRef.current) return
    setDay(Math.max(1, dayRef.current - 1))
  }, [setDay])

  const reset = useCallback(() => {
    isAnimRef.current = false
    setDay(1)
    setAnimKey(null)
  }, [setDay])

  const nextMonth = useCallback(async () => {
    if (isAnimRef.current || dayRef.current >= TOTAL_DAYS) return
    isAnimRef.current = true
    const target = Math.min(TOTAL_DAYS, dayRef.current + 30)
    for (let d = dayRef.current + 1; d <= target; d++) {
      const { month, juz } = dayInfo(d)
      setDay(d)
      setAnimKey(`${juz},${month}`)
      await new Promise(r => setTimeout(r, 55))
    }
    setAnimKey(null)
    isAnimRef.current = false
  }, [setDay])

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (modalOpen) {
        if (e.key === 'Escape') setModalOpen(false)
        return
      }
      if (e.key === 'ArrowRight' && !e.shiftKey) { e.preventDefault(); advance() }
      if (e.key === 'ArrowLeft'  && !e.shiftKey) { e.preventDefault(); retreat() }
      if (e.key === 'ArrowRight' &&  e.shiftKey) { e.preventDefault(); nextMonth() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modalOpen, advance, retreat, nextMonth])

  // ── Cell click → modal ─────────────────────────────────────────────────────
  const handleCellClick = useCallback((j, r) => {
    setModalCell({ j, r, page: globalPage(j, r), pageInJuz: PPJ + 1 - r })
    setCanvasKey(k => k + 1)
    setModalOpen(true)
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const { month, juz } = dayInfo(day)
  const pct = Math.max(0.3, (day / TOTAL_DAYS) * 100)

  // ── Pre-build cell descriptors (stable across renders) ────────────────────
  const cellMeta = useMemo(() => {
    const arr = []
    for (let r = PPJ; r >= 1; r--) {           // r=PPJ at top, r=1 at bottom
      for (let j = 1; j <= TOTAL_JUZ; j++) {
        arr.push({ j, r })
      }
    }
    return arr
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="sistem-main">

      {/* Header */}
      <div className="sistem-header">
        <h2 className="sistem-title">Osmanlı Usûlü Hafızlık Sistemi</h2>
        <p className="sistem-sub">Her kare bir sayfayı temsil eder · Sütunlar cüzleri · Satırlar ayları gösterir</p>
      </div>

      {/* Legend */}
      <div className="sc-legend">
        {[
          ['sc-dot-ham',  'Ham Sayfa — Yeni Ezber'],
          ['sc-dot-has',  'Has Sayfa — Tekrar'],
          ['sc-dot-done', 'Tamamlandı'],
          ['sc-dot-empty','Henüz Ezberlenmedi'],
        ].map(([cls, label]) => (
          <div key={cls} className="sc-legend-item">
            <span className={`sc-dot ${cls}`} />
            {label}
          </div>
        ))}
      </div>

      <div className="sistem-layout">

        {/* ── Grid Area ── */}
        <div className="sistem-grid-area">

          {/* Day bar */}
          <div className="sc-daybar">
            <span><b>{day}</b>. Gün</span>
            <span className="sc-daybar-sep">·</span>
            <span><b>{month}</b>. Ay</span>
            <span className="sc-daybar-sep">·</span>
            <span><b>{juz}</b>. Cüz</span>
          </div>
          <div className="sc-progress-wrap">
            <div className="sc-progress-fill" style={{ width: `${pct}%` }} />
          </div>

          {/* Grid with row/col labels */}
          <div className="sc-grid-outer">
            {/* Row labels: r=PPJ at top (page 1), r=1 at bottom (page 20) */}
            <div className="sc-row-labels">
              {Array.from({ length: PPJ }, (_, i) => {
                const r = PPJ - i
                return <div key={r} className="sc-row-label">{PPJ + 1 - r}</div>
              })}
            </div>

            <div>
              {/* Column labels */}
              <div className="sc-col-labels">
                {Array.from({ length: TOTAL_JUZ }, (_, i) => (
                  <div key={i} className="sc-col-label">{i + 1}</div>
                ))}
              </div>

              {/* Cells */}
              <div className="sc-grid">
                {cellMeta.map(({ j, r }) => {
                  const st   = cellState(j, r, day)
                  const anim = animKey === `${j},${r}`
                  return (
                    <div
                      key={`${j}-${r}`}
                      className={`sc-cell sc-${st}${anim ? ' sc-anim' : ''}`}
                      title={`${j}. Cüz — ${PPJ + 1 - r}. Sayfa (${globalPage(j, r)})`}
                      onClick={() => handleCellClick(j, r)}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="sc-controls">
            <button className="sc-btn sc-btn-ghost" onClick={retreat} disabled={day <= 1}>
              ← Önceki
            </button>
            <button className="sc-btn sc-btn-primary" onClick={advance} disabled={day >= TOTAL_DAYS}>
              Sonraki →
            </button>
            <button className="sc-btn sc-btn-accent" onClick={nextMonth} disabled={day >= TOTAL_DAYS}>
              ⏩ Sonraki Ay
            </button>
            <button className="sc-btn sc-btn-ghost" onClick={reset}>
              ↺ Sıfırla
            </button>
          </div>
          <div className="sc-key-hint">← → ok tuşları &nbsp;·&nbsp; Shift+→ sonraki ay &nbsp;·&nbsp; Kareye tıkla → sayfa görüntüle</div>
        </div>

        {/* ── Sidebar ── */}
        <div className="sc-sidebar">
          <div className="sc-stat-card">
            <div className="sc-stat-label">Günlük Tempo</div>
            <div className="sc-stat-val sc-val-accent">{month}</div>
            <div className="sc-stat-sub">'le gidiyor</div>
          </div>
          <div className="sc-stat-card">
            <div className="sc-stat-label">Bugünkü Cüz</div>
            <div className="sc-stat-frac">
              <span className="sc-frac-n">{juz}</span>
              <span className="sc-frac-d"> / 30</span>
            </div>
            <div className="sc-stat-sub">cüz</div>
          </div>
          <div className="sc-stat-card">
            <div className="sc-stat-label">Geçen Ay</div>
            <div className="sc-stat-frac">
              <span className="sc-frac-n">{month}</span>
              <span className="sc-frac-d"> / 20</span>
            </div>
            <div className="sc-stat-sub">ay</div>
          </div>
          <div className="sc-stat-card">
            <div className="sc-stat-label">Toplam Gün</div>
            <div className="sc-stat-val">{day}</div>
            <div className="sc-stat-sub">/ 600 gün</div>
          </div>
          <div className="sc-stat-card">
            <div className="sc-stat-label">Tamamlanan</div>
            <div className="sc-stat-val">{Math.round(pct)}%</div>
            <div className="sc-stat-sub">hafızlık</div>
          </div>
          {day >= TOTAL_DAYS && (
            <div className="sc-complete-badge">
              🎉 Hafızlık Tamamlandı!
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div
          className="sc-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="sc-modal-box">
            <button className="sc-modal-close" onClick={() => setModalOpen(false)}>✕</button>
            <div className="sc-modal-header">
              <h3>{modalCell?.j}. Cüz &mdash; {modalCell?.pageInJuz}. Sayfa</h3>
              <p>Kuran&rsquo;ın {modalCell?.page}. sayfası</p>
            </div>
            {pdfStatus === 'loaded' && (
              <canvas ref={canvasRef} className="sc-modal-canvas" />
            )}
            {pdfStatus === 'loading' && (
              <div className="sc-modal-placeholder">PDF yükleniyor…</div>
            )}
            {pdfStatus === 'missing' && (
              <div className="sc-modal-placeholder">
                PDF bulunamadı.<br />
                <small>public/quran.pdf dosyasını projeye ekleyin.</small>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
