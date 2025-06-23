# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Triton-Lite Console is a web-based control interface for an underwater buoyancy control system. It consists of a React frontend that communicates with Arduino hardware via Web Serial API to control electromagnetic valves for precise buoyancy adjustments.

## Development Commands

### Frontend Development (React)
```bash
cd triton-lite
npm install        # Install dependencies
npm start          # Start development server on port 3000
npm run build      # Build for production
npm run deploy     # Deploy to GitHub Pages
npm test           # Run tests
```

### Running Tests
```bash
npm test           # Run all tests
npm test -- --watchAll=false  # Run tests once without watch mode
```

## Architecture and Key Components

### Frontend Structure
- **App.js**: Main application component handling serial communication, state management, and UI
- **Communication Protocol**: Custom binary format with header (0x24), timestamp, control parameters, checksum, and footer (0x3B)
- **State Management**: React hooks for serial port connection, timing parameters, and real-time data encoding
- **Serial Communication**: Uses Web Serial API with 9600 baud rate, handles connection/disconnection automatically

### Arduino Integration
- **Main Code**: Located in `main/main.ino`
- **State Machine**: Five states (IDLE → SUP_START → SUP_STOP → EXH_START → EXH_STOP)
- **Hardware Control**: Two valves (supply PIN 11, exhaust PIN 12), RTC (RX8025NB), LCD display (16x2 I2C)
- **Data Processing**: Receives encoded data, validates checksum, updates parameters in real-time

### Key Parameters
- **Timing Values**: Supply/exhaust start/stop times (0-3600 seconds)
- **Modes**: LCD mode (0-15), Log mode (0-15)
- **Diving Parameters**: Dive count (0-255), Pressure threshold (0-255)

## Important Considerations

### Serial Communication
- Always check serial port availability before attempting connection
- Handle disconnection gracefully - the system auto-disconnects after successful transmission
- Monitor console logs for debugging communication issues

### Data Encoding
- Data is encoded every second when connected
- All multi-byte values use little-endian format
- Checksum calculation: XOR of all bytes between header and checksum

### UI Updates
- Input fields automatically format values and enforce ranges
- Status indicator changes color based on connection state (green=connected, red=disconnected)
- Console shows timestamped communication logs

## Common Tasks

### Adding New Parameters
1. Update data encoding format in `encodeData()` function
2. Add corresponding decoding logic in Arduino `receiveData()`
3. Update UI components for new inputs
4. Ensure checksum calculation includes new bytes

### Debugging Serial Communication
1. Check browser console for Web Serial API errors
2. Monitor the in-app console for sent/received data
3. Verify Arduino serial monitor shows matching data
4. Confirm checksum validation passes

### Deployment
The app is configured for GitHub Pages deployment. The homepage URL is set in package.json.