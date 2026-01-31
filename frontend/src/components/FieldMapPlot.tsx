import { useState, useEffect, useRef } from 'react'
import Plot from 'react-plotly.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldMapResult } from '@/lib/api'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'

interface FieldMapPlotProps {
  fieldMaps: FieldMapResult[]
  component?: 'Ex' | 'Ey' | 'Ez' | 'magnitude'
  showReal?: boolean
  darkMode?: boolean
}

export default function FieldMapPlot({
  fieldMaps,
  component = 'Ex',
  showReal = true,
  darkMode = true,
}: FieldMapPlotProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [animationSpeed, setAnimationSpeed] = useState(500) // ms per frame
  const intervalRef = useRef<number | null>(null)

  const currentMap = fieldMaps[currentIndex]

  // Get field data based on component selection
  const getFieldData = (map: FieldMapResult): number[][] => {
    if (component === 'magnitude') {
      // Calculate magnitude: sqrt(Ex^2 + Ey^2 + Ez^2)
      return map.Ex_real.map((row, i) =>
        row.map((_, j) => {
          const ex = Math.sqrt(map.Ex_real[i][j] ** 2 + map.Ex_imag[i][j] ** 2)
          const ey = Math.sqrt(map.Ey_real[i][j] ** 2 + map.Ey_imag[i][j] ** 2)
          const ez = Math.sqrt(map.Ez_real[i][j] ** 2 + map.Ez_imag[i][j] ** 2)
          return Math.sqrt(ex ** 2 + ey ** 2 + ez ** 2)
        })
      )
    }

    const realMap: Record<string, number[][]> = {
      Ex: map.Ex_real,
      Ey: map.Ey_real,
      Ez: map.Ez_real,
    }

    const imagMap: Record<string, number[][]> = {
      Ex: map.Ex_imag,
      Ey: map.Ey_imag,
      Ez: map.Ez_imag,
    }

    return showReal ? realMap[component] : imagMap[component]
  }

  // Animation control
  useEffect(() => {
    if (isPlaying && fieldMaps.length > 1) {
      intervalRef.current = window.setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % fieldMaps.length)
      }, animationSpeed)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, fieldMaps.length, animationSpeed])

  if (!currentMap) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center text-muted-foreground">
        No field map data available
      </div>
    )
  }

  const fieldData = getFieldData(currentMap)

  const trace: Plotly.Data = {
    z: fieldData,
    x: currentMap.x_points,
    y: currentMap.y_points,
    type: 'heatmap',
    colorscale: 'RdBu',
    colorbar: {
      title: {
        text: component === 'magnitude' ? '|E|' : `${component} (${showReal ? 'Re' : 'Im'})`,
        font: { color: darkMode ? '#e2e8f0' : '#1e293b' },
      },
      tickfont: { color: darkMode ? '#94a3b8' : '#475569' },
    },
  }

  const layout: Partial<Plotly.Layout> = {
    title: {
      text: `Electric Field at z = ${currentMap.z_position.toFixed(3)} µm`,
      font: { color: darkMode ? '#e2e8f0' : '#1e293b' },
    },
    xaxis: {
      title: 'x (µm)',
      color: darkMode ? '#94a3b8' : '#475569',
    },
    yaxis: {
      title: 'y (µm)',
      color: darkMode ? '#94a3b8' : '#475569',
      scaleanchor: 'x',
      scaleratio: 1,
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    margin: { t: 50, r: 80, b: 50, l: 60 },
  }

  const config: Partial<Plotly.Config> = {
    responsive: true,
    displayModeBar: true,
    toImageButtonOptions: {
      format: 'png',
      filename: `field_map_z${currentMap.z_position}`,
      height: 800,
      width: 800,
      scale: 2,
    },
  }

  return (
    <div className="space-y-4">
      <div className="w-full h-[400px]">
        <Plot
          data={[trace]}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>

      {/* Animation Controls */}
      {fieldMaps.length > 1 && (
        <div className="flex items-center justify-center gap-4 p-4 bg-muted rounded-md">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentIndex(0)}
            disabled={currentIndex === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentIndex(fieldMaps.length - 1)}
            disabled={currentIndex === fieldMaps.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Frame: {currentIndex + 1} / {fieldMaps.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Speed (ms):</label>
            <Input
              type="number"
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(parseInt(e.target.value) || 500)}
              className="w-20"
              min={100}
              step={100}
            />
          </div>
        </div>
      )}

      {/* Component Selection */}
      <div className="flex items-center justify-center gap-2">
        {['Ex', 'Ey', 'Ez', 'magnitude'].map((comp) => (
          <Button
            key={comp}
            variant={component === comp ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              // This would need to be passed up to parent to change
              console.log('Select component:', comp)
            }}
          >
            {comp === 'magnitude' ? '|E|' : comp}
          </Button>
        ))}
      </div>
    </div>
  )
}
