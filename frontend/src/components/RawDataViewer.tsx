import { useState } from "react";

interface RawDataViewerProps {
  data: any;
  label?: string;
}

export function RawDataViewer({ data, label = "Raw Data" }: RawDataViewerProps) {
  return (
    <div style={{ fontFamily: "monospace", fontSize: "0.9em" }}>
      <JsonNode value={data} name={label} isRoot />
    </div>
  );
}

interface JsonNodeProps {
  name: string;
  value: any;
  isRoot?: boolean;
}

function JsonNode({ name, value, isRoot = false }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(isRoot);

  if (value === null) {
    return (
      <div>
        <span style={{ color: "#999" }}>{name}: null</span>
      </div>
    );
  }

  if (value === undefined) {
    return (
      <div>
        <span style={{ color: "#999" }}>{name}: undefined</span>
      </div>
    );
  }

  const type = typeof value;

  if (type === "string") {
    return (
      <div>
        <span style={{ color: "#666" }}>{name}:</span> <span style={{ color: "#080" }}>"{value}"</span>
      </div>
    );
  }

  if (type === "number" || type === "bigint") {
    return (
      <div>
        <span style={{ color: "#666" }}>{name}:</span> <span style={{ color: "#05a" }}>{String(value)}</span>
      </div>
    );
  }

  if (type === "boolean") {
    return (
      <div>
        <span style={{ color: "#666" }}>{name}:</span> <span style={{ color: "#a50" }}>{String(value)}</span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div>
          <span style={{ color: "#666" }}>{name}:</span> []
        </div>
      );
    }
    return (
      <div>
        <div onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer", userSelect: "none" }}>
          <span style={{ marginRight: "4px" }}>{expanded ? "▼" : "▶"}</span>
          <span style={{ color: "#666" }}>{name}:</span> [{value.length}]
        </div>
        {expanded && (
          <div
            style={{
              marginLeft: "20px",
              borderLeft: "1px solid #ddd",
              paddingLeft: "8px",
            }}
          >
            {value.map((item, idx) => (
              <JsonNode key={idx} name={`[${idx}]`} value={item} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (type === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return (
        <div>
          <span style={{ color: "#666" }}>{name}:</span> {"{}"}
        </div>
      );
    }
    return (
      <div>
        <div onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer", userSelect: "none" }}>
          <span style={{ marginRight: "4px" }}>{expanded ? "▼" : "▶"}</span>
          <span style={{ color: "#666" }}>{name}:</span> {"{"}
          {keys.length}
          {"}"}
        </div>
        {expanded && (
          <div
            style={{
              marginLeft: "20px",
              borderLeft: "1px solid #ddd",
              paddingLeft: "8px",
            }}
          >
            {keys.map((key) => (
              <JsonNode key={key} name={key} value={value[key]} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <span style={{ color: "#666" }}>{name}:</span> {String(value)}
    </div>
  );
}
