# S4 Photonic Simulation GUI

A graphical user interface for the Stanford S4 library, designed to accelerate photonic crystal slab (PCS) simulation workflows for researchers.

![S4 GUI Screenshot](docs/screenshot.png)

## Features

- **🎛️ Visual Simulation Builder**: Configure all simulation parameters through an intuitive form interface
- **📊 Parameter Sweeps**: Define multi-parameter sweeps with automatic parallelization across CPU cores
- **📈 Interactive Visualization**: Plotly-based charts for T/R/A spectra, phase plots, and 2D field maps
- **🌓 Dark/Light Mode**: Eye-friendly interface for long simulation sessions
- **💾 Save/Load Configurations**: Store and recall simulation setups as JSON files
- **📁 Local Results Storage**: Export results to JSON or CSV format
- **⚡ Optimized Performance**: Parallel wavelength sweeps for 5-8x speedup

## Prerequisites

1. **Anaconda/Miniconda** with S4 installed:
   ```bash
   conda create -n S4 python=3.10
   conda activate S4
   conda install -c conda-forge s4
   ```

2. **Node.js** (v18+) for the frontend:
   - Download from: https://nodejs.org/

## Quick Start

### Windows

1. Double-click `start.bat`
2. The browser will open automatically at http://localhost:5173

### Manual Start

1. **Start the backend**:
   ```bash
   conda activate S4
   cd backend
   pip install -r requirements.txt
   python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

2. **Start the frontend** (in a new terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open http://localhost:5173 in your browser

## Project Structure

```
UTA-S4-GUI/
├── backend/                 # FastAPI Python backend
│   ├── main.py             # API entry point
│   ├── simulation/         # S4 wrapper and sweep engine
│   │   ├── models.py       # Pydantic data models
│   │   ├── s4_runner.py    # S4 simulation wrapper
│   │   └── sweep.py        # Parallel sweep logic
│   ├── utils/              # File I/O utilities
│   └── requirements.txt    # Python dependencies
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Main pages
│   │   └── lib/            # API client and utilities
│   └── package.json
├── DATA/                   # Simulation output files
├── GRAPHS/                 # Generated plots
├── configs/                # Saved simulation configurations
├── start.bat               # Windows startup script
└── stop.bat                # Windows stop script
```

## Usage

### Basic Simulation

1. Configure parameters in the **Geometry**, **Materials**, **Excitation**, and **Wavelength** tabs
2. Click **Run Simulation**
3. View results in the interactive plots below
4. Export to JSON or CSV

### Parameter Sweep

1. Configure base parameters as above
2. In the **Parameter Sweep** section, click **Add Parameter**
3. Set the start, end, and step values for each sweep parameter
4. Click **Run Sweep** - simulations run in parallel across all CPU cores
5. View and compare results

### Saving Configurations

- Enter a name and click the save icon to store your current configuration
- Click on saved configs in the list to reload them

## API Reference

The backend exposes a REST API with auto-generated documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

Key endpoints:
- `POST /simulate` - Run single simulation
- `POST /sweep/start` - Start parameter sweep (async)
- `GET /sweep/status/{job_id}` - Check sweep progress
- `POST /configs/save` - Save configuration
- `GET /results` - List saved results

## Performance Tips

1. **NumBasis**: Use 32 for most cases. Higher values (64, 100) are more accurate but slower.
2. **Wavelength Step**: Use larger steps (5-10 nm) for quick previews, smaller (0.1-1 nm) for final results.
3. **Parameter Sweeps**: The GUI parallelizes across configurations, so sweeps with many configurations benefit most.

## Troubleshooting

### "Backend not running" error
- Make sure you've activated the S4 conda environment
- Check that port 8000 is not in use
- Look for errors in the backend terminal window

### S4 import error
- Verify S4 is installed: `conda list | grep s4`
- Try reinstalling: `conda install -c conda-forge s4`

### Slow simulations
- Reduce NumBasis for testing
- Use larger wavelength steps
- Enable only the outputs you need (T/R/A or fields, not both)

## Contributing

This project was built for the UTA photonics lab. Contributions are welcome!

## License

MIT License - See LICENSE file for details.

## Acknowledgments

- [Stanford S4](https://github.com/victorliu/S4) - RCWA simulation library
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework
- [React](https://react.dev/) - Frontend library
- [Plotly](https://plotly.com/javascript/) - Interactive visualization
