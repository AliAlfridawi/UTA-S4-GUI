"""
Pydantic models for S4 simulation requests and responses.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from enum import Enum


class MaterialType(str, Enum):
    VACUUM = "Vacuum"
    SILICON = "Silicon"
    GLASS = "Glass"
    GOLD = "Gold"
    CUSTOM = "Custom"


class Material(BaseModel):
    """Material definition with complex permittivity."""
    name: str
    epsilon_real: float = 1.0
    epsilon_imag: float = 0.0
    
    @property
    def epsilon(self) -> complex:
        return complex(self.epsilon_real, self.epsilon_imag)


class Layer(BaseModel):
    """Layer definition for the simulation stack."""
    name: str
    thickness: float = Field(ge=0, description="Layer thickness in µm")
    material: str
    has_pattern: bool = False
    pattern_material: Optional[str] = None
    pattern_type: Optional[Literal["circle", "rectangle"]] = "circle"
    pattern_center: tuple[float, float] = (0, 0)
    pattern_radius: Optional[float] = None  # For circles
    pattern_width: Optional[float] = None   # For rectangles
    pattern_height: Optional[float] = None  # For rectangles


class ExcitationConfig(BaseModel):
    """Plane wave excitation settings."""
    theta: float = Field(default=0, ge=0, le=90, description="Polar angle in degrees")
    phi: float = Field(default=0, ge=0, le=360, description="Azimuthal angle in degrees")
    s_amplitude: float = Field(default=0, description="s-polarization amplitude")
    p_amplitude: float = Field(default=1, description="p-polarization amplitude")


class WavelengthRange(BaseModel):
    """Wavelength range for simulation."""
    start: float = Field(default=800, gt=0, description="Start wavelength in nm")
    end: float = Field(default=1200, gt=0, description="End wavelength in nm")
    step: float = Field(default=1, gt=0, description="Wavelength step in nm")
    
    @property
    def num_points(self) -> int:
        return int(abs(self.end - self.start) / self.step) + 1


class SweepParameter(BaseModel):
    """Single parameter sweep definition."""
    name: Literal["a", "r", "t", "h", "n", "k"]
    start: float
    end: float
    step: float
    
    @property
    def num_points(self) -> int:
        if self.step == 0:
            return 1
        return int(abs(self.end - self.start) / self.step) + 1


class SimulationConfig(BaseModel):
    """Complete simulation configuration."""
    # Lattice parameters
    lattice_constant: float = Field(default=0.5, gt=0, alias="a", description="Lattice constant in µm")
    
    # PCS parameters
    radius: float = Field(default=0.15, gt=0, alias="r", description="Hole radius in µm")
    thickness: float = Field(default=0.16, gt=0, alias="t", description="PCS thickness in µm")
    glass_thickness: float = Field(default=3, ge=0, alias="h", description="Glass (BOX) thickness in µm")
    
    # Material properties
    n_silicon: float = Field(default=3.68, gt=0, alias="n", description="Silicon refractive index")
    k_silicon: float = Field(default=0, ge=0, alias="k", description="Silicon extinction coefficient")
    n_glass: float = Field(default=1.535, gt=0, description="Glass refractive index (SiO₂)")
    
    # Simulation settings
    num_basis: int = Field(default=32, ge=1, description="Number of Fourier basis terms")
    
    # Excitation
    excitation: ExcitationConfig = Field(default_factory=ExcitationConfig)
    
    # Wavelength range
    wavelength: WavelengthRange = Field(default_factory=WavelengthRange)
    
    # Output options
    compute_power: bool = True
    compute_fields: bool = True
    
    class Config:
        populate_by_name = True


class SweepConfig(BaseModel):
    """Configuration for parameter sweep."""
    base_config: SimulationConfig
    sweeps: List[SweepParameter] = Field(default_factory=list)
    
    @property
    def total_simulations(self) -> int:
        total = 1
        for sweep in self.sweeps:
            total *= sweep.num_points
        return total * self.base_config.wavelength.num_points


class SimulationResult(BaseModel):
    """Results from a single simulation run."""
    wavelengths: List[float]
    transmittance: Optional[List[float]] = None
    reflectance: Optional[List[float]] = None
    absorptance: Optional[List[float]] = None
    transmission_phase: Optional[List[float]] = None
    reflection_phase: Optional[List[float]] = None
    config: SimulationConfig
    

class FieldPoint(BaseModel):
    """Electric field at a point."""
    x: float
    y: float
    z: float
    Ex: complex
    Ey: complex
    Ez: complex


class FieldMapResult(BaseModel):
    """2D field map at a z-plane."""
    z_position: float
    x_points: List[float]
    y_points: List[float]
    Ex_real: List[List[float]]
    Ex_imag: List[List[float]]
    Ey_real: List[List[float]]
    Ey_imag: List[List[float]]
    Ez_real: List[List[float]]
    Ez_imag: List[List[float]]


class ProgressUpdate(BaseModel):
    """Progress update for long-running simulations."""
    current: int
    total: int
    percent: float
    message: str
    estimated_remaining_seconds: Optional[float] = None


class SimulationStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobInfo(BaseModel):
    """Information about a simulation job."""
    job_id: str
    status: SimulationStatus
    progress: Optional[ProgressUpdate] = None
    result: Optional[SimulationResult] = None
    error: Optional[str] = None
