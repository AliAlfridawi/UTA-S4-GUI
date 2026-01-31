import Plot from 'react-plotly.js'
import { SimulationResult } from '@/lib/api'

interface PhasePlotProps {
  result: SimulationResult
  showTransmission?: boolean
  showReflection?: boolean
  darkMode?: boolean
}

export default function PhasePlot({
  result,
  showTransmission = true,
  showReflection = true,
  darkMode = true,
}: PhasePlotProps) {
  const traces: Plotly.Data[] = []

  if (showTransmission && result.transmission_phase) {
    traces.push({
      x: result.wavelengths,
      y: result.transmission_phase,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Transmission Phase',
      line: { color: '#8b5cf6', width: 2 },
      marker: { size: 4 },
    })
  }

  if (showReflection && result.reflection_phase) {
    traces.push({
      x: result.wavelengths,
      y: result.reflection_phase,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Reflection Phase',
      line: { color: '#f59e0b', width: 2 },
      marker: { size: 4 },
    })
  }

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: 'Phase Response',
      font: { color: darkMode ? '#e2e8f0' : '#1e293b' },
    },
    xaxis: {
      title: 'Wavelength (nm)',
      color: darkMode ? '#94a3b8' : '#475569',
      gridcolor: darkMode ? '#334155' : '#e2e8f0',
    },
    yaxis: {
      title: 'Phase (π)',
      range: [-1, 1],
      color: darkMode ? '#94a3b8' : '#475569',
      gridcolor: darkMode ? '#334155' : '#e2e8f0',
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    legend: {
      font: { color: darkMode ? '#e2e8f0' : '#1e293b' },
    },
    margin: { t: 50, r: 30, b: 50, l: 60 },
  }

  const config: Partial<Plotly.Config> = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'phase_plot',
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
