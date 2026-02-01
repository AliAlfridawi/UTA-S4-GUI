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
    WavelengthRange,
    AdvancedLayerStack,
    LayerDefinition,
    MaterialType,
    MATERIAL_DATABASE
)
from .s4_runner import (
    run_simulation,
    create_s4_simulation,
    compute_field_map,
    get_cpu_count,
    create_advanced_simulation,
    run_advanced_simulation,
    get_material_epsilon
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
    "AdvancedLayerStack",
    "LayerDefinition",
    "MaterialType",
    "MATERIAL_DATABASE",
    # Runners
    "run_simulation",
    "create_s4_simulation",
    "compute_field_map",
    "get_cpu_count",
    "create_advanced_simulation",
    "run_advanced_simulation",
    "get_material_epsilon",
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
