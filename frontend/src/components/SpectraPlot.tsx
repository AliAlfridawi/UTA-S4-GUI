import Plot from 'react-plotly.js'
import { SimulationResult } from '@/lib/api'

interface SpectraPlotProps {
  result: SimulationResult
  showTransmittance?: boolean
  showReflectance?: boolean
  showAbsorptance?: boolean
  darkMode?: boolean
}

export default function SpectraPlot({
  result,
  showTransmittance = true,
  showReflectance = true,
  showAbsorptance = true,
  darkMode = true,
}: SpectraPlotProps) {
  const traces: Plotly.Data[] = []

  if (showTransmittance && result.transmittance) {
    traces.push({
      x: result.wavelengths,
      y: result.transmittance,
      type: 'scatter',
      mode: 'lines',
      name: 'Transmittance',
      line: { color: '#3b82f6', width: 2 },
    })
  }

  if (showReflectance && result.reflectance) {
    traces.push({
      x: result.wavelengths,
      y: result.reflectance,
      type: 'scatter',
      mode: 'lines',
      name: 'Reflectance',
      line: { color: '#ef4444', width: 2 },
    })
  }

  if (showAbsorptance && result.absorptance) {
    traces.push({
      x: result.wavelengths,
      y: result.absorptance,
      type: 'scatter',
      mode: 'lines',
      name: 'Absorptance',
      line: { color: '#22c55e', width: 2 },
    })
  }

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: 'Transmission / Reflection / Absorption Spectra',
      font: { color: darkMode ? '#e2e8f0' : '#1e293b' },
    },
    xaxis: {
      title: 'Wavelength (nm)',
      color: darkMode ? '#94a3b8' : '#475569',
      gridcolor: darkMode ? '#334155' : '#e2e8f0',
    },
    yaxis: {
      title: 'Value',
      range: [0, 1],
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
      filename: 'spectra_plot',
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
