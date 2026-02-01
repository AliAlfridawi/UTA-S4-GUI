import { useState, useRef, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { SimulationResult } from '@/lib/api'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Edit2, Check, X, Download } from 'lucide-react'

interface SpectraPlotProps {
  result: SimulationResult
  showTransmittance?: boolean
  showReflectance?: boolean
  showAbsorptance?: boolean
  darkMode?: boolean
  // New customization props
  title?: string
  onTitleChange?: (title: string) => void
  wavelengthMin?: number | null
  wavelengthMax?: number | null
  onWavelengthRangeChange?: (min: number | null, max: number | null) => void
  visibleTraces?: {
    transmittance: boolean
    reflectance: boolean
    absorptance: boolean
  }
  onVisibleTracesChange?: (traces: { transmittance: boolean; reflectance: boolean; absorptance: boolean }) => void
  compact?: boolean
}

export default function SpectraPlot({
  result,
  showTransmittance = true,
  showReflectance = true,
  showAbsorptance = true,
  darkMode = true,
  title = 'Transmission / Reflection / Absorption Spectra',
  onTitleChange,
  wavelengthMin,
  wavelengthMax,
  onWavelengthRangeChange,
  visibleTraces,
  onVisibleTracesChange,
  compact = false,
}: SpectraPlotProps) {
  // Use visibleTraces prop or fall back to individual show* props
  const effectiveVisible = visibleTraces ?? {
    transmittance: showTransmittance,
    reflectance: showReflectance,
    absorptance: showAbsorptance,
  }

  // Editable title state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(title)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Wavelength range inputs
  const [minInput, setMinInput] = useState<string>(wavelengthMin?.toString() ?? '')
  const [maxInput, setMaxInput] = useState<string>(wavelengthMax?.toString() ?? '')

  useEffect(() => {
    setEditedTitle(title)
  }, [title])

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const handleTitleSubmit = () => {
    if (onTitleChange && editedTitle.trim()) {
      onTitleChange(editedTitle.trim())
    }
    setIsEditingTitle(false)
  }

  const handleTitleCancel = () => {
    setEditedTitle(title)
    setIsEditingTitle(false)
  }

  const handleWavelengthApply = () => {
    if (onWavelengthRangeChange) {
      const min = minInput ? parseFloat(minInput) : null
      const max = maxInput ? parseFloat(maxInput) : null
      onWavelengthRangeChange(min, max)
    }
  }

  const handleWavelengthReset = () => {
    setMinInput('')
    setMaxInput('')
    if (onWavelengthRangeChange) {
      onWavelengthRangeChange(null, null)
    }
  }

  const handleTraceToggle = (trace: 'transmittance' | 'reflectance' | 'absorptance') => {
    if (onVisibleTracesChange) {
      onVisibleTracesChange({
        ...effectiveVisible,
        [trace]: !effectiveVisible[trace],
      })
    }
  }

  // Export individual trace as CSV
  const exportTrace = (traceName: string, data: number[] | undefined) => {
    if (!data) return
    const csvContent = result.wavelengths.map((w, i) => `${w},${data[i]}`).join('\n')
    const blob = new Blob([`Wavelength (nm),${traceName}\n${csvContent}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${traceName.toLowerCase()}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const traces: Plotly.Data[] = []

  if (effectiveVisible.transmittance && result.transmittance) {
    traces.push({
      x: result.wavelengths,
      y: result.transmittance,
      type: 'scatter',
      mode: 'lines',
      name: 'Transmittance',
      line: { color: '#3b82f6', width: 2 },
    })
  }

  if (effectiveVisible.reflectance && result.reflectance) {
    traces.push({
      x: result.wavelengths,
      y: result.reflectance,
      type: 'scatter',
      mode: 'lines',
      name: 'Reflectance',
      line: { color: '#ef4444', width: 2 },
    })
  }

  if (effectiveVisible.absorptance && result.absorptance) {
    traces.push({
      x: result.wavelengths,
      y: result.absorptance,
      type: 'scatter',
      mode: 'lines',
      name: 'Absorptance',
      line: { color: '#22c55e', width: 2 },
    })
  }

  // Calculate xaxis range
  const xRange: [number, number] | undefined = 
    wavelengthMin != null && wavelengthMax != null 
      ? [wavelengthMin, wavelengthMax] 
      : undefined

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: title,
      font: { color: darkMode ? '#e2e8f0' : '#1e293b' },
    },
    xaxis: {
      title: { text: 'Wavelength (nm)' },
      color: darkMode ? '#94a3b8' : '#475569',
      gridcolor: darkMode ? '#334155' : '#e2e8f0',
      range: xRange,
    },
    yaxis: {
      title: { text: 'Value' },
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
      filename: `spectra_plot_${title.replace(/[^a-zA-Z0-9]/g, '_')}`,
      height: 800,
      width: 1200,
      scale: 2,
    },
  }

  return (
    <div className="space-y-3">
      {/* Controls - hidden in compact mode */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {/* Editable Title */}
          {onTitleChange && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Title:</span>
              {isEditingTitle ? (
                <div className="flex items-center gap-1">
                  <Input
                    ref={titleInputRef}
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSubmit()
                      if (e.key === 'Escape') handleTitleCancel()
                    }}
                    className="h-7 w-64"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleTitleSubmit}>
                    <Check className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleTitleCancel}>
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="flex items-center gap-1 hover:text-foreground text-muted-foreground"
                >
                  <span className="truncate max-w-xs">{title}</span>
                  <Edit2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Trace Toggles */}
          {onVisibleTracesChange && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={effectiveVisible.transmittance}
                  onCheckedChange={() => handleTraceToggle('transmittance')}
                  className="h-4 w-4"
                />
                <span className="text-blue-500">T</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={effectiveVisible.reflectance}
                  onCheckedChange={() => handleTraceToggle('reflectance')}
                  className="h-4 w-4"
                />
                <span className="text-red-500">R</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={effectiveVisible.absorptance}
                  onCheckedChange={() => handleTraceToggle('absorptance')}
                  className="h-4 w-4"
                />
                <span className="text-green-500">A</span>
              </label>
            </div>
          )}

          {/* Wavelength Range */}
          {onWavelengthRangeChange && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">λ:</span>
              <Input
                type="number"
                placeholder="Min"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                className="h-7 w-20"
              />
              <span>-</span>
              <Input
                type="number"
                placeholder="Max"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                className="h-7 w-20"
              />
              <Button variant="outline" size="sm" className="h-7" onClick={handleWavelengthApply}>
                Apply
              </Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={handleWavelengthReset}>
                Reset
              </Button>
            </div>
          )}

          {/* Export Individual Traces */}
          <div className="flex items-center gap-1 ml-auto">
            {effectiveVisible.transmittance && result.transmittance && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => exportTrace('Transmittance', result.transmittance)}
              >
                <Download className="h-3 w-3 mr-1" />T
              </Button>
            )}
            {effectiveVisible.reflectance && result.reflectance && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => exportTrace('Reflectance', result.reflectance)}
              >
                <Download className="h-3 w-3 mr-1" />R
              </Button>
            )}
            {effectiveVisible.absorptance && result.absorptance && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => exportTrace('Absorptance', result.absorptance)}
              >
                <Download className="h-3 w-3 mr-1" />A
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Plot */}
      <div className="w-full h-[400px]">
        <Plot
          data={traces}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  )
}
