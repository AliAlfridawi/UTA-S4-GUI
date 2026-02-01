"""
S4 Photonic Simulation GUI - FastAPI Backend

This is the main entry point for the API server.
Run with: uvicorn main:app --reload
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import List, Optional
import asyncio
import json
from pathlib import Path

from simulation import (
    SimulationConfig,
    SweepConfig,
    SweepParameter,
    SimulationResult,
    FieldMapResult,
    ProgressUpdate,
    JobInfo,
    SimulationStatus,
    run_simulation,
    run_sweep,
    compute_field_map,
    get_cpu_count,
    create_job,
    run_job,
    get_job_status,
    get_job_results,
    cancel_job,
    estimate_sweep_time,
    get_job_database
)
from utils import (
    save_config,
    load_config,
    list_saved_configs,
    save_results_csv,
    save_results_json,
    load_results_json,
    list_saved_results,
    get_data_dir,
    get_configs_dir,
    sanitize_filename,
    validate_path_containment,
    PathTraversalError
)

# Create FastAPI app
app = FastAPI(
    title="S4 Photonic Simulation API",
    description="REST API for Stanford S4 photonic crystal slab simulations",
    version="1.0.0"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connections for progress updates
active_connections: List[WebSocket] = []


# ============================================================================
# Health & Info Endpoints
# ============================================================================

@app.get("/")
async def root():
    """API root - basic info."""
    return {
        "name": "S4 Photonic Simulation API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "cpu_count": get_cpu_count()}


@app.get("/info")
async def system_info():
    """Get system information."""
    return {
        "cpu_count": get_cpu_count(),
        "data_dir": "DATA",
        "configs_dir": "configs"
    }


# ============================================================================
# Simulation Endpoints
# ============================================================================

@app.post("/simulate", response_model=SimulationResult)
async def run_single_simulation(config: SimulationConfig):
    """
    Run a single simulation with the given configuration.
    
    This is a synchronous endpoint - it will block until the simulation completes.
    For long simulations, use the /sweep endpoint with background processing.
    """
    try:
        result = run_simulation(config)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/simulate/preview")
async def preview_simulation(config: SimulationConfig):
    """
    Preview simulation parameters without running.
    
    Returns estimated time and number of wavelength points.
    """
    num_wavelengths = config.wavelength.num_points
    estimated_time = num_wavelengths * 0.01 / get_cpu_count()  # Rough estimate
    
    return {
        "num_wavelengths": num_wavelengths,
        "wavelength_range": {
            "start": config.wavelength.start,
            "end": config.wavelength.end,
            "step": config.wavelength.step
        },
        "estimated_time_seconds": estimated_time,
        "cpu_count": get_cpu_count()
    }


@app.post("/field-map", response_model=FieldMapResult)
async def get_field_map(
    config: SimulationConfig,
    wavelength: float,
    z_position: float,
    x_points: int = 50,
    y_points: int = 50
):
    """
    Compute a 2D electric field map at a specific z-position.
    """
    try:
        result = compute_field_map(config, wavelength, z_position, x_points, y_points)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Sweep Endpoints
# ============================================================================

@app.post("/sweep/preview")
async def preview_sweep(sweep_config: SweepConfig):
    """
    Preview a parameter sweep without running it.
    
    Returns total number of simulations and estimated time.
    """
    total_sims = 1
    for sweep in sweep_config.sweeps:
        total_sims *= sweep.num_points
    
    total_wavelengths = total_sims * sweep_config.base_config.wavelength.num_points
    estimated_time = estimate_sweep_time(sweep_config)
    
    return {
        "total_simulations": total_sims,
        "total_wavelength_points": total_wavelengths,
        "estimated_time_seconds": estimated_time,
        "sweeps": [
            {
                "parameter": s.name,
                "start": s.start,
                "end": s.end,
                "step": s.step,
                "num_points": s.num_points
            }
            for s in sweep_config.sweeps
        ]
    }


@app.post("/sweep/start")
async def start_sweep(sweep_config: SweepConfig, background_tasks: BackgroundTasks):
    """
    Start a parameter sweep in the background.
    
    Returns a job ID that can be used to check progress.
    """
    job_id = create_job(sweep_config)
    background_tasks.add_task(run_job, job_id, sweep_config)
    
    return {
        "job_id": job_id,
        "status": "started",
        "message": "Sweep started in background"
    }


@app.get("/sweep/status/{job_id}")
async def get_sweep_status(job_id: str):
    """
    Get the status of a running sweep job.
    """
    status = get_job_status(job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return status


@app.get("/sweep/results/{job_id}")
async def get_sweep_results(job_id: str):
    """
    Get the results of a completed sweep job.
    """
    status = get_job_status(job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if status.status != SimulationStatus.COMPLETED:
        raise HTTPException(
            status_code=400, 
            detail=f"Job not completed. Current status: {status.status}"
        )
    
    results = get_job_results(job_id)
    return {"job_id": job_id, "results": results}


@app.post("/sweep/cancel/{job_id}")
async def cancel_sweep(job_id: str):
    """
    Cancel a running sweep job.
    """
    success = cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {"job_id": job_id, "status": "cancelled"}


# ============================================================================
# Job History Endpoints (Persistent Storage)
# ============================================================================

@app.get("/jobs")
async def list_jobs(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    List all jobs from persistent storage with optional filtering.
    """
    db = get_job_database()
    status_filter = None
    if status:
        try:
            status_filter = SimulationStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    jobs = db.list_jobs(status=status_filter, limit=limit, offset=offset)
    return {"jobs": jobs, "count": len(jobs)}


@app.get("/jobs/{job_id}")
async def get_job_details(job_id: str):
    """
    Get detailed information about a specific job.
    """
    db = get_job_database()
    job = db.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job


@app.get("/jobs/{job_id}/results")
async def get_job_results_persistent(job_id: str):
    """
    Get results for a completed job from persistent storage.
    """
    db = get_job_database()
    job = db.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != SimulationStatus.COMPLETED:
        raise HTTPException(
            status_code=400, 
            detail=f"Job not completed. Current status: {job.status}"
        )
    
    results = db.get_job_results(job_id)
    return {"job_id": job_id, "results": results}


@app.get("/jobs/{job_id}/config")
async def get_job_config(job_id: str):
    """
    Get the sweep configuration for a job.
    """
    db = get_job_database()
    config = db.get_job_config(job_id)
    
    if not config:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return config


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """
    Delete a job and its results from persistent storage.
    """
    db = get_job_database()
    success = db.delete_job(job_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {"message": "Job deleted", "job_id": job_id}


@app.get("/jobs/resumable")
async def get_resumable_jobs():
    """
    Get jobs that can be resumed (pending or running at last shutdown).
    """
    db = get_job_database()
    jobs = db.get_resumable_jobs()
    return {"jobs": jobs}


@app.post("/jobs/cleanup")
async def cleanup_old_jobs(days: int = 30):
    """
    Delete jobs older than specified days.
    """
    db = get_job_database()
    deleted = db.cleanup_old_jobs(days=days)
    return {"message": f"Deleted {deleted} old jobs", "deleted_count": deleted}


# ============================================================================
# Configuration Endpoints
# ============================================================================

@app.get("/configs")
async def list_configs():
    """
    List all saved simulation configurations.
    """
    return {"configs": list_saved_configs()}


@app.post("/configs/save")
async def save_simulation_config(config: SimulationConfig, name: Optional[str] = None):
    """
    Save a simulation configuration to disk.
    """
    try:
        filepath = save_config(config, name)
        return {"message": "Config saved", "path": filepath}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/configs/load/{name}")
async def load_simulation_config(name: str):
    """
    Load a saved simulation configuration.
    """
    try:
        # Sanitize user-provided name
        safe_name = sanitize_filename(name)
        configs_dir = get_configs_dir()
        filepath = configs_dir / f"{safe_name}.json"
        
        # Validate path containment
        validated_path = validate_path_containment(filepath, configs_dir)
        
        if not validated_path.exists():
            raise HTTPException(status_code=404, detail="Config not found")
        
        config = load_config(str(validated_path))
        return config
    except PathTraversalError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/configs/{name}")
async def delete_config(name: str):
    """
    Delete a saved configuration.
    """
    try:
        # Sanitize user-provided name
        safe_name = sanitize_filename(name)
        configs_dir = get_configs_dir()
        filepath = configs_dir / f"{safe_name}.json"
        
        # Validate path containment
        validated_path = validate_path_containment(filepath, configs_dir)
        
        if not validated_path.exists():
            raise HTTPException(status_code=404, detail="Config not found")
        
        validated_path.unlink()
        return {"message": "Config deleted", "name": safe_name}
    except PathTraversalError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Results Endpoints
# ============================================================================

@app.get("/results")
async def list_results():
    """
    List all saved simulation results.
    """
    return {"results": list_saved_results()}


@app.post("/results/save")
async def save_simulation_results(result: SimulationResult, format: str = "json"):
    """
    Save simulation results to disk.
    
    Args:
        result: Simulation result to save
        format: "json" or "csv"
    """
    try:
        if format == "json":
            filepath = save_results_json(result)
            return {"message": "Results saved", "path": filepath}
        elif format == "csv":
            files = save_results_csv(result, data_type="all")
            return {"message": "Results saved", "files": files}
        else:
            raise HTTPException(status_code=400, detail="Invalid format. Use 'json' or 'csv'")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results/load/{name}")
async def load_simulation_results(name: str):
    """
    Load saved simulation results.
    """
    try:
        # Sanitize user-provided name
        safe_name = sanitize_filename(name)
        data_dir = get_data_dir()
        filepath = data_dir / f"{safe_name}.json"
        
        # Validate path containment
        validated_path = validate_path_containment(filepath, data_dir)
        
        if not validated_path.exists():
            raise HTTPException(status_code=404, detail="Results not found")
        
        result = load_results_json(str(validated_path))
        return result
    except PathTraversalError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results/download/{name}")
async def download_results(name: str, format: str = "json"):
    """
    Download results file.
    """
    try:
        # Sanitize user-provided name
        safe_name = sanitize_filename(name)
        data_dir = get_data_dir()
        
        if format == "json":
            filepath = data_dir / f"{safe_name}.json"
        else:
            filepath = data_dir / f"{safe_name}.csv"
        
        # Validate path containment
        validated_path = validate_path_containment(filepath, data_dir)
        
        if not validated_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            validated_path,
            filename=validated_path.name,
            media_type="application/octet-stream"
        )
    except PathTraversalError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# WebSocket for Real-time Progress
# ============================================================================

@app.websocket("/ws/progress/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time progress updates.
    """
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            status = get_job_status(job_id)
            
            if status is None:
                await websocket.send_json({"error": "Job not found"})
                break
            
            await websocket.send_json(status.model_dump())
            
            if status.status in (SimulationStatus.COMPLETED, SimulationStatus.FAILED, SimulationStatus.CANCELLED):
                break
            
            await asyncio.sleep(0.5)  # Update every 500ms
            
    except WebSocketDisconnect:
        pass
    finally:
        active_connections.remove(websocket)


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
