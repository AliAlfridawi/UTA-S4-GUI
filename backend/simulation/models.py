"""
Pydantic models for S4 simulation requests and responses.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Tuple
from typing_extensions import Literal
from enum import Enum
import math


class MaterialType(str, Enum):
    VACUUM = "Vacuum"
    SILICON = "Silicon"
    GLASS = "Glass"
    GOLD = "Gold"
    PMMA = "PMMA"
    GRAPHENE = "Graphene"
    GAAS = "GaAs"
    SILICON_SUBSTRATE = "SiliconSubstrate"
    CUSTOM = "Custom"


# Physical constants for Drude model
SPEED_OF_LIGHT = 299792458  # m/s
HBAR_EV = 6.582119569e-16  # eV·s


class DrudeParameters(BaseModel):
    """Drude model parameters for metallic materials."""
    plasma_frequency_ev: float = Field(
        default=9.02,
        description="Plasma frequency in eV (ωp)"
    )
    damping_ev: float = Field(
        default=0.027,
        description="Damping/collision frequency in eV (γ)"
    )
    epsilon_inf: float = Field(
        default=1.0,
        description="High-frequency dielectric constant (ε∞)"
    )


def drude_permittivity(wavelength_nm: float, params: DrudeParameters) -> complex:
    """
    Calculate permittivity using the Drude model.
    
    ε(ω) = ε∞ - ωp² / (ω² + iγω)
    
    Args:
        wavelength_nm: Wavelength in nanometers
        params: Drude model parameters
    
    Returns:
        Complex permittivity
    """
    # Convert wavelength to angular frequency (rad/s)
    wavelength_m = wavelength_nm * 1e-9
    omega = 2 * math.pi * SPEED_OF_LIGHT / wavelength_m
    
    # Convert eV to rad/s
    omega_p = params.plasma_frequency_ev / HBAR_EV
    gamma = params.damping_ev / HBAR_EV
    
    # Drude model
    epsilon = params.epsilon_inf - (omega_p ** 2) / (omega ** 2 + 1j * gamma * omega)
    return epsilon


# Predefined materials with their properties
MATERIAL_DATABASE = {
    MaterialType.VACUUM: {
        "epsilon_real": 1.0,
        "epsilon_imag": 0.0,
        "description": "Free space / Air",
    },
    MaterialType.SILICON: {
        "n": 3.48,
        "k": 0.0,
        "description": "Crystalline Silicon at 1550nm",
    },
    MaterialType.GLASS: {
        "n": 1.535,
        "k": 0.0,
        "description": "Fused Silica (SiO₂)",
    },
    MaterialType.PMMA: {
        "n": 1.49,
        "k": 0.0,
        "description": "Poly(methyl methacrylate)",
    },
    MaterialType.GAAS: {
        "n": 3.59,
        "k": 0.0,
        "description": "Gallium Arsenide",
    },
    MaterialType.SILICON_SUBSTRATE: {
        "n": 3.42,
        "k": 0.0,
        "description": "Silicon substrate (bulk)",
    },
    MaterialType.GOLD: {
        "drude": DrudeParameters(
            plasma_frequency_ev=9.02,
            damping_ev=0.027,
            epsilon_inf=1.0
        ),
        "description": "Gold (Drude model)",
    },
    MaterialType.GRAPHENE: {
        # Approximate optical properties - simplified model
        "n": 2.6,
        "k": 1.3,
        "description": "Graphene (simplified optical model)",
    },
}


class Material(BaseModel):
    """Material definition with complex permittivity."""
    name: str
    epsilon_real: float = 1.0
    epsilon_imag: float = 0.0
    
    # Optional Drude model parameters for wavelength-dependent metals
    use_drude: bool = False
    drude_params: Optional[DrudeParameters] = None
    
    @property
    def epsilon(self) -> complex:
        return complex(self.epsilon_real, self.epsilon_imag)
    
    def get_epsilon_at_wavelength(self, wavelength_nm: float) -> complex:
        """Get permittivity, optionally using Drude model."""
        if self.use_drude and self.drude_params:
            return drude_permittivity(wavelength_nm, self.drude_params)
        return self.epsilon


class LayerDefinition(BaseModel):
    """Enhanced layer definition for advanced multi-layer structures."""
    name: str = Field(description="Layer identifier")
    material: MaterialType = Field(description="Material type")
    thickness: float = Field(ge=0, description="Layer thickness in µm")
    
    # Optical properties - n, k can override material defaults
    n: Optional[float] = Field(
        default=None,
        description="Refractive index override"
    )
    k: Optional[float] = Field(
        default=None,
        description="Extinction coefficient override"
    )
    # Epsilon overrides (computed from n,k if not set directly)
    epsilon_real: Optional[float] = Field(
        default=None,
        description="Real part of permittivity override"
    )
    epsilon_imag: Optional[float] = Field(
        default=None,
        description="Imaginary part of permittivity override"
    )
    
    # Pattern options
    has_pattern: bool = Field(default=False, description="Whether layer has patterning")
    pattern_type: Optional[Literal["circle", "rectangle", "hexagonal"]] = Field(
        default="circle",
        description="Type of pattern lattice arrangement"
    )
    hole_shape: Optional[Literal["circle", "rectangle", "ellipse"]] = Field(
        default="circle",
        description="Shape of holes in the pattern"
    )
    pattern_material: Optional[MaterialType] = Field(
        default=None,
        description="Material filling the pattern holes"
    )
    pattern_radius: Optional[float] = Field(
        default=None,
        description="Pattern radius in µm (for circles)"
    )
    pattern_width: Optional[float] = Field(
        default=None,
        description="Pattern width in µm (for rectangles)"
    )
    pattern_height: Optional[float] = Field(
        default=None,
        description="Pattern height in µm (for rectangles)"
    )
    pattern_fill_factor: Optional[float] = Field(
        default=None,
        ge=0,
        le=1,
        description="Fill factor for pattern (0-1)"
    )
    
    # Legacy custom overrides (kept for backward compatibility)
    custom_n: Optional[float] = Field(
        default=None,
        description="Deprecated: Use 'n' instead"
    )
    custom_k: Optional[float] = Field(
        default=None,
        description="Deprecated: Use 'k' instead"
    )
    
    # Ordering for drag-and-drop
    order: int = Field(default=0, description="Layer order in stack (0 = top)")
    
    def get_effective_n(self) -> float:
        """Get effective refractive index (override or material default)."""
        if self.n is not None:
            return self.n
        if self.custom_n is not None:
            return self.custom_n
        # Fall back to material database
        mat_data = MATERIAL_DATABASE.get(self.material, {})
        return mat_data.get("n", 1.0)
    
    def get_effective_k(self) -> float:
        """Get effective extinction coefficient (override or material default)."""
        if self.k is not None:
            return self.k
        if self.custom_k is not None:
            return self.custom_k
        # Fall back to material database
        mat_data = MATERIAL_DATABASE.get(self.material, {})
        return mat_data.get("k", 0.0)
    
    def get_epsilon(self) -> complex:
        """Get complex permittivity for this layer."""
        if self.epsilon_real is not None:
            imag = self.epsilon_imag if self.epsilon_imag is not None else 0.0
            return complex(self.epsilon_real, imag)
        # Compute from n and k: ε = (n + ik)² = n² - k² + 2nki
        n = self.get_effective_n()
        k = self.get_effective_k()
        return complex(n**2 - k**2, 2 * n * k)


class AdvancedLayerStack(BaseModel):
    """
    Complete layer stack configuration for advanced simulations.
    Supports structures like: PMMA → Graphene → Si-PCS → Glass → Gold reflector
    """
    # Global lattice parameter
    lattice_constant: float = Field(
        default=0.5,
        gt=0,
        description="Lattice constant (a) in µm"
    )
    
    layers: List[LayerDefinition] = Field(
        default_factory=list,
        description="Ordered list of layers (top to bottom)"
    )
    superstrate: MaterialType = Field(
        default=MaterialType.VACUUM,
        description="Material above the structure"
    )
    substrate: MaterialType = Field(
        default=MaterialType.GLASS,
        description="Material below the structure"
    )
    include_back_reflector: bool = Field(
        default=False,
        description="Add metallic back reflector"
    )
    back_reflector_material: MaterialType = Field(
        default=MaterialType.GOLD,
        description="Material for back reflector"
    )
    back_reflector_thickness: float = Field(
        default=0.1,
        ge=0,
        description="Back reflector thickness in µm"
    )
    
    def get_ordered_layers(self) -> List[LayerDefinition]:
        """Return layers sorted by order (top to bottom)."""
        return sorted(self.layers, key=lambda l: l.order)


# Preset layer configurations for common structures
LAYER_PRESETS = {
    "basic_pcs": {
        "name": "Basic PCS",
        "description": "Simple photonic crystal slab on glass",
        "layers": [
            LayerDefinition(
                name="PCS",
                material=MaterialType.SILICON,
                thickness=0.16,
                has_pattern=True,
                pattern_type="circle",
                pattern_material=MaterialType.VACUUM,
                order=0
            ),
        ],
        "substrate": MaterialType.GLASS,
        "superstrate": MaterialType.VACUUM,
    },
    "design_005": {
        "name": "Design 005",
        "description": "PMMA/Graphene/Si-PCS/SiO2 structure",
        "layers": [
            LayerDefinition(
                name="PMMA",
                material=MaterialType.PMMA,
                thickness=0.05,
                order=0
            ),
            LayerDefinition(
                name="Graphene",
                material=MaterialType.GRAPHENE,
                thickness=0.00034,  # ~0.34nm monolayer
                order=1
            ),
            LayerDefinition(
                name="Si-PCS",
                material=MaterialType.SILICON,
                thickness=0.16,
                has_pattern=True,
                pattern_type="circle",
                pattern_material=MaterialType.VACUUM,
                order=2
            ),
        ],
        "substrate": MaterialType.GLASS,
        "superstrate": MaterialType.VACUUM,
    },
    "design_007": {
        "name": "Design 007 (with reflector)",
        "description": "PCS with gold back reflector",
        "layers": [
            LayerDefinition(
                name="Si-PCS",
                material=MaterialType.SILICON,
                thickness=0.16,
                has_pattern=True,
                pattern_type="circle",
                pattern_material=MaterialType.VACUUM,
                order=0
            ),
            LayerDefinition(
                name="SiO2 Spacer",
                material=MaterialType.GLASS,
                thickness=0.5,
                order=1
            ),
        ],
        "substrate": MaterialType.GLASS,
        "superstrate": MaterialType.VACUUM,
        "include_back_reflector": True,
        "back_reflector_material": MaterialType.GOLD,
        "back_reflector_thickness": 0.1,
    },
}


class Layer(BaseModel):
    """Layer definition for the simulation stack."""
    name: str
    thickness: float = Field(ge=0, description="Layer thickness in µm")
    material: str
    has_pattern: bool = False
    pattern_material: Optional[str] = None
    pattern_type: Optional[Literal["circle", "rectangle"]] = "circle"
    pattern_center: Tuple[float, float] = (0, 0)
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
    
    # Advanced layer stack (optional - overrides basic PCS parameters if provided)
    use_advanced_stack: bool = Field(
        default=False,
        description="Use advanced multi-layer stack instead of basic PCS"
    )
    layer_stack: Optional[AdvancedLayerStack] = Field(
        default=None,
        description="Advanced layer stack configuration"
    )
    layer_preset: Optional[str] = Field(
        default=None,
        description="Name of preset layer configuration to use"
    )
    
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
    
    class Config:
        arbitrary_types_allowed = True


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
