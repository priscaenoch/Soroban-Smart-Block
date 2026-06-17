import React, { useState, useRef, useEffect } from 'react';
import '../styles/Sandbox.css';
import Editor from '../components/Editor';
import FileExplorer from '../components/FileExplorer';
import Terminal from '../components/Terminal';
import Preview from '../components/Preview';
import { initWebContainer, mountFiles, runCommand, NODE_SDK_TEMPLATE, SandboxFile } from '../services/webcontainer';
import { WebContainer } from '@webcontainer/api';

const Sandbox: React.FC = () => {
  const [files, setFiles] = useState<Map<string, SandboxFile>>(new Map());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const webcontainerRef = useRef<WebContainer | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize WebContainer and template on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const container = await initWebContainer();
        webcontainerRef.current = container;

        // Load Node.js template
        const templateMap = new Map(Object.entries(NODE_SDK_TEMPLATE));
        setFiles(templateMap);
        setSelectedFile('src/index.js');

        // Mount files to container
        await mountFiles(container, templateMap);
        setTerminalOutput(['> Sandbox initialized']);
      } catch (error) {
        setTerminalOutput([
          '✗ Failed to initialize WebContainer',
          'Note: WebContainer requires COOP/COEP headers. Running in demo mode.',
        ]);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, []);

  const currentFile = selectedFile ? files.get(selectedFile) : null;

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
  };

  const handleFileChange = (content: string) => {
    if (selectedFile) {
      const updatedFile = { ...files.get(selectedFile)!, content };
      setFiles(new Map(files).set(selectedFile, updatedFile));
    }
  };

  const handleRun = async () => {
    if (!webcontainerRef.current) {
      setTerminalOutput((prev) => [...prev, '✗ WebContainer not available']);
      return;
    }

    setIsRunning(true);
    setTerminalOutput((prev) => [...prev, '$ npm start', '']);

    try {
      // First install dependencies
      await runCommand(webcontainerRef.current, 'npm install', (line) => {
        setTerminalOutput((prev) => [...prev, line]);
      });

      // Then run the script
      await runCommand(webcontainerRef.current, 'npm start', (line) => {
        setTerminalOutput((prev) => [...prev, line]);
      });
    } catch (error) {
      setTerminalOutput((prev) => [...prev, `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setIsRunning(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="sandbox-container">
        <div className="sandbox-header">
          <h1>Soroban Sandbox</h1>
        </div>
        <div className="placeholder">Initializing WebContainer...</div>
      </div>
    );
  }

  return (
    <div className="sandbox-container">
      <div className="sandbox-header">
        <h1>Soroban Sandbox</h1>
        <button onClick={handleRun} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Run'}
        </button>
      </div>

      <div className="sandbox-layout">
        <FileExplorer files={Array.from(files.values())} selectedFile={selectedFile} onSelectFile={handleFileSelect} />

        <div className="editor-section">
          {currentFile ? (
            <Editor file={currentFile} onChange={handleFileChange} />
          ) : (
            <div className="placeholder">Select a file to edit</div>
          )}
        </div>

        <div className="right-panel">
          <Preview />
          <Terminal output={terminalOutput} />
        </div>
      </div>
    </div>
  );
};

export default Sandbox;
