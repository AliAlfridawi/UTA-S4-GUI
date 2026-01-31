import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SweepParameter } from '@/lib/api'
import { Plus, Trash2, Calculator } from 'lucide-react'

interface SweepConfigProps {
  sweeps: SweepParameter[]
  onChange: (sweeps: SweepParameter[]) => void
  disabled?: boolean
}

const parameterLabels: Record<SweepParameter['name'], string> = {
  a: 'Lattice Constant (a)',
  r: 'Radius (r)',
  t: 'Thickness (t)',
  h: 'Glass Thickness (h)',
  n: 'Silicon Index (n)',
  k: 'Extinction Coef. (k)',
}

const parameterUnits: Record<SweepParameter['name'], string> = {
  a: 'µm',
  r: 'µm',
  t: 'µm',
  h: 'µm',
  n: '',
  k: '',
}

const defaultValues: Record<SweepParameter['name'], { start: number; end: number; step: number }> = {
  a: { start: 0.4, end: 0.6, step: 0.05 },
  r: { start: 0.1, end: 0.2, step: 0.02 },
  t: { start: 0.1, end: 0.2, step: 0.02 },
  h: { start: 2, end: 4, step: 0.5 },
  n: { start: 3.4, end: 3.8, step: 0.1 },
  k: { start: 0, end: 0.1, step: 0.02 },
}

export default function SweepConfig({ sweeps, onChange, disabled }: SweepConfigProps) {
  const [selectedParam, setSelectedParam] = useState<SweepParameter['name']>('r')

  const usedParams = new Set(sweeps.map((s) => s.name))
  const availableParams = Object.keys(parameterLabels).filter(
    (p) => !usedParams.has(p as SweepParameter['name'])
  ) as SweepParameter['name'][]

  const addSweep = () => {
    if (availableParams.length === 0) return

    const param = availableParams[0]
    const defaults = defaultValues[param]
    
    onChange([
      ...sweeps,
      {
        name: param,
        start: defaults.start,
        end: defaults.end,
        step: defaults.step,
      },
    ])
  }

  const removeSweep = (index: number) => {
    onChange(sweeps.filter((_, i) => i !== index))
  }

  const updateSweep = (index: number, updates: Partial<SweepParameter>) => {
    onChange(
      sweeps.map((sweep, i) =>
        i === index ? { ...sweep, ...updates } : sweep
      )
    )
  }

  const calculateTotalPoints = () => {
    if (sweeps.length === 0) return 1
    return sweeps.reduce((total, sweep) => {
      const points = Math.floor(Math.abs(sweep.end - sweep.start) / sweep.step) + 1
      return total * points
    }, 1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Parameter Sweep
        </CardTitle>
        <CardDescription>
          Define parameter ranges to sweep over multiple configurations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sweeps.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No parameter sweeps defined.</p>
            <p className="text-sm">Click "Add Parameter" to create a sweep.</p>
          </div>
        )}

        {sweeps.map((sweep, index) => {
          const points = Math.floor(Math.abs(sweep.end - sweep.start) / sweep.step) + 1
          const unit = parameterUnits[sweep.name]
          
          return (
            <div
              key={index}
              className="p-4 border border-border rounded-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <select
                    value={sweep.name}
                    onChange={(e) =>
                      updateSweep(index, {
                        name: e.target.value as SweepParameter['name'],
                        ...defaultValues[e.target.value as SweepParameter['name']],
                      })
                    }
                    disabled={disabled}
                    className="bg-background border border-input rounded-md px-3 py-1 text-sm"
                  >
                    <option value={sweep.name}>{parameterLabels[sweep.name]}</option>
                    {availableParams.map((param) => (
                      <option key={param} value={param}>
                        {parameterLabels[param]}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-muted-foreground">
                    ({points} points)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSweep(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label={`Start${unit ? ` [${unit}]` : ''}`}
                  type="number"
                  step="0.01"
                  value={sweep.start}
                  onChange={(e) =>
                    updateSweep(index, { start: parseFloat(e.target.value) || 0 })
                  }
                  disabled={disabled}
                />
                <Input
                  label={`End${unit ? ` [${unit}]` : ''}`}
                  type="number"
                  step="0.01"
                  value={sweep.end}
                  onChange={(e) =>
                    updateSweep(index, { end: parseFloat(e.target.value) || 0 })
                  }
                  disabled={disabled}
                />
                <Input
                  label="Step"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={sweep.step}
                  onChange={(e) =>
                    updateSweep(index, { step: parseFloat(e.target.value) || 0.01 })
                  }
                  disabled={disabled}
                />
              </div>
            </div>
          )
        })}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={addSweep}
            disabled={disabled || availableParams.length === 0}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Parameter
          </Button>

          {sweeps.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <strong>Total configurations:</strong> {calculateTotalPoints()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
