import React, { useState } from "react";
import DependencyVisualizer from "./DependencyVisualizer";

interface PreviewProps {
  packageJsonContent?: string;
}

const Preview: React.FC<PreviewProps> = ({ packageJsonContent = "" }) => {
  const [showDeps, setShowDeps] = useState(false);

  return (
    <div className="preview">
      <div className="preview-header">
        <span>Preview</span>
        <button className="preview-toggle" onClick={() => setShowDeps(!showDeps)} title="Toggle dependency visualizer">
          📦
        </button>
      </div>
      <div className="preview-content">
        {showDeps ? (
          <DependencyVisualizer packageJsonContent={packageJsonContent} isVisible={showDeps} />
        ) : (
          <>
            <div className="contract-events">
              <h3>Live Events</h3>
              <div className="event-item">• swap 100 USDC → 98.7 XLM</div>
              <div className="event-item">• mint 1000 TOKEN</div>
            </div>
            <button className="action-btn">Run</button>
            <button className="action-btn">Stop</button>
          </>
        )}
      </div>
    </div>
  );
};

export default Preview;
