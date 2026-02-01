"""
SQLite database module for persistent job storage.

Provides job history, resume functionality, and audit trail.
"""
import sqlite3
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from contextlib import contextmanager

from .models import (
    SimulationConfig,
    SweepConfig,
    SimulationResult,
    ProgressUpdate,
    JobInfo,
    SimulationStatus
)


class JobDatabase:
    """SQLite-based persistent job storage."""
    
    def __init__(self, db_path: Optional[Path] = None):
        """
        Initialize the job database.
        
        Args:
            db_path: Path to SQLite database file. Defaults to DATA/jobs.db
        """
        if db_path is None:
            from ..utils import get_data_dir
            db_path = get_data_dir() / "jobs.db"
        
        self.db_path = Path(db_path)
        self._init_database()
    
    @contextmanager
    def _get_connection(self):
        """Get a database connection with context manager."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def _init_database(self):
        """Initialize database tables."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Jobs table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT,
                    sweep_config TEXT NOT NULL,
                    progress_current INTEGER DEFAULT 0,
                    progress_total INTEGER DEFAULT 0,
                    progress_percent REAL DEFAULT 0.0,
                    progress_message TEXT,
                    error TEXT
                )
            ''')
            
            # Results table (stores individual simulation results per job)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS job_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL,
                    result_index INTEGER NOT NULL,
                    result_data TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
                )
            ''')
            
            # Create indices for faster queries
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_results_job ON job_results(job_id)
            ''')
    
    def create_job(self, sweep_config: SweepConfig) -> str:
        """
        Create a new job entry.
        
        Args:
            sweep_config: The sweep configuration for this job
            
        Returns:
            Job ID string
        """
        job_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        # Count total simulations (number of parameter combinations)
        total_sims = 1
        for sweep in sweep_config.sweeps:
            total_sims *= sweep.num_points
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO jobs (
                    id, status, created_at, updated_at, sweep_config,
                    progress_current, progress_total, progress_percent, progress_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                job_id,
                SimulationStatus.PENDING.value,
                now,
                now,
                json.dumps(sweep_config.model_dump()),
                0,
                total_sims,
                0.0,
                "Job queued"
            ))
        
        return job_id
    
    def update_job_status(
        self, 
        job_id: str, 
        status: SimulationStatus,
        progress: Optional[ProgressUpdate] = None,
        error: Optional[str] = None
    ):
        """
        Update job status and progress.
        
        Args:
            job_id: Job identifier
            status: New status
            progress: Optional progress update
            error: Optional error message
        """
        now = datetime.now().isoformat()
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            updates = ["status = ?", "updated_at = ?"]
            params = [status.value, now]
            
            if progress:
                updates.extend([
                    "progress_current = ?",
                    "progress_total = ?",
                    "progress_percent = ?",
                    "progress_message = ?"
                ])
                params.extend([
                    progress.current,
                    progress.total,
                    progress.percent,
                    progress.message
                ])
            
            if error:
                updates.append("error = ?")
                params.append(error)
            
            if status in (SimulationStatus.COMPLETED, SimulationStatus.FAILED, SimulationStatus.CANCELLED):
                updates.append("completed_at = ?")
                params.append(now)
            
            params.append(job_id)
            
            cursor.execute(f'''
                UPDATE jobs SET {", ".join(updates)} WHERE id = ?
            ''', params)
    
    def save_job_result(self, job_id: str, result_index: int, result: SimulationResult):
        """
        Save a single simulation result for a job.
        
        Args:
            job_id: Job identifier
            result_index: Index of this result in the sweep
            result: Simulation result
        """
        now = datetime.now().isoformat()
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO job_results (job_id, result_index, result_data, created_at)
                VALUES (?, ?, ?, ?)
            ''', (job_id, result_index, json.dumps(result.model_dump()), now))
    
    def save_job_results(self, job_id: str, results: List[SimulationResult]):
        """
        Save all simulation results for a job.
        
        Args:
            job_id: Job identifier
            results: List of simulation results
        """
        now = datetime.now().isoformat()
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for idx, result in enumerate(results):
                cursor.execute('''
                    INSERT INTO job_results (job_id, result_index, result_data, created_at)
                    VALUES (?, ?, ?, ?)
                ''', (job_id, idx, json.dumps(result.model_dump()), now))
    
    def get_job(self, job_id: str) -> Optional[JobInfo]:
        """
        Get job information by ID.
        
        Args:
            job_id: Job identifier
            
        Returns:
            JobInfo or None if not found
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM jobs WHERE id = ?', (job_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            return self._row_to_job_info(row)
    
    def get_job_results(self, job_id: str) -> Optional[List[SimulationResult]]:
        """
        Get all results for a job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            List of SimulationResult or None if job not found
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT result_data FROM job_results 
                WHERE job_id = ? ORDER BY result_index
            ''', (job_id,))
            rows = cursor.fetchall()
            
            if not rows:
                return None
            
            return [SimulationResult(**json.loads(row['result_data'])) for row in rows]
    
    def get_job_config(self, job_id: str) -> Optional[SweepConfig]:
        """
        Get the sweep configuration for a job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            SweepConfig or None if not found
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT sweep_config FROM jobs WHERE id = ?', (job_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            return SweepConfig(**json.loads(row['sweep_config']))
    
    def list_jobs(
        self, 
        status: Optional[SimulationStatus] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List jobs with optional filtering.
        
        Args:
            status: Optional status filter
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of job summaries
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            query = 'SELECT * FROM jobs'
            params = []
            
            if status:
                query += ' WHERE status = ?'
                params.append(status.value)
            
            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
            params.extend([limit, offset])
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return [
                {
                    "job_id": row['id'],
                    "status": row['status'],
                    "created_at": row['created_at'],
                    "updated_at": row['updated_at'],
                    "completed_at": row['completed_at'],
                    "progress_current": row['progress_current'],
                    "progress_total": row['progress_total'],
                    "progress_percent": row['progress_percent'],
                    "error": row['error']
                }
                for row in rows
            ]
    
    def delete_job(self, job_id: str) -> bool:
        """
        Delete a job and its results.
        
        Args:
            job_id: Job identifier
            
        Returns:
            True if job was deleted, False if not found
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Delete results first (foreign key)
            cursor.execute('DELETE FROM job_results WHERE job_id = ?', (job_id,))
            
            # Delete job
            cursor.execute('DELETE FROM jobs WHERE id = ?', (job_id,))
            
            return cursor.rowcount > 0
    
    def get_resumable_jobs(self) -> List[Dict[str, Any]]:
        """
        Get jobs that can be resumed (pending or running).
        
        Returns:
            List of resumable job summaries with their configs
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM jobs 
                WHERE status IN (?, ?)
                ORDER BY created_at DESC
            ''', (SimulationStatus.PENDING.value, SimulationStatus.RUNNING.value))
            rows = cursor.fetchall()
            
            return [
                {
                    "job_id": row['id'],
                    "status": row['status'],
                    "created_at": row['created_at'],
                    "progress_current": row['progress_current'],
                    "progress_total": row['progress_total'],
                    "sweep_config": json.loads(row['sweep_config'])
                }
                for row in rows
            ]
    
    def cleanup_old_jobs(self, days: int = 30) -> int:
        """
        Delete jobs older than specified days.
        
        Args:
            days: Maximum age in days
            
        Returns:
            Number of jobs deleted
        """
        from datetime import timedelta
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Get job IDs to delete
            cursor.execute('''
                SELECT id FROM jobs WHERE created_at < ?
            ''', (cutoff,))
            job_ids = [row['id'] for row in cursor.fetchall()]
            
            if not job_ids:
                return 0
            
            # Delete results
            placeholders = ','.join('?' * len(job_ids))
            cursor.execute(f'''
                DELETE FROM job_results WHERE job_id IN ({placeholders})
            ''', job_ids)
            
            # Delete jobs
            cursor.execute(f'''
                DELETE FROM jobs WHERE id IN ({placeholders})
            ''', job_ids)
            
            return len(job_ids)
    
    def _row_to_job_info(self, row: sqlite3.Row) -> JobInfo:
        """Convert a database row to JobInfo."""
        progress = None
        if row['progress_total'] > 0:
            progress = ProgressUpdate(
                current=row['progress_current'],
                total=row['progress_total'],
                percent=row['progress_percent'],
                message=row['progress_message'] or ""
            )
        
        return JobInfo(
            job_id=row['id'],
            status=SimulationStatus(row['status']),
            progress=progress,
            error=row['error']
        )


# Global database instance (lazy initialized)
_db_instance: Optional[JobDatabase] = None


def get_job_database() -> JobDatabase:
    """Get the global job database instance."""
    global _db_instance
    if _db_instance is None:
        _db_instance = JobDatabase()
    return _db_instance
