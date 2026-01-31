"""
Parameter sweep engine for running multiple simulations in parallel.
"""
import numpy as np
from typing import List, Dict, Any, Optional, Generator
from concurrent.futures import ProcessPoolExecutor, as_completed
from itertools import product
import time
import uuid

from .models import (
    SimulationConfig,
    SweepConfig,
    SweepParameter,
    SimulationResult,
    ProgressUpdate,
    JobInfo,
    SimulationStatus
)
from .s4_runner import run_simulation, get_cpu_count


# In-memory job storage (for simplicity - could be Redis/SQLite for persistence)
_active_jobs: Dict[str, JobInfo] = {}
_job_results: Dict[str, List[SimulationResult]] = {}


def generate_sweep_configs(sweep_config: SweepConfig) -> Generator[SimulationConfig, None, None]:
    """
    Generate all simulation configurations from a sweep definition.
    
    Args:
        sweep_config: Sweep configuration with base config and sweep parameters
        
    Yields:
        Individual SimulationConfig for each parameter combination
    """
    base = sweep_config.base_config
    sweeps = sweep_config.sweeps
    
    if not sweeps:
        yield base
        return
    
    # Generate parameter ranges
    param_ranges = {}
    for sweep in sweeps:
        if sweep.step == 0:
            param_ranges[sweep.name] = [sweep.start]
        else:
            param_ranges[sweep.name] = np.linspace(
                sweep.start, 
                sweep.end, 
                sweep.num_points
            ).tolist()
    
    # Generate all combinations
    param_names = list(param_ranges.keys())
    param_values = [param_ranges[name] for name in param_names]
    
    for combo in product(*param_values):
        # Create copy of base config with updated parameters
        config_dict = base.model_dump()
        
        for name, value in zip(param_names, combo):
            # Map short names to full parameter names
            param_map = {
                'a': 'lattice_constant',
                'r': 'radius',
                't': 'thickness',
                'h': 'glass_thickness',
                'n': 'n_silicon',
                'k': 'k_silicon'
            }
            full_name = param_map.get(name, name)
            config_dict[full_name] = round(value, 6)
        
        yield SimulationConfig(**config_dict)


def run_single_config(config_dict: Dict[str, Any]) -> SimulationResult:
    """
    Run a single simulation configuration (for parallel execution).
    
    Args:
        config_dict: Serialized SimulationConfig
        
    Returns:
        SimulationResult
    """
    config = SimulationConfig(**config_dict)
    return run_simulation(config, num_workers=1)  # Single worker since we parallelize at config level


def run_sweep(
    sweep_config: SweepConfig,
    progress_callback: Optional[callable] = None,
    max_workers: Optional[int] = None
) -> List[SimulationResult]:
    """
    Run a parameter sweep with parallel execution.
    
    Args:
        sweep_config: Sweep configuration
        progress_callback: Optional callback for progress updates
        max_workers: Maximum parallel workers
        
    Returns:
        List of SimulationResult for each parameter combination
    """
    if max_workers is None:
        max_workers = get_cpu_count()
    
    # Generate all configurations
    configs = list(generate_sweep_configs(sweep_config))
    total = len(configs)
    
    if total == 0:
        return []
    
    # Serialize configs for parallel execution
    config_dicts = [c.model_dump() for c in configs]
    
    results = []
    completed = 0
    start_time = time.time()
    
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(run_single_config, config_dict): i 
            for i, config_dict in enumerate(config_dicts)
        }
        
        for future in as_completed(futures):
            idx = futures[future]
            try:
                result = future.result()
                results.append((idx, result))
            except Exception as e:
                # Log error but continue with other simulations
                print(f"Simulation {idx} failed: {e}")
                results.append((idx, None))
            
            completed += 1
            
            if progress_callback:
                elapsed = time.time() - start_time
                avg_time = elapsed / completed
                remaining = (total - completed) * avg_time
                
                progress_callback(ProgressUpdate(
                    current=completed,
                    total=total,
                    percent=100.0 * completed / total,
                    message=f"Completed {completed}/{total} simulations",
                    estimated_remaining_seconds=remaining
                ))
    
    # Sort by original index and extract results
    results.sort(key=lambda x: x[0])
    return [r[1] for r in results if r[1] is not None]


def create_job(sweep_config: SweepConfig) -> str:
    """
    Create a new sweep job and return its ID.
    
    Args:
        sweep_config: Sweep configuration
        
    Returns:
        Job ID string
    """
    job_id = str(uuid.uuid4())
    
    _active_jobs[job_id] = JobInfo(
        job_id=job_id,
        status=SimulationStatus.PENDING,
        progress=ProgressUpdate(
            current=0,
            total=sweep_config.total_simulations,
            percent=0.0,
            message="Job queued"
        )
    )
    
    return job_id


def run_job(job_id: str, sweep_config: SweepConfig) -> None:
    """
    Run a sweep job (called in background).
    
    Args:
        job_id: Job identifier
        sweep_config: Sweep configuration
    """
    def update_progress(progress: ProgressUpdate):
        if job_id in _active_jobs:
            _active_jobs[job_id].progress = progress
            _active_jobs[job_id].status = SimulationStatus.RUNNING
    
    try:
        _active_jobs[job_id].status = SimulationStatus.RUNNING
        
        results = run_sweep(sweep_config, progress_callback=update_progress)
        
        _job_results[job_id] = results
        _active_jobs[job_id].status = SimulationStatus.COMPLETED
        _active_jobs[job_id].progress.message = "Completed successfully"
        
    except Exception as e:
        _active_jobs[job_id].status = SimulationStatus.FAILED
        _active_jobs[job_id].error = str(e)


def get_job_status(job_id: str) -> Optional[JobInfo]:
    """Get the status of a job."""
    return _active_jobs.get(job_id)


def get_job_results(job_id: str) -> Optional[List[SimulationResult]]:
    """Get the results of a completed job."""
    return _job_results.get(job_id)


def cancel_job(job_id: str) -> bool:
    """
    Cancel a running job.
    
    Note: This doesn't actually stop running processes,
    but marks the job as cancelled.
    """
    if job_id in _active_jobs:
        _active_jobs[job_id].status = SimulationStatus.CANCELLED
        return True
    return False


def estimate_sweep_time(sweep_config: SweepConfig, time_per_wavelength: float = 0.01) -> float:
    """
    Estimate total sweep time in seconds.
    
    Args:
        sweep_config: Sweep configuration
        time_per_wavelength: Estimated time per wavelength point in seconds
        
    Returns:
        Estimated time in seconds
    """
    total_wavelengths = sweep_config.total_simulations
    num_workers = get_cpu_count()
    
    # Parallel speedup with some overhead
    parallel_factor = min(num_workers, total_wavelengths) * 0.7  # 70% efficiency
    
    return (total_wavelengths * time_per_wavelength) / max(1, parallel_factor)
