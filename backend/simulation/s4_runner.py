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
    WavelengthRange,
    AdvancedLayerStack,
    LayerDefinition,
    MaterialType,
    MATERIAL_DATABASE,
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


def get_material_epsilon(material: MaterialType, n_override: float = None, k_override: float = None) -> complex:
    """
    Get complex permittivity for a material.
    
    Args:
        material: MaterialType enum value
        n_override: Optional refractive index override
        k_override: Optional extinction coefficient override
        
    Returns:
        Complex permittivity
    """
    mat_data = MATERIAL_DATABASE.get(material, {})
    
    # Check for Drude model materials (like Gold)
    if "drude" in mat_data and n_override is None:
        # For Drude materials, return a placeholder - actual value computed per-wavelength
        return complex(-100, 10)  # Typical metallic value
    
    n = n_override if n_override is not None else mat_data.get("n", 1.0)
    k = k_override if k_override is not None else mat_data.get("k", 0.0)
    
    # ε = (n + ik)² = n² - k² + 2nki
    return complex(n**2 - k**2, 2 * n * k)


def create_advanced_simulation(
    layer_stack: AdvancedLayerStack,
    excitation_theta: float = 0,
    excitation_phi: float = 0,
    s_amplitude: float = 0,
    p_amplitude: float = 1,
    num_basis: int = 100
) -> "S4.Simulation":
    """
    Create S4 simulation from an advanced LayerStackConfig.
    
    This function processes the full layer stack including:
    - Global lattice constant and type (square, hexagonal, rectangular)
    - Per-layer optical properties (n, k, epsilon)
    - Different hole shapes (circle, rectangle, ellipse)
    - Multiple patterned layers
    - Back reflector configuration
    
    Args:
        layer_stack: Complete layer stack configuration
        excitation_theta: Polar angle in degrees
        excitation_phi: Azimuthal angle in degrees
        s_amplitude: s-polarization amplitude
        p_amplitude: p-polarization amplitude
        num_basis: Number of Fourier basis terms
        
    Returns:
        Configured S4 Simulation object
    """
    import math
    
    a = layer_stack.lattice_constant
    b = layer_stack.lattice_constant_b if layer_stack.lattice_constant_b else a
    lattice_type = layer_stack.lattice_type or "square"
    
    # Create lattice based on type
    if lattice_type == "hexagonal":
        # Hexagonal lattice: 60° angle between basis vectors
        lattice = ((a, 0), (a / 2, a * math.sqrt(3) / 2))
    elif lattice_type == "rectangular":
        # Rectangular lattice: independent a and b
        lattice = ((a, 0), (0, b))
    else:
        # Square lattice (default)
        lattice = ((a, 0), (0, a))
    
    S = S4.New(Lattice=lattice, NumBasis=num_basis)
    
    # Track materials we've added to avoid duplicates
    added_materials = set()
    
    def add_material_if_needed(name: str, epsilon: complex):
        """Helper to add material only once."""
        if name not in added_materials:
            S.AddMaterial(Name=name, Epsilon=epsilon)
            added_materials.add(name)
    
    # Always add vacuum
    add_material_if_needed("Vacuum", complex(1.0, 0))
    
    # Add superstrate material
    superstrate_eps = get_material_epsilon(layer_stack.superstrate)
    superstrate_name = layer_stack.superstrate.value
    add_material_if_needed(superstrate_name, superstrate_eps)
    
    # Add substrate material
    substrate_eps = get_material_epsilon(layer_stack.substrate)
    substrate_name = layer_stack.substrate.value
    add_material_if_needed(substrate_name, substrate_eps)
    
    # Add back reflector material if needed
    if layer_stack.include_back_reflector:
        reflector_eps = get_material_epsilon(layer_stack.back_reflector_material)
        reflector_name = layer_stack.back_reflector_material.value
        add_material_if_needed(reflector_name, reflector_eps)
    
    # Process layers and add their materials
    ordered_layers = layer_stack.get_ordered_layers()
    
    for layer in ordered_layers:
        # Get layer material epsilon (with possible overrides)
        layer_eps = layer.get_epsilon()
        layer_mat_name = f"{layer.name}_mat"
        add_material_if_needed(layer_mat_name, layer_eps)
        
        # If layer has pattern, add pattern material
        if layer.has_pattern and layer.pattern_material:
            pattern_eps = get_material_epsilon(layer.pattern_material)
            pattern_mat_name = layer.pattern_material.value
            add_material_if_needed(pattern_mat_name, pattern_eps)
    
    # Build layer stack: Superstrate (semi-infinite) -> Layers -> Substrate
    S.AddLayer(Name='Superstrate', Thickness=0.0, Material=superstrate_name)
    
    # Add each layer in order
    for i, layer in enumerate(ordered_layers):
        layer_name = f"Layer_{i}_{layer.name}"
        layer_mat_name = f"{layer.name}_mat"
        
        S.AddLayer(Name=layer_name, Thickness=layer.thickness, Material=layer_mat_name)
        
        # Add pattern if present
        if layer.has_pattern and layer.pattern_material:
            pattern_mat_name = layer.pattern_material.value
            hole_shape = layer.hole_shape or "circle"
            
            if hole_shape == "circle":
                radius = layer.pattern_radius or 0.15
                S.SetRegionCircle(
                    Layer=layer_name,
                    Material=pattern_mat_name,
                    Center=(0, 0),
                    Radius=radius
                )
            elif hole_shape == "rectangle":
                # For rectangles, use SetRegionRectangle
                width = layer.pattern_width or 0.2
                height = layer.pattern_height or 0.2
                S.SetRegionRectangle(
                    Layer=layer_name,
                    Material=pattern_mat_name,
                    Center=(0, 0),
                    Angle=0,
                    Halfwidths=(width / 2, height / 2)
                )
            elif hole_shape == "ellipse":
                # S4 uses SetRegionEllipse for ellipses
                semi_major = layer.pattern_width or 0.15
                semi_minor = layer.pattern_height or 0.1
                S.SetRegionEllipse(
                    Layer=layer_name,
                    Material=pattern_mat_name,
                    Center=(0, 0),
                    Angle=0,
                    Halfwidths=(semi_major, semi_minor)
                )
    
    # Add substrate layer
    S.AddLayer(Name='Substrate', Thickness=3.0, Material=substrate_name)
    
    # Add back reflector if configured
    if layer_stack.include_back_reflector:
        reflector_name = layer_stack.back_reflector_material.value
        S.AddLayer(
            Name='BackReflector',
            Thickness=layer_stack.back_reflector_thickness,
            Material=reflector_name
        )
        # Add final semi-infinite layer below reflector
        S.AddLayer(Name='Below', Thickness=0.0, Material=substrate_name)
    
    # Set excitation
    S.SetExcitationPlanewave(
        IncidenceAngles=(excitation_theta, excitation_phi),
        sAmplitude=complex(s_amplitude, 0),
        pAmplitude=complex(p_amplitude, 0),
        Order=0
    )
    
    return S


def run_advanced_simulation(
    layer_stack: AdvancedLayerStack,
    wavelength_range: WavelengthRange,
    excitation_theta: float = 0,
    excitation_phi: float = 0,
    s_amplitude: float = 0,
    p_amplitude: float = 1,
    num_basis: int = 100,
    compute_power: bool = True,
    compute_fields: bool = True,
    progress_callback: Optional[callable] = None,
    num_workers: Optional[int] = None
) -> SimulationResult:
    """
    Run simulation with advanced layer stack configuration.
    
    Args:
        layer_stack: Complete layer stack configuration
        wavelength_range: Wavelength sweep range
        excitation_theta: Polar angle in degrees
        excitation_phi: Azimuthal angle in degrees
        s_amplitude: s-polarization amplitude
        p_amplitude: p-polarization amplitude
        num_basis: Number of Fourier basis terms
        compute_power: Whether to compute T/R/A
        compute_fields: Whether to compute E-fields
        progress_callback: Optional progress callback
        num_workers: Number of parallel workers
        
    Returns:
        SimulationResult with computed spectra
    """
    if num_workers is None:
        num_workers = get_cpu_count()
    
    wavelengths = np.linspace(
        wavelength_range.start,
        wavelength_range.end,
        wavelength_range.num_points
    )
    
    # Create the simulation
    S = create_advanced_simulation(
        layer_stack,
        excitation_theta=excitation_theta,
        excitation_phi=excitation_phi,
        s_amplitude=s_amplitude,
        p_amplitude=p_amplitude,
        num_basis=num_basis
    )
    
    # Run wavelength sweep
    all_results = []
    total = len(wavelengths)
    
    for i, wvl in enumerate(wavelengths):
        freq = 1000.0 / wvl
        S.SetFrequency(freq)
        
        result = {"wavelength": wvl}
        
        if compute_power:
            _, back_flux = S.GetPowerFlux("Superstrate", 0)
            forward_flux, _ = S.GetPowerFlux("Substrate", 0)
            
            R = abs(back_flux)
            T = abs(forward_flux)
            A = max(0, 1 - T - R)  # Clamp to avoid small negatives
            
            result["T"] = T
            result["R"] = R
            result["A"] = A
        
        if compute_fields:
            # Get fields at midpoint of structure for phase
            total_thickness = sum(l.thickness for l in layer_stack.layers)
            z_mid = total_thickness / 2
            
            tE, _ = S.GetFields(0, 0, z_mid + 10)
            rE, _ = S.GetFields(0, 0, -10)
            
            result["tE"] = tE[0]
            result["rE"] = rE[0]
        
        all_results.append(result)
        
        if progress_callback:
            progress_callback(i + 1, total)
    
    # Build result object
    # Create a minimal SimulationConfig for compatibility
    config = SimulationConfig(
        lattice_constant=layer_stack.lattice_constant,
        thickness=sum(l.thickness for l in layer_stack.layers if l.has_pattern) or 0.16,
        radius=next((l.pattern_radius for l in layer_stack.layers if l.pattern_radius), 0.15),
        wavelength=wavelength_range
    )
    
    sim_result = SimulationResult(
        wavelengths=[r["wavelength"] for r in all_results],
        config=config
    )
    
    if compute_power:
        sim_result.transmittance = [r["T"] for r in all_results]
        sim_result.reflectance = [r["R"] for r in all_results]
        sim_result.absorptance = [r["A"] for r in all_results]
    
    if compute_fields:
        sim_result.transmission_phase = [
            float(np.angle(r.get("tE", complex(1, 0))) / np.pi)
            for r in all_results
        ]
        sim_result.reflection_phase = [
            float(np.angle(r.get("rE", complex(1, 0))) / np.pi)
            for r in all_results
        ]
    
    return sim_result

