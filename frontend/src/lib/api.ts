/**
 * API client for S4 Simulation backend
 */

const API_BASE = 'http://localhost:8000';

// Types matching backend models
export interface ExcitationConfig {
  theta: number;
  phi: number;
  s_amplitude: number;
  p_amplitude: number;
}

export interface WavelengthRange {
  start: number;
  end: number;
  step: number;
}

export interface SimulationConfig {
  lattice_constant: number;
  radius: number;
  thickness: number;
  glass_thickness: number;
  n_silicon: number;
  k_silicon: number;
  n_glass: number;
  num_basis: number;
  excitation: ExcitationConfig;
  wavelength: WavelengthRange;
  compute_power: boolean;
  compute_fields: boolean;
}

export interface SweepParameter {
  name: 'a' | 'r' | 't' | 'h' | 'n' | 'k';
  start: number;
  end: number;
  step: number;
}

export interface SweepConfig {
  base_config: SimulationConfig;
  sweeps: SweepParameter[];
}

export interface SimulationResult {
  wavelengths: number[];
  transmittance?: number[];
  reflectance?: number[];
  absorptance?: number[];
  transmission_phase?: number[];
  reflection_phase?: number[];
  config: SimulationConfig;
}

export interface FieldMapResult {
  z_position: number;
  x_points: number[];
  y_points: number[];
  Ex_real: number[][];
  Ex_imag: number[][];
  Ey_real: number[][];
  Ey_imag: number[][];
  Ez_real: number[][];
  Ez_imag: number[][];
}

export interface ProgressUpdate {
  current: number;
  total: number;
  percent: number;
  message: string;
  estimated_remaining_seconds?: number;
}

export interface JobInfo {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: ProgressUpdate;
  error?: string;
}

export interface SavedConfig {
  name: string;
  path: string;
  modified: string;
  size: number;
}

// Default configuration
export const defaultConfig: SimulationConfig = {
  lattice_constant: 0.5,
  radius: 0.15,
  thickness: 0.16,
  glass_thickness: 3.0,
  n_silicon: 3.68,
  k_silicon: 0,
  n_glass: 1.535,
  num_basis: 32,
  excitation: {
    theta: 0,
    phi: 0,
    s_amplitude: 0,
    p_amplitude: 1,
  },
  wavelength: {
    start: 800,
    end: 1200,
    step: 1,
  },
  compute_power: true,
  compute_fields: true,
};

// API Functions
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Health & Info
export async function checkHealth(): Promise<{ status: string; cpu_count: number }> {
  return fetchJson('/health');
}

export async function getSystemInfo(): Promise<{
  cpu_count: number;
  data_dir: string;
  configs_dir: string;
}> {
  return fetchJson('/info');
}

// Simulation
export async function runSimulation(config: SimulationConfig): Promise<SimulationResult> {
  return fetchJson('/simulate', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function previewSimulation(config: SimulationConfig): Promise<{
  num_wavelengths: number;
  wavelength_range: WavelengthRange;
  estimated_time_seconds: number;
  cpu_count: number;
}> {
  return fetchJson('/simulate/preview', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function getFieldMap(
  config: SimulationConfig,
  wavelength: number,
  z_position: number,
  x_points = 50,
  y_points = 50
): Promise<FieldMapResult> {
  return fetchJson(
    `/field-map?wavelength=${wavelength}&z_position=${z_position}&x_points=${x_points}&y_points=${y_points}`,
    {
      method: 'POST',
      body: JSON.stringify(config),
    }
  );
}

// Sweep
export async function previewSweep(sweepConfig: SweepConfig): Promise<{
  total_simulations: number;
  total_wavelength_points: number;
  estimated_time_seconds: number;
  sweeps: Array<{
    parameter: string;
    start: number;
    end: number;
    step: number;
    num_points: number;
  }>;
}> {
  return fetchJson('/sweep/preview', {
    method: 'POST',
    body: JSON.stringify(sweepConfig),
  });
}

export async function startSweep(sweepConfig: SweepConfig): Promise<{
  job_id: string;
  status: string;
  message: string;
}> {
  return fetchJson('/sweep/start', {
    method: 'POST',
    body: JSON.stringify(sweepConfig),
  });
}

export async function getSweepStatus(jobId: string): Promise<JobInfo> {
  return fetchJson(`/sweep/status/${jobId}`);
}

export async function getSweepResults(jobId: string): Promise<{
  job_id: string;
  results: SimulationResult[];
}> {
  return fetchJson(`/sweep/results/${jobId}`);
}

export async function cancelSweep(jobId: string): Promise<{ job_id: string; status: string }> {
  return fetchJson(`/sweep/cancel/${jobId}`, { method: 'POST' });
}

// Configurations
export async function listConfigs(): Promise<{ configs: SavedConfig[] }> {
  return fetchJson('/configs');
}

export async function saveConfig(
  config: SimulationConfig,
  name?: string
): Promise<{ message: string; path: string }> {
  const url = name ? `/configs/save?name=${encodeURIComponent(name)}` : '/configs/save';
  return fetchJson(url, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function loadConfig(name: string): Promise<SimulationConfig> {
  return fetchJson(`/configs/load/${encodeURIComponent(name)}`);
}

export async function deleteConfig(name: string): Promise<{ message: string; name: string }> {
  return fetchJson(`/configs/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// Results
export async function listResults(): Promise<{ results: SavedConfig[] }> {
  return fetchJson('/results');
}

export async function saveResults(
  result: SimulationResult,
  format: 'json' | 'csv' = 'json'
): Promise<{ message: string; path?: string; files?: Record<string, string> }> {
  return fetchJson(`/results/save?format=${format}`, {
    method: 'POST',
    body: JSON.stringify(result),
  });
}

export async function loadResults(name: string): Promise<SimulationResult> {
  return fetchJson(`/results/load/${encodeURIComponent(name)}`);
}

export function getDownloadUrl(name: string, format: 'json' | 'csv' = 'json'): string {
  return `${API_BASE}/results/download/${encodeURIComponent(name)}?format=${format}`;
}

// WebSocket for progress
export function connectToProgress(
  jobId: string,
  onUpdate: (info: JobInfo) => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): WebSocket {
  const ws = new WebSocket(`ws://localhost:8000/ws/progress/${jobId}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onUpdate(data);
  };

  ws.onerror = (error) => {
    if (onError) onError(error);
  };

  ws.onclose = () => {
    if (onClose) onClose();
  };

  return ws;
}
