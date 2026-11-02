// Info icon with a pop-up explanation: hover on desktop, tap on touch screens.

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { INPUT_INFO, type InfoKey } from './inputInfo'

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
/** Wide layouts have a sticky, scrolling sidebar, so the panel floats beside it instead of below the input. */
const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 861px)').matches
const PANEL_WIDTH = 340
const MARGIN = 8

interface InfoButtonProps {
  infoKey: InfoKey
  open: boolean
  onOpenChange: (key: InfoKey | null) => void
}

export function InfoButton({ infoKey, open, onOpenChange }: InfoButtonProps) {
  const info = INPUT_INFO[infoKey]
  const id = useId()
  const wrapper = useRef<HTMLSpanElement>(null)
  const pinned = useRef(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLSpanElement>(null)
  const [floatStyle, setFloatStyle] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!open || !isWide() || !button.current || !panel.current) {
      setFloatStyle(null)
      return
    }
    const anchor = button.current.getBoundingClientRect()
    const sidebar = button.current.closest('.controls')?.getBoundingClientRect()
    const height = panel.current.offsetHeight
    const left = Math.min((sidebar?.right ?? anchor.right) + 12, window.innerWidth - PANEL_WIDTH - MARGIN)
    const top = Math.max(MARGIN, Math.min(anchor.top - 12, window.innerHeight - height - MARGIN))
    setFloatStyle({ position: 'fixed', left, top, right: 'auto', width: PANEL_WIDTH })
  }, [open])

  useEffect(() => {
    if (!open) {
      pinned.current = false
      return
    }
    window.clearTimeout(closeTimer.current)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(null)
    const onPointer = (e: PointerEvent) => {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) onOpenChange(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, onOpenChange])

  return (
    <span
      ref={wrapper}
      className="info"
      onMouseEnter={() => {
        window.clearTimeout(closeTimer.current)
        if (canHover() && !open) onOpenChange(infoKey)
      }}
      onMouseLeave={() => {
        // Short grace period so the pointer can cross the gap to the floating panel.
        if (canHover() && open && !pinned.current)
          closeTimer.current = window.setTimeout(() => onOpenChange(null), 250)
      }}
    >
      <button
        type="button"
        ref={button}
        className="info-button"
        aria-label={`About ${info.title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (open && pinned.current) onOpenChange(null)
          else {
            pinned.current = true
            onOpenChange(infoKey)
          }
        }}
      >
        i
      </button>
      {open && (
        <span
          ref={panel}
          id={id}
          role="dialog"
          aria-label={info.title}
          className="info-panel"
          style={floatStyle ?? undefined}
          onClick={(e) => e.preventDefault()}
        >
          <strong className="info-title">{info.title}</strong>
          <span className="info-section">{info.what}</span>
          <span className="info-heading">Typical values</span>
          <span className="info-section">{info.typical}</span>
          <span className="info-heading">What it drives</span>
          <span className="info-list">
            {info.drives.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
          <span className="info-heading">Why it matters</span>
          <span className="info-section">{info.insight}</span>
          {info.reference && <span className="info-reference">{info.reference}</span>}
          <span className="info-hint">Highlighted results change with this input.</span>
        </span>
      )}
    </span>
  )
}
