"""
S4 simulation runner - wraps S4 library for photonic crystal slab simulations.
Optimized for parallel execution and performance.
"""
import S4
import numpy as np
from typing import Optional, Tuple, List, Dict, Any
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing
import os

from .models import (
    SimulationConfig, 
    SimulationResult, 
    FieldMapResult,
    WavelengthRange
)


def get_cpu_count() -> int:
    """Get available CPU cores for parallelization."""
    return multiprocessing.cpu_count()


def create_s4_simulation(config: SimulationConfig) -> "S4.Simulation":
    """
    Initialize S4 simulation object with materials and layers.
    
    Args:
        config: Simulation configuration
        
    Returns:
        Initialized S4 Simulation object
    """
    a = config.lattice_constant
    
    # Create simulation with square lattice
    S = S4.New(Lattice=((a, 0), (0, a)), NumBasis=config.num_basis)
    
    # Add materials
    S.AddMaterial(Name="Vacuum", Epsilon=1.0 + 0j)
    
    # Silicon with complex permittivity
    n, k = config.n_silicon, config.k_silicon
    eps_si = complex(n**2 - k**2, 2 * n * k)
    S.AddMaterial(Name="Silicon", Epsilon=eps_si)
    
    # Glass (SiO2)
    S.AddMaterial(Name="Glass", Epsilon=config.n_glass**2)
    
    # Gold (for reference simulations)
    S.AddMaterial(Name="Gold", Epsilon=-115.13 + 11.259j)
    
    # Define layer stack
    S.AddLayer(Name='AirAbove', Thickness=0.0, Material='Vacuum')
    S.AddLayer(Name='PCS', Thickness=config.thickness, Material='Silicon')
    S.SetRegionCircle(
        Layer='PCS', 
        Material="Vacuum", 
        Center=(0, 0), 
        Radius=config.radius
    )
    S.AddLayer(Name='BOX', Thickness=config.glass_thickness, Material='Glass')
    S.AddLayer(Name='Substrate', Thickness=0.0, Material='Glass')
    
    # Set excitation
    exc = config.excitation
    S.SetExcitationPlanewave(
        IncidenceAngles=(exc.theta, exc.phi),
        sAmplitude=complex(exc.s_amplitude, 0),
        pAmplitude=complex(exc.p_amplitude, 0),
        Order=0
    )
    
    return S


def run_single_wavelength(
    S: "S4.Simulation",
    wavelength: float,
    config: SimulationConfig,
    compute_power: bool = True,
    compute_fields: bool = True
) -> Dict[str, Any]:
    """
    Run simulation for a single wavelength.
    
    Args:
        S: S4 Simulation object
        wavelength: Wavelength in nm
        config: Simulation configuration
        compute_power: Whether to compute T/R/A
        compute_fields: Whether to compute E-fields
        
    Returns:
        Dictionary with results for this wavelength
    """
    freq = 1000.0 / wavelength  # Convert nm to frequency (1/µm)
    S.SetFrequency(freq)
    
    result = {"wavelength": wavelength}
    
    if compute_power:
        # Get power fluxes
        _, back_flux = S.GetPowerFlux("AirAbove", 0)
        forward_flux, _ = S.GetPowerFlux("Substrate", 0)
        
        R = abs(back_flux)
        T = abs(forward_flux)
        A = 1 - T - R
        
        result["T"] = T
        result["R"] = R
        result["A"] = A
    
    if compute_fields:
        t = config.thickness
        h = config.glass_thickness
        
        # Get fields for phase calculation
        tE, _ = S.GetFields(0, 0, t/2 + h + 10)  # Transmission
        rE, _ = S.GetFields(0, 0, t/2 - h - 10)  # Reflection
        
        result["tE"] = tE[0]  # x-component
        result["rE"] = rE[0]
    
    return result


def run_wavelength_chunk(args: Tuple) -> List[Dict[str, Any]]:
    """
    Run simulation for a chunk of wavelengths (for parallel execution).
    
    Args:
        args: Tuple of (config_dict, wavelengths)
        
    Returns:
        List of results for each wavelength
    """
    config_dict, wavelengths = args
    config = SimulationConfig(**config_dict)
    
    # Create S4 simulation once, reuse for all wavelengths
    S = create_s4_simulation(config)
    
    results = []
    for wvl in wavelengths:
        result = run_single_wavelength(
            S, wvl, config, 
            config.compute_power, 
            config.compute_fields
        )
        results.append(result)
    
    return results


def run_simulation(
    config: SimulationConfig,
    progress_callback: Optional[callable] = None,
    num_workers: Optional[int] = None
) -> SimulationResult:
    """
    Run full simulation with parallel wavelength sweep.
    
    Args:
        config: Simulation configuration
        progress_callback: Optional callback for progress updates
        num_workers: Number of parallel workers (default: CPU count)
        
    Returns:
        SimulationResult with all computed data
    """
    if num_workers is None:
        num_workers = get_cpu_count()
    
    wvl_range = config.wavelength
    wavelengths = np.linspace(
        wvl_range.start, 
        wvl_range.end, 
        wvl_range.num_points
    )
    
    # Split wavelengths into chunks for parallel processing
    chunk_size = max(1, len(wavelengths) // num_workers)
    chunks = [
        wavelengths[i:i + chunk_size].tolist()
        for i in range(0, len(wavelengths), chunk_size)
    ]
    
    # Prepare arguments for parallel execution
    config_dict = config.model_dump()
    args_list = [(config_dict, chunk) for chunk in chunks]
    
    # Run in parallel
    all_results = []
    completed = 0
    total = len(wavelengths)
    
    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        futures = [executor.submit(run_wavelength_chunk, args) for args in args_list]
        
        for future in as_completed(futures):
            chunk_results = future.result()
            all_results.extend(chunk_results)
            completed += len(chunk_results)
            
            if progress_callback:
                progress_callback(completed, total)
    
    # Sort by wavelength
    all_results.sort(key=lambda x: x["wavelength"])
    
    # Extract arrays
    wavelength_list = [r["wavelength"] for r in all_results]
    
    result = SimulationResult(
        wavelengths=wavelength_list,
        config=config
    )
    
    if config.compute_power:
        result.transmittance = [r["T"] for r in all_results]
        result.reflectance = [r["R"] for r in all_results]
        result.absorptance = [r["A"] for r in all_results]
    
    if config.compute_fields:
        # Calculate phases using reference simulation approach
        result.transmission_phase = calculate_phase(
            all_results, "transmission", config
        )
        result.reflection_phase = calculate_phase(
            all_results, "reflection", config
        )
    
    return result


def calculate_phase(
    results: List[Dict[str, Any]], 
    phase_type: str,
    config: SimulationConfig
) -> List[float]:
    """
    Calculate phase from E-field data.
    
    For accurate phase, we need reference simulations.
    This is a simplified version that returns the raw phase.
    """
    phases = []
    
    for r in results:
        if phase_type == "transmission":
            E = r.get("tE", complex(1, 0))
        else:
            E = r.get("rE", complex(1, 0))
        
        phase = np.angle(E) / np.pi  # Phase in units of π
        phases.append(float(phase))
    
    return phases


def run_reference_simulation(
    config: SimulationConfig,
    sim_type: str = "incident"
) -> Dict[str, List[complex]]:
    """
    Run incident or reference simulation for phase calibration.
    
    Args:
        config: Base simulation configuration
        sim_type: "incident" (vacuum only) or "reference" (with gold reflector)
        
    Returns:
        Dictionary with tE and rE field values for each wavelength
    """
    a = config.lattice_constant
    t = config.thickness
    h = config.glass_thickness
    
    S = S4.New(Lattice=((a, 0), (0, a)), NumBasis=config.num_basis)
    
    S.AddMaterial(Name="Vacuum", Epsilon=1.0 + 0j)
    S.AddMaterial(Name="Glass", Epsilon=config.n_glass**2)
    
    if sim_type == "incident":
        # All vacuum
        S.AddLayer(Name='AirAbove', Thickness=0.0, Material='Vacuum')
        S.AddLayer(Name='PCS', Thickness=t, Material='Vacuum')
        S.AddLayer(Name='BOX', Thickness=h, Material='Vacuum')
        S.AddLayer(Name='Substrate', Thickness=0.0, Material='Vacuum')
    else:
        # Reference with glass substrate
        S.AddMaterial(Name="Gold", Epsilon=-115.13 + 11.259j)
        S.AddLayer(Name='AirAbove', Thickness=0.0, Material='Vacuum')
        S.AddLayer(Name='PCS', Thickness=t, Material='Vacuum')
        S.AddLayer(Name='BOX', Thickness=h, Material='Glass')
        S.AddLayer(Name='Substrate', Thickness=0.0, Material='Glass')
    
    exc = config.excitation
    S.SetExcitationPlanewave(
        IncidenceAngles=(exc.theta, exc.phi),
        sAmplitude=complex(exc.s_amplitude, 0),
        pAmplitude=complex(exc.p_amplitude, 0),
        Order=0
    )
    
    wavelengths = np.linspace(
        config.wavelength.start,
        config.wavelength.end,
        config.wavelength.num_points
    )
    
    tE_values = []
    rE_values = []
    
    for wvl in wavelengths:
        freq = 1000.0 / wvl
        S.SetFrequency(freq)
        
        tE, _ = S.GetFields(0, 0, t/2 + h + 10)
        rE, _ = S.GetFields(0, 0, t/2 - h - 10)
        
        tE_values.append(tE[0])
        rE_values.append(rE[0])
    
    return {
        "wavelengths": wavelengths.tolist(),
        "tE": tE_values,
        "rE": rE_values
    }


def compute_field_map(
    config: SimulationConfig,
    wavelength: float,
    z_position: float,
    x_points: int = 50,
    y_points: int = 50
) -> FieldMapResult:
    """
    Compute 2D field map at a specific z-plane.
    
    Args:
        config: Simulation configuration
        wavelength: Wavelength in nm
        z_position: z-coordinate for the field map
        x_points: Number of x grid points
        y_points: Number of y grid points
        
    Returns:
        FieldMapResult with 2D field data
    """
    S = create_s4_simulation(config)
    
    freq = 1000.0 / wavelength
    S.SetFrequency(freq)
    
    a = config.lattice_constant
    x_vals = np.linspace(-a/2, a/2, x_points)
    y_vals = np.linspace(-a/2, a/2, y_points)
    
    Ex_real = []
    Ex_imag = []
    Ey_real = []
    Ey_imag = []
    Ez_real = []
    Ez_imag = []
    
    for y in y_vals:
        Ex_row_r, Ex_row_i = [], []
        Ey_row_r, Ey_row_i = [], []
        Ez_row_r, Ez_row_i = [], []
        
        for x in x_vals:
            E, _ = S.GetFields(x, y, z_position)
            
            Ex_row_r.append(E[0].real)
            Ex_row_i.append(E[0].imag)
            Ey_row_r.append(E[1].real)
            Ey_row_i.append(E[1].imag)
            Ez_row_r.append(E[2].real)
            Ez_row_i.append(E[2].imag)
        
        Ex_real.append(Ex_row_r)
        Ex_imag.append(Ex_row_i)
        Ey_real.append(Ey_row_r)
        Ey_imag.append(Ey_row_i)
        Ez_real.append(Ez_row_r)
        Ez_imag.append(Ez_row_i)
    
    return FieldMapResult(
        z_position=z_position,
        x_points=x_vals.tolist(),
        y_points=y_vals.tolist(),
        Ex_real=Ex_real,
        Ex_imag=Ex_imag,
        Ey_real=Ey_real,
        Ey_imag=Ey_imag,
        Ez_real=Ez_real,
        Ez_imag=Ez_imag
    )
