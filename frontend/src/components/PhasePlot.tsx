import { useState, useRef, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { SimulationResult } from '@/lib/api'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Edit2, Check, X, Download } from 'lucide-react'

interface PhasePlotProps {
  result: SimulationResult
  showTransmission?: boolean
  showReflection?: boolean
  darkMode?: boolean
  // New customization props
  title?: string
  onTitleChange?: (title: string) => void
  wavelengthMin?: number | null
  wavelengthMax?: number | null
  onWavelengthRangeChange?: (min: number | null, max: number | null) => void
  visibleTraces?: {
    transmissionPhase: boolean
    reflectionPhase: boolean
  }
  onVisibleTracesChange?: (traces: { transmissionPhase: boolean; reflectionPhase: boolean }) => void
  compact?: boolean
}

export default function PhasePlot({
  result,
  showTransmission = true,
  showReflection = true,
  darkMode = true,
  title = 'Phase Response',
  onTitleChange,
  wavelengthMin,
  wavelengthMax,
  onWavelengthRangeChange,
  visibleTraces,
  onVisibleTracesChange,
  compact = false,
}: PhasePlotProps) {
  // Use visibleTraces prop or fall back to individual show* props
  const effectiveVisible = visibleTraces ?? {
    transmissionPhase: showTransmission,
    reflectionPhase: showReflection,
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

  const handleTraceToggle = (trace: 'transmissionPhase' | 'reflectionPhase') => {
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
    a.download = `${traceName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const traces: Plotly.Data[] = []

  if (effectiveVisible.transmissionPhase && result.transmission_phase) {
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

  if (effectiveVisible.reflectionPhase && result.reflection_phase) {
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
      title: { text: 'Phase (π)' },
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
      filename: `phase_plot_${title.replace(/[^a-zA-Z0-9]/g, '_')}`,
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
                  checked={effectiveVisible.transmissionPhase}
                  onCheckedChange={() => handleTraceToggle('transmissionPhase')}
                  className="h-4 w-4"
                />
                <span className="text-violet-500">T Phase</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={effectiveVisible.reflectionPhase}
                  onCheckedChange={() => handleTraceToggle('reflectionPhase')}
                  className="h-4 w-4"
                />
                <span className="text-amber-500">R Phase</span>
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
            {effectiveVisible.transmissionPhase && result.transmission_phase && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => exportTrace('Transmission_Phase', result.transmission_phase)}
              >
                <Download className="h-3 w-3 mr-1" />T φ
              </Button>
            )}
            {effectiveVisible.reflectionPhase && result.reflection_phase && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => exportTrace('Reflection_Phase', result.reflection_phase)}
              >
                <Download className="h-3 w-3 mr-1" />R φ
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
