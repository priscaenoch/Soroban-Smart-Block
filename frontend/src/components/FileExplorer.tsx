import React from "react";

interface FileExplorerProps {
  files: Array<{ path: string; content: string; language: string }>;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ files, selectedFile, onSelectFile }) => {
  const groupedFiles = files.reduce(
    (acc, file) => {
      const parts = file.path.split("/");
      const filename = parts[parts.length - 1];
      const dir = parts.slice(0, -1).join("/") || "/";
      if (!acc[dir]) acc[dir] = [];
      acc[dir].push({ ...file, filename });
      return acc;
    },
    {} as Record<string, any[]>,
  );

  return (
    <div className="file-explorer">
      <div className="explorer-header">Explorer</div>
      {Object.entries(groupedFiles).map(([dir, dirFiles]) => (
        <div key={dir}>
          <div className="explorer-folder">{dir}</div>
          {dirFiles.map((file) => (
            <div
              key={file.path}
              className={`explorer-file ${selectedFile === file.path ? "selected" : ""}`}
              onClick={() => onSelectFile(file.path)}
            >
              {file.filename}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default FileExplorer;
