import React, { useState, useEffect } from "react";
import { parseDependencies, buildDependencyTree, calculateBundleSize } from "../services/dependencies";
import "../styles/DependencyVisualizer.css";

interface DependencyVisualizerProps {
  packageJsonContent: string;
  isVisible: boolean;
}

const DependencyVisualizer: React.FC<DependencyVisualizerProps> = ({ packageJsonContent, isVisible }) => {
  const [deps, setDeps] = useState<Record<string, any>>({});
  const [bundleSize, setBundleSize] = useState("0 KB");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isVisible || !packageJsonContent) return;

    const analyze = async () => {
      setLoading(true);
      try {
        const parsed = parseDependencies(packageJsonContent);
        const tree = await buildDependencyTree(parsed);
        const size = calculateBundleSize(parsed);

        setDeps(tree);
        setBundleSize(size);
      } catch (error) {
        console.error("Failed to analyze dependencies:", error);
      } finally {
        setLoading(false);
      }
    };

    analyze();
  }, [packageJsonContent, isVisible]);

  if (!isVisible) return null;

  const criticalVulns = Object.values(deps).filter((d: any) =>
    d.vulnerabilities?.some((v: any) => v.severity === "critical"),
  );

  const highVulns = Object.values(deps).filter((d: any) => d.vulnerabilities?.some((v: any) => v.severity === "high"));

  return (
    <div className="dependency-visualizer">
      <div className="dep-header">
        <h3>Dependencies ({Object.keys(deps).length})</h3>
        <div className="dep-stats">
          <span className="stat critical">{criticalVulns.length} critical</span>
          <span className="stat high">{highVulns.length} high</span>
          <span className="stat size">Size: {bundleSize}</span>
        </div>
      </div>

      {loading && <div className="dep-loading">Analyzing...</div>}

      <div className="dep-tree">
        {Object.entries(deps).map(([name, dep]: [string, any]) => (
          <div key={name} className="dep-item">
            <div className="dep-name">
              {dep.vulnerabilities?.length > 0 && (
                <span className={`vuln-badge ${dep.vulnerabilities[0]?.severity || "info"}`}>⚠</span>
              )}
              <span>{name}</span>
              <span className="dep-version">@{dep.version}</span>
            </div>

            {dep.vulnerabilities && dep.vulnerabilities.length > 0 && (
              <div className="dep-vulns">
                {dep.vulnerabilities.map((v: any) => (
                  <div key={v.id} className={`vuln ${v.severity}`}>
                    <strong>{v.severity.toUpperCase()}</strong>: {v.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DependencyVisualizer;
