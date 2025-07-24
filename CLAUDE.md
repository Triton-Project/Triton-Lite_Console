# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Triton-Lite_Console is a buoyancy control system for underwater devices consisting of:
- React web application for control interface (in `triton-lite/`)
- Arduino firmware for hardware control (in `Arduino/main.ino`)

## Common Development Commands

### Web Application
```bash
cd triton-lite
npm install          # Install dependencies
npm start            # Start development server on localhost:3000
npm run build        # Create production build
npm run deploy       # Deploy to GitHub Pages
npm run lint         # Run ESLint (if configured)
```

### Arduino Development
- Upload `Arduino/main.ino` using Arduino IDE
- Serial communication runs at 9600 baud

## Architecture & Key Concepts

### Communication Protocol
The system uses a custom binary protocol between web app and Arduino:
- Header: `0x24` ('$')
- Payload: Timestamp (6 bytes) + Parameters (8 bytes)
- Checksum: Sum of all bytes & 0xFF
- Footer: `0x3B` (';')

### Web Application Structure
- `App.js`: Main component handling serial communication and UI
- Uses Web Serial API (Chrome/Edge only)
- Material Design-inspired dark theme
- Real-time console for debugging serial communication

### Arduino State Machine
The firmware operates with 4 states controlling two solenoid valves:
- SUP_START/SUP_STOP: Supply valve timing
- EXH_START/EXH_STOP: Exhaust valve timing

### Key Parameters
- Sup Start/Stop: Supply valve timing (0-999 minutes)
- Exh Start/Stop: Exhaust valve timing (0-999 minutes)
- Dive Count (浮沈回数): Number of dive cycles
- Pressure Threshold (内部加圧閾値): Internal pressure threshold

## Important Implementation Details

1. **Time Encoding**: The web app encodes current time + parameters and sends updates every second
2. **Checksum Validation**: Both sides validate data integrity using checksum
3. **Serial Connection**: Handle connection states properly - check `port` existence before operations
4. **Input Validation**: Max values enforced in React (999 for timing, 1000 for pressure)
5. **RTC Module**: Arduino uses RX8025NB RTC for accurate timing