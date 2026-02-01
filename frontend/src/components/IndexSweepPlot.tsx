import { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { SimulationResult } from '@/lib/api'

interface IndexSweepPlotProps {
  sweepResults: SimulationResult[]
  sweepParam: 'n' | 'r' | 'a' | 't'  // Parameter that was swept
  wavelengthsOfInterest?: number[]  // Specific wavelengths to extract (nm)
  darkMode?: boolean
  title?: string
  yAxisField?: 'absorptance' | 'reflectance' | 'transmittance'
}

// Color palette for different wavelength lines
const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

// Parameter display names
const PARAM_LABELS: Record<string, string> = {
  n: 'Silicon Refractive Index',
  r: 'Hole Radius (µm)',
  a: 'Lattice Constant (µm)',
  t: 'Thickness (µm)',
}

export default function IndexSweepPlot({
  sweepResults,
  sweepParam,
  wavelengthsOfInterest,
  darkMode = true,
  title,
  yAxisField = 'absorptance',
}: IndexSweepPlotProps) {
  // Extract the swept parameter values and corresponding Y values at specific wavelengths
  const { traces, paramLabel } = useMemo(() => {
    if (sweepResults.length === 0) {
      return { traces: [], xValues: [], paramLabel: '' }
    }

    // Get the swept parameter values
    const paramLabel = PARAM_LABELS[sweepParam] || sweepParam

    // Extract X values (the swept parameter)
    const xValues = sweepResults.map((result) => {
      switch (sweepParam) {
        case 'n':
          return result.config.n_silicon
        case 'r':
          return result.config.radius
        case 'a':
          return result.config.lattice_constant
        case 't':
          return result.config.thickness
        default:
          return 0
      }
    })

    // Determine wavelengths of interest
    let targetWavelengths = wavelengthsOfInterest
    if (!targetWavelengths || targetWavelengths.length === 0) {
      // Auto-detect: find wavelengths with peak absorption
      const firstResult = sweepResults[0]
      const yData = firstResult[yAxisField] || []
      
      // Find top 3 peaks
      const peaks: { wavelength: number; value: number }[] = []
      for (let i = 1; i < yData.length - 1; i++) {
        if (yData[i] > yData[i - 1] && yData[i] > yData[i + 1] && yData[i] > 0.1) {
          peaks.push({ wavelength: firstResult.wavelengths[i], value: yData[i] })
        }
      }
      peaks.sort((a, b) => b.value - a.value)
      targetWavelengths = peaks.slice(0, 3).map((p) => p.wavelength)

      // If no peaks found, use evenly spaced wavelengths
      if (targetWavelengths.length === 0) {
        const wl = firstResult.wavelengths
        targetWavelengths = [
          wl[Math.floor(wl.length * 0.25)],
          wl[Math.floor(wl.length * 0.5)],
          wl[Math.floor(wl.length * 0.75)],
        ]
      }
    }

    // Create traces for each wavelength of interest
    const traces: Plotly.Data[] = targetWavelengths.map((wavelength, idx) => {
      const yValues = sweepResults.map((result) => {
        // Find closest wavelength in results
        const wlIndex = result.wavelengths.reduce(
          (closest, wl, i) =>
            Math.abs(wl - wavelength) < Math.abs(result.wavelengths[closest] - wavelength)
              ? i
              : closest,
          0
        )
        const yData = result[yAxisField] || []
        return yData[wlIndex] ?? 0
      })

      return {
        x: xValues,
        y: yValues,
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        name: `λ = ${wavelength.toFixed(1)} nm`,
        line: { color: COLORS[idx % COLORS.length], width: 2 },
        marker: { size: 6 },
      }
    })

    return { traces, xValues, paramLabel }
  }, [sweepResults, sweepParam, wavelengthsOfInterest, yAxisField])

  if (sweepResults.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center text-muted-foreground">
        No sweep results to display
      </div>
    )
  }

  const yAxisLabels: Record<string, string> = {
    absorptance: 'Absorptance',
    reflectance: 'Reflectance',
    transmittance: 'Transmittance',
  }

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: title || `${yAxisLabels[yAxisField]} vs ${paramLabel}`,
      font: { color: darkMode ? '#e2e8f0' : '#1e293b' },
    },
    xaxis: {
      title: { text: paramLabel },
      color: darkMode ? '#94a3b8' : '#475569',
      gridcolor: darkMode ? '#334155' : '#e2e8f0',
    },
    yaxis: {
      title: { text: yAxisLabels[yAxisField] },
      range: [0, 1],
      color: darkMode ? '#94a3b8' : '#475569',
      gridcolor: darkMode ? '#334155' : '#e2e8f0',
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    legend: {
      font: { color: darkMode ? '#e2e8f0' : '#1e293b' },
      orientation: 'h',
      y: -0.2,
    },
    margin: { t: 50, r: 30, b: 80, l: 60 },
  }

  const config: Partial<Plotly.Config> = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: `${yAxisField}_vs_${sweepParam}`,
      height: 800,
      width: 1200,
      scale: 2,
    },
  }

  return (
    <div className="w-full h-[400px]">
      <Plot
        data={traces}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler
      />
    </div>
  )
}
