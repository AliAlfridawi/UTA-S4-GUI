"""
S4 Simulation module for photonic crystal slab simulations.
"""
from .models import (
    SimulationConfig,
    SweepConfig,
    SweepParameter,
    SimulationResult,
    FieldMapResult,
    ProgressUpdate,
    JobInfo,
    SimulationStatus,
    ExcitationConfig,
    WavelengthRange
)
from .s4_runner import (
    run_simulation,
    create_s4_simulation,
    compute_field_map,
    get_cpu_count
)
from .sweep import (
    run_sweep,
    generate_sweep_configs,
    create_job,
    run_job,
    get_job_status,
    get_job_results,
    cancel_job,
    estimate_sweep_time
)
from .database import (
    JobDatabase,
    get_job_database
)

__all__ = [
    # Models
    "SimulationConfig",
    "SweepConfig", 
    "SweepParameter",
    "SimulationResult",
    "FieldMapResult",
    "ProgressUpdate",
    "JobInfo",
    "SimulationStatus",
    "ExcitationConfig",
    "WavelengthRange",
    # Runners
    "run_simulation",
    "create_s4_simulation",
    "compute_field_map",
    "get_cpu_count",
    # Sweep
    "run_sweep",
    "generate_sweep_configs",
    "create_job",
    "run_job",
    "get_job_status",
    "get_job_results",
    "cancel_job",
    "estimate_sweep_time",
    # Database
    "JobDatabase",
    "get_job_database"
]
