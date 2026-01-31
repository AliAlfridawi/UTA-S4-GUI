"""
File I/O utilities for saving/loading configurations and results.
"""
import json
import csv
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..simulation.models import SimulationConfig, SimulationResult, SweepConfig


def get_project_root() -> Path:
    """Get the project root directory."""
    return Path(__file__).parent.parent.parent


def get_data_dir() -> Path:
    """Get the DATA directory path."""
    data_dir = get_project_root() / "DATA"
    data_dir.mkdir(exist_ok=True)
    return data_dir


def get_graphs_dir() -> Path:
    """Get the GRAPHS directory path."""
    graphs_dir = get_project_root() / "GRAPHS"
    graphs_dir.mkdir(exist_ok=True)
    return graphs_dir


def get_configs_dir() -> Path:
    """Get the configs directory path."""
    configs_dir = get_project_root() / "configs"
    configs_dir.mkdir(exist_ok=True)
    return configs_dir


def generate_filename(config: SimulationConfig, suffix: str = "") -> str:
    """
    Generate a filename based on simulation parameters.
    
    Args:
        config: Simulation configuration
        suffix: Additional suffix for the filename
        
    Returns:
        Filename string (without extension)
    """
    parts = [
        f"{config.n_silicon:.4f}n",
        f"{config.lattice_constant:.3f}a",
        f"{config.radius:.3f}r",
        f"{config.thickness:.3f}t",
        f"{config.glass_thickness:.1f}h"
    ]
    
    base = "_".join(parts)
    if suffix:
        base = f"{base}_{suffix}"
    
    return base


def save_config(config: SimulationConfig, name: Optional[str] = None) -> str:
    """
    Save a simulation configuration to JSON.
    
    Args:
        config: Simulation configuration to save
        name: Optional name for the config file
        
    Returns:
        Path to saved file
    """
    configs_dir = get_configs_dir()
    
    if name is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        name = f"config_{timestamp}"
    
    filepath = configs_dir / f"{name}.json"
    
    with open(filepath, 'w') as f:
        json.dump(config.model_dump(), f, indent=2)
    
    return str(filepath)


def load_config(filepath: str) -> SimulationConfig:
    """
    Load a simulation configuration from JSON.
    
    Args:
        filepath: Path to the config file
        
    Returns:
        SimulationConfig object
    """
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    return SimulationConfig(**data)


def list_saved_configs() -> List[Dict[str, Any]]:
    """
    List all saved configuration files.
    
    Returns:
        List of dicts with name, path, and modified time
    """
    configs_dir = get_configs_dir()
    configs = []
    
    for filepath in configs_dir.glob("*.json"):
        stat = filepath.stat()
        configs.append({
            "name": filepath.stem,
            "path": str(filepath),
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "size": stat.st_size
        })
    
    # Sort by modified time, newest first
    configs.sort(key=lambda x: x["modified"], reverse=True)
    
    return configs


def save_results_csv(
    result: SimulationResult, 
    output_dir: Optional[Path] = None,
    data_type: str = "power"
) -> Dict[str, str]:
    """
    Save simulation results to CSV files.
    
    Args:
        result: Simulation result
        output_dir: Output directory (default: DATA/)
        data_type: Type of data to save ("power", "phase", "all")
        
    Returns:
        Dict mapping data type to file path
    """
    if output_dir is None:
        output_dir = get_data_dir()
    
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    base_filename = generate_filename(result.config)
    saved_files = {}
    
    wavelengths = result.wavelengths
    
    if data_type in ("power", "all") and result.transmittance:
        # Save T/R/A
        for name, data in [
            ("T", result.transmittance),
            ("R", result.reflectance),
            ("A", result.absorptance)
        ]:
            if data:
                filepath = output_dir / f"{base_filename}_{name}.csv"
                with open(filepath, 'w', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(["wavelength_nm", name])
                    for wvl, val in zip(wavelengths, data):
                        writer.writerow([wvl, val])
                saved_files[name] = str(filepath)
    
    if data_type in ("phase", "all") and result.transmission_phase:
        # Save phases
        for name, data in [
            ("phaseT", result.transmission_phase),
            ("phaseR", result.reflection_phase)
        ]:
            if data:
                filepath = output_dir / f"{base_filename}_{name}.csv"
                with open(filepath, 'w', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(["wavelength_nm", "phase_pi"])
                    for wvl, val in zip(wavelengths, data):
                        writer.writerow([wvl, val])
                saved_files[name] = str(filepath)
    
    return saved_files


def save_results_json(result: SimulationResult, output_dir: Optional[Path] = None) -> str:
    """
    Save complete simulation results to JSON.
    
    Args:
        result: Simulation result
        output_dir: Output directory (default: DATA/)
        
    Returns:
        Path to saved file
    """
    if output_dir is None:
        output_dir = get_data_dir()
    
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    base_filename = generate_filename(result.config)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = output_dir / f"{base_filename}_{timestamp}.json"
    
    with open(filepath, 'w') as f:
        json.dump(result.model_dump(), f, indent=2)
    
    return str(filepath)


def load_results_json(filepath: str) -> SimulationResult:
    """
    Load simulation results from JSON.
    
    Args:
        filepath: Path to the results file
        
    Returns:
        SimulationResult object
    """
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    return SimulationResult(**data)


def list_saved_results() -> List[Dict[str, Any]]:
    """
    List all saved result files.
    
    Returns:
        List of dicts with name, path, and modified time
    """
    data_dir = get_data_dir()
    results = []
    
    for filepath in data_dir.glob("*.json"):
        stat = filepath.stat()
        results.append({
            "name": filepath.stem,
            "path": str(filepath),
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "size": stat.st_size
        })
    
    # Sort by modified time, newest first
    results.sort(key=lambda x: x["modified"], reverse=True)
    
    return results


def cleanup_old_files(directory: Path, max_age_days: int = 30) -> int:
    """
    Clean up files older than max_age_days.
    
    Args:
        directory: Directory to clean
        max_age_days: Maximum age in days
        
    Returns:
        Number of files deleted
    """
    import time
    
    cutoff = time.time() - (max_age_days * 24 * 60 * 60)
    deleted = 0
    
    for filepath in directory.iterdir():
        if filepath.is_file() and filepath.stat().st_mtime < cutoff:
            filepath.unlink()
            deleted += 1
    
    return deleted
