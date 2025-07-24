import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import logoImage from "./AquaWiz_NewW.png"; // Import the logo image

function App() {
  // Device parameters with initial values of 0
  const [parameters, setParameters] = useState({
    supStart: "0",
    supStop: "0",
    exhStart: "0",
    exhStop: "0",
    lcdMode: "0",
    logMode: "3",
    diveCount: "0", // Added dive count parameter
    pressureThreshold: "100", // Added pressure threshold parameter
  });

  // State to hold the current encoded data string
  const [currentEncodedData, setCurrentEncodedData] = useState("");

  // State for expandable details
  const [showTimingDetails, setShowTimingDetails] = useState(false);

  // Serial connection state
  const [isConnected, setIsConnected] = useState(false);
  const [port, setPort] = useState(null);
  const [output, setOutput] = useState([]);

  // Refs for serial communication and UI
  const writerRef = useRef(null);
  const readerRef = useRef(null);
  const receiveBufferRef = useRef("");
  const outputRef = useRef(null);
  const disconnectingRef = useRef(false);

  // Handle parameter input changes with validation
  const handleParameterChange = (param, max) => (e) => {
    let value = e.target.value;

    // Handle empty input
    if (value === "") {
      const newParameters = { ...parameters, [param]: "0" };
      setParameters(newParameters);
      updateEncodedData(newParameters);
      return;
    }

    // Remove leading zeros
    if (value.length > 1 && value.startsWith("0")) {
      value = value.replace(/^0+/, "");
    }

    // Parse the value and cap it at the maximum if needed
    let numValue = parseInt(value, 10);
    if (numValue > max) {
      numValue = max;
    }

    // Only accept non-negative numbers
    if (!isNaN(numValue) && numValue >= 0) {
      const newParameters = { ...parameters, [param]: numValue.toString() };
      setParameters(newParameters);
      updateEncodedData(newParameters);
    }
  };

  // Update the encoded data string based on current parameters
  const updateEncodedData = (params = parameters) => {
    try {
      // Get current date and time
      const now = new Date();

      // Parse input values
      const supStartVal = parseInt(params.supStart, 10) || 0;
      const supStopVal = parseInt(params.supStop, 10) || 0;
      const exhStartVal = parseInt(params.exhStart, 10) || 0;
      const exhStopVal = parseInt(params.exhStop, 10) || 0;
      const lcdModeVal = parseInt(params.lcdMode, 10) || 0;
      const logModeVal = parseInt(params.logMode, 10) || 0;
      const diveCountVal = parseInt(params.diveCount, 10) || 0; // Parse dive count
      const pressureThresholdVal = parseInt(params.pressureThreshold, 10) || 0; // Parse pressure threshold

      // Prepare data bytes
      const header = 0x24; // '$'
      const yearOffset = now.getFullYear() - 2000;
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const second = now.getSeconds();

      // Create data array
      const dataBytes = [
        header,
        yearOffset,
        month,
        day,
        hour,
        minute,
        second,
        (supStartVal >> 8) & 0xff, // High byte
        supStartVal & 0xff, // Low byte
        (supStopVal >> 8) & 0xff, // High byte
        supStopVal & 0xff, // Low byte
        (exhStartVal >> 8) & 0xff, // High byte
        exhStartVal & 0xff, // Low byte
        (exhStopVal >> 8) & 0xff, // High byte
        exhStopVal & 0xff, // Low byte
        ((lcdModeVal & 0x0f) << 4) | (logModeVal & 0x0f), // Combined byte
        diveCountVal & 0xff, // Dive count byte
        pressureThresholdVal & 0xff, // Pressure threshold byte
      ];

      // Calculate checksum (sum of all data bytes)
      let checksum = 0;
      for (let i = 0; i < dataBytes.length; i++) {
        checksum += dataBytes[i];
      }
      checksum = checksum & 0xff;

      // Append checksum and footer
      dataBytes.push(checksum);
      dataBytes.push(0x3b); // ';'

      // Convert to hex string
      let hexString = "";
      for (let i = 0; i < dataBytes.length; i++) {
        const hex = dataBytes[i].toString(16).padStart(2, "0");
        hexString += hex;
      }

      setCurrentEncodedData(hexString);
    } catch (error) {
      console.error(`Error encoding data: ${error.message}`);
    }
  };

  // Add message to console output
  const addToOutput = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setOutput((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  // Auto-scroll console to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Add this new useEffect to update the encoded data every second
  useEffect(() => {
    // Update encoded data immediately
    updateEncodedData();

    // Set up interval to update encoded data every second
    const intervalId = setInterval(() => {
      updateEncodedData();
    }, 1000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [parameters]); // Only re-establish the interval when parameters change

  // Initial welcome message on component mount
  useEffect(() => {
    addToOutput("TRITON-LITE Control Interface ready");

    if (!("serial" in navigator)) {
      addToOutput("Web Serial API is not supported in this browser");
      addToOutput("Please use Chrome or Edge with the Web Serial API enabled");
    }

    // Initialize the encoded data string
    updateEncodedData();

    // Clean up any open connections when component unmounts
    return () => {
      disconnectFromPort();
    };
  }, []);

  // Connect to serial port
  const connectToPort = async () => {
    try {
      // Check if already disconnecting
      if (disconnectingRef.current) {
        addToOutput("Disconnection in progress, please wait...");
        return;
      }

      // Check if already connected
      if (isConnected) {
        addToOutput("Already connected to a serial port");
        return;
      }

      if (!("serial" in navigator)) {
        addToOutput("Web Serial API is not supported in this browser");
        return;
      }

      // Request user to select a serial port
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 9600 });

      setPort(selectedPort);
      setIsConnected(true);
      addToOutput("Connected to serial port");

      // Set up reading from the port
      startReading(selectedPort);

      // Create writer for sending data
      writerRef.current = selectedPort.writable.getWriter();
    } catch (error) {
      addToOutput(`Error connecting: ${error.message}`);
      // Reset connection state in case of error
      setIsConnected(false);
      setPort(null);
    }
  };

  // Start reading data from the serial port
  const startReading = async (port) => {
    const textDecoder = new TextDecoder();
    const reader = port.readable.getReader();
    readerRef.current = reader; // Store reader reference

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          addToOutput("Serial port closed");
          break;
        }

        const text = textDecoder.decode(value);
        processReceivedData(text);
      }
    } catch (error) {
      addToOutput(`Error reading from port: ${error.message}`);
    } finally {
      // Only release the lock if reader is still valid and hasn't been released
      if (reader && readerRef.current === reader) {
        try {
          reader.releaseLock();
        } catch (e) {
          // Ignore errors when releasing lock
        }
        readerRef.current = null;
      }
    }
  };

  // Process received data from serial port
  const processReceivedData = (text) => {
    // Add received text to buffer
    receiveBufferRef.current += text;

    // Check if buffer contains newline characters
    if (receiveBufferRef.current.includes("\n")) {
      // Split buffer by newlines
      const lines = receiveBufferRef.current.split("\n");

      // Process all complete lines except the last one (which might be incomplete)
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line) {
          addToOutput(`Received: ${line}`);

          // Check if we received confirmation of valid checksum
          if (line.includes("Checksum valid: true")) {
            addToOutput("Checksum valid. Closing connection in 3 seconds...");
            // Wait a moment before disconnecting
            setTimeout(() => {
              disconnectFromPort();
            }, 3000);
          }
        }
      }

      // Keep the last (potentially incomplete) line in the buffer
      receiveBufferRef.current = lines[lines.length - 1];
    }
  };

  // Disconnect from serial port
  const disconnectFromPort = async () => {
    // If already disconnecting, don't try again
    if (disconnectingRef.current) return;

    disconnectingRef.current = true;

    try {
      // Release reader lock if it exists
      if (readerRef.current) {
        try {
          await readerRef.current.cancel(); // Signal reader to stop
          await readerRef.current.releaseLock();
        } catch (e) {
          // Ignore errors when releasing reader lock
        }
        readerRef.current = null;
      }

      // Release writer lock if it exists
      if (writerRef.current) {
        try {
          await writerRef.current.close(); // Close the writer
          await writerRef.current.releaseLock();
        } catch (e) {
          // Ignore errors when releasing writer lock
        }
        writerRef.current = null;
      }

      // Close the port if it exists
      if (port) {
        try {
          await port.close();
        } catch (e) {
          addToOutput(`Warning during port close: ${e.message}`);
        }
        setPort(null);
      }

      setIsConnected(false);
      addToOutput("Disconnected from serial port");
    } catch (error) {
      addToOutput(`Error disconnecting: ${error.message}`);
    } finally {
      disconnectingRef.current = false;
    }
  };

  // Encode parameters into binary format for transmission
  const encodeData = () => {
    // This function can now simply return the pre-computed encoded data string
    return currentEncodedData;
  };

  // Send data to the device
  const sendData = async () => {
    try {
      if (!isConnected || !writerRef.current) {
        addToOutput("Not connected to a serial port");
        return;
      }

      const encodedData = encodeData();
      if (!encodedData) {
        return;
      }

      addToOutput(`Sending data: ${encodedData}`);

      // Convert hex string to binary data and send
      const encoder = new TextEncoder();
      await writerRef.current.write(encoder.encode(encodedData + "\n"));
      addToOutput("Data sent successfully");
    } catch (error) {
      addToOutput(`Error sending data: ${error.message}`);
    }
  };

  // Clear console output
  const clearConsole = () => {
    setOutput([]);
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="logo">
          <img src={logoImage} alt="AquaWiz Logo" className="logo-image" />
        </div>
        <div className="status-indicator">
          <div
            className={`status-dot ${
              isConnected ? "connected" : "disconnected"
            }`}
          ></div>
          <span>{isConnected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      <div className="main-content">
        <div className="left-panel">
          <div className="connection-card">
            <h2>Connection</h2>
            <div className="connection-controls">
              <button
                onClick={connectToPort}
                disabled={isConnected || disconnectingRef.current}
                className="btn connect-btn"
              >
                <span className="material-icons">power</span>
                Connect
              </button>
              <button
                onClick={disconnectFromPort}
                disabled={!isConnected || disconnectingRef.current}
                className="btn disconnect-btn"
              >
                <span className="material-icons">power_off</span>
                Disconnect
              </button>
            </div>
          </div>

          <div className="parameters-card">
            <h2>Timing Parameters</h2>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="supStart">Sup Start</label>
                <div className="input-wrapper">
                  <input
                    id="supStart"
                    type="number"
                    value={parameters.supStart}
                    onChange={handleParameterChange("supStart", 65535)}
                    disabled={!isConnected}
                    placeholder="0-65535"
                  />
                  <span className="input-unit">s</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="supStop">Sup Stop</label>
                <div className="input-wrapper">
                  <input
                    id="supStop"
                    type="number"
                    value={parameters.supStop}
                    onChange={handleParameterChange("supStop", 65535)}
                    disabled={!isConnected}
                    placeholder="0-65535"
                  />
                  <span className="input-unit">ms</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="exhStart">Exh Start</label>
                <div className="input-wrapper">
                  <input
                    id="exhStart"
                    type="number"
                    value={parameters.exhStart}
                    onChange={handleParameterChange("exhStart", 65535)}
                    disabled={!isConnected}
                    placeholder="0-65535"
                  />
                  <span className="input-unit">s</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="exhStop">Exh Stop</label>
                <div className="input-wrapper">
                  <input
                    id="exhStop"
                    type="number"
                    value={parameters.exhStop}
                    onChange={handleParameterChange("exhStop", 65535)}
                    disabled={!isConnected}
                    placeholder="0-65535"
                  />
                  <span className="input-unit">ms</span>
                </div>
              </div>
            </div>

            <div className="timing-details">
              <button
                className="details-toggle"
                onClick={() => setShowTimingDetails(!showTimingDetails)}
              >
                <span className="material-icons">
                  {showTimingDetails ? "expand_less" : "expand_more"}
                </span>
                Parameter Details
              </button>

              {showTimingDetails && (
                <div className="details-content">
                  <dl>
                    <dt>Sup Start:</dt>
                    <dd>
                      風船が萎んだ後，次に風船に空気を入れるまでの時間(秒)
                    </dd>

                    <dt>Sup Stop:</dt>
                    <dd>風船に空気を入れるための電磁弁解放時間(ミリ秒)</dd>

                    <dt>Exh Start:</dt>
                    <dd>風船に空気を入れ，次に萎むまでの時間(秒)</dd>

                    <dt>Exh Stop:</dt>
                    <dd>風船を萎ませるための電磁弁解放時間(ミリ秒)</dd>
                  </dl>
                </div>
              )}
            </div>

            <h2>Mode Settings</h2>

            <div className="mode-controls">
              <div className="form-group">
                <label htmlFor="lcdMode">LCD Mode</label>
                <div className="input-wrapper">
                  <input
                    id="lcdMode"
                    type="number"
                    value={parameters.lcdMode}
                    onChange={handleParameterChange("lcdMode", 15)}
                    disabled={!isConnected}
                    placeholder="0-15"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="logMode">Log Mode</label>
                <div className="input-wrapper">
                  <input
                    id="logMode"
                    type="number"
                    value={parameters.logMode}
                    onChange={handleParameterChange("logMode", 3)}
                    disabled={!isConnected}
                    placeholder="0-3"
                  />
                </div>
              </div>
            </div>

            <h2>Diving Parameters</h2>

            <div className="dive-controls">
              <div className="form-group">
                <label htmlFor="diveCount">Dive Count</label>
                <div className="input-wrapper">
                  <input
                    id="diveCount"
                    type="number"
                    value={parameters.diveCount}
                    onChange={handleParameterChange("diveCount", 1023)}
                    disabled={!isConnected}
                    placeholder="0-1023"
                  />
                  <span className="input-unit">times</span>
                </div>
                <small className="input-help">0 means no count specified</small>
              </div>

              <div className="form-group">
                <label htmlFor="pressureThreshold">
                  Internal Pressure Threshold
                </label>
                <div className="input-wrapper">
                  <input
                    id="pressureThreshold"
                    type="number"
                    value={parameters.pressureThreshold}
                    onChange={handleParameterChange("pressureThreshold", 1023)}
                    disabled={!isConnected}
                    placeholder="0-1023"
                  />
                </div>
              </div>
            </div>

            {/* Encoded data display */}
            <div className="encoded-data-display">
              <h3>Encoded Data (HEX)</h3>
              <div className="hex-display">{currentEncodedData}</div>
            </div>

            <button
              onClick={sendData}
              disabled={!isConnected}
              className="btn send-btn"
            >
              <span className="material-icons">send</span>
              Send Data
            </button>
          </div>
        </div>

        <div className="right-panel">
          <div className="output-card">
            <div className="output-header">
              <h2>Console</h2>
              <button onClick={clearConsole} className="btn clear-btn">
                Clear
              </button>
            </div>
            <div className="console" ref={outputRef}>
              {output.map((line, index) => (
                <div key={index} className="console-line">
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <footer className="app-footer">Made by Shintaro Matsumoto</footer>
    </div>
  );
}

export default App;
