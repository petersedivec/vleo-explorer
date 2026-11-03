// Thin wrapper around a lazily loaded Plotly cartesian bundle.

import { useEffect, useRef } from 'react'

type PlotlyModule = {
  react: (el: HTMLElement, data: unknown[], layout: unknown, config: unknown) => Promise<unknown>
  purge: (el: HTMLElement) => void
}

let plotlyPromise: Promise<PlotlyModule> | null = null
const loadPlotly = () =>
  (plotlyPromise ??= import('plotly.js-cartesian-dist-min').then((m) => (m.default ?? m) as PlotlyModule))

export interface ChartProps {
  data: unknown[]
  layout: Record<string, unknown>
  height?: number
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function Chart({ data, layout, height = 380 }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    loadPlotly().then((Plotly) => {
      if (cancelled) return
      const text = cssVar('--text')
      const grid = cssVar('--grid')
      const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: grid, color: text }
      // Log axes without explicit ticks: label decades only (Plotly's 2/5 minor labels read as bare digits).
      const withAxis = (spec?: object) => {
        const merged: Record<string, unknown> = { ...axis, ...(spec ?? {}) }
        if (merged.type === 'log' && !merged.tickvals && merged.dtick === undefined) {
          merged.dtick = 1
          merged.minor = { showgrid: true, gridcolor: grid, griddash: 'dot' }
        }
        return merged
      }
      const xaxis = withAxis(layout.xaxis as object)
      const yaxis = withAxis(layout.yaxis as object)
      const yaxis2 = layout.yaxis2 ? withAxis(layout.yaxis2 as object) : undefined
      Plotly.react(
        el,
        data,
        {
          margin: { l: 64, r: yaxis2 ? 64 : 16, t: 16, b: 56 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: { family: 'inherit', size: 12, color: text },
          legend: { orientation: 'h', x: 0, y: -0.32, yanchor: 'top' },
          height,
          ...layout,
          xaxis,
          yaxis,
          ...(yaxis2 ? { yaxis2 } : {}),
        },
        { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] },
      )
    })
    return () => {
      cancelled = true
    }
  }, [data, layout, height])

  useEffect(() => {
    const el = ref.current
    return () => {
      if (el && plotlyPromise) plotlyPromise.then((P) => P.purge(el))
    }
  }, [])

  return <div ref={ref} className="chart" style={{ minHeight: height }} />
}
