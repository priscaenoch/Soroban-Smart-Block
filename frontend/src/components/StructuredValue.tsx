/**
 * StructuredValue.tsx
 *
 * Renders a decoded Soroban ScVal as a structured JSON object using ABI type
 * information to display proper field names for structs, variant names for
 * enums/unions, and recursive expansion for nested types.
 *
 * When no type information is available it falls back to the generic
 * RawDataViewer rendering.
 */

import { useState } from "react";
import type { SpecType } from "../api";

// ── Type index helpers ────────────────────────────────────────────────────────

export type TypeIndex = Map<string, SpecType>;

export function buildTypeIndex(types: SpecType[]): TypeIndex {
  const index = new Map<string, SpecType>();
  for (const t of types ?? []) {
    if (t.name) index.set(t.name, t);
  }
  return index;
}

// ── Value annotation ──────────────────────────────────────────────────────────

/**
 * Annotate a raw decoded value (from scValToJs) with proper field names and
 * variant labels using the ABI type index.
 *
 * The raw value coming from the backend is already decoded by scValToJs, so:
 *   - structs arrive as plain objects (ScvMap) or arrays (ScvVec tuple struct)
 *   - enums arrive as numbers (ScvU32)
 *   - unions arrive as arrays where [0] is the variant symbol string
 *
 * This function re-annotates them using the type definitions.
 */
export function annotateValue(value: unknown, typeHint: string | null | undefined, typeIndex: TypeIndex): unknown {
  if (value === null || value === undefined) return value;
  if (!typeHint || typeIndex.size === 0) return value;

  const typeDef = typeIndex.get(typeHint);
  if (!typeDef) return value;

  // ── Struct ────────────────────────────────────────────────────────────────
  if (typeDef.kind === "struct") {
    const fields = typeDef.fields ?? [];

    // Named struct: already an object from ScvMap — annotate field values
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const field of fields) {
        const raw = obj[field.name];
        result[field.name] = annotateValue(raw, field.type, typeIndex);
      }
      // Preserve any extra keys not in the spec (defensive)
      for (const key of Object.keys(obj)) {
        if (!(key in result)) result[key] = obj[key];
      }
      return result;
    }

    // Tuple struct: arrives as an array — map positionally to field names
    if (Array.isArray(value) && fields.length > 0 && value.length === fields.length) {
      const result: Record<string, unknown> = {};
      fields.forEach((field, i) => {
        result[field.name] = annotateValue(value[i], field.type, typeIndex);
      });
      return result;
    }

    return value;
  }

  // ── Enum (integer discriminant) ───────────────────────────────────────────
  if (typeDef.kind === "enum") {
    if (typeof value === "number") {
      const matchedCase = typeDef.cases?.find((c) => c.value === value);
      return {
        _type: typeHint,
        variant: matchedCase?.name ?? `Unknown(${value})`,
        value,
      };
    }
    return value;
  }

  // ── Union (tagged variant) ────────────────────────────────────────────────
  if (typeDef.kind === "union") {
    // Arrives as an array: [variantSymbol, ...payloadItems]
    if (Array.isArray(value) && value.length >= 1) {
      const tag = String(value[0]);
      const matchedCase = typeDef.cases?.find((c) => c.name === tag);
      const payloadTypes = matchedCase?.types ?? [];
      const payloadItems = value.slice(1);

      if (payloadItems.length === 0) {
        return { _type: typeHint, variant: tag };
      }

      const annotatedPayload = payloadItems.map((item, i) => annotateValue(item, payloadTypes[i] ?? null, typeIndex));

      return {
        _type: typeHint,
        variant: tag,
        data: annotatedPayload.length === 1 ? annotatedPayload[0] : annotatedPayload,
      };
    }

    // Bare symbol (void variant)
    if (typeof value === "string") {
      return { _type: typeHint, variant: value };
    }

    return value;
  }

  // ── error_enum ────────────────────────────────────────────────────────────
  if (typeDef.kind === "error_enum") {
    if (typeof value === "number") {
      const matchedCase = typeDef.cases?.find((c) => c.value === value);
      return {
        _type: typeHint,
        error: matchedCase?.name ?? `Unknown(${value})`,
        code: value,
      };
    }
    return value;
  }

  return value;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

interface StructuredValueProps {
  value: unknown;
  typeHint?: string | null;
  typeIndex?: TypeIndex;
  label?: string;
}

/**
 * Top-level component. Annotates the value with type info then renders it.
 */
export default function StructuredValue({
  value,
  typeHint,
  typeIndex = new Map(),
  label = "result",
}: StructuredValueProps) {
  const annotated = annotateValue(value, typeHint ?? null, typeIndex);
  return (
    <div style={{ fontFamily: "monospace", fontSize: "0.85em", lineHeight: 1.6 }}>
      <ValueNode value={annotated} name={label} isRoot />
    </div>
  );
}

// ── Internal tree node ────────────────────────────────────────────────────────

interface ValueNodeProps {
  name: string;
  value: unknown;
  isRoot?: boolean;
}

function ValueNode({ name, value, isRoot = false }: ValueNodeProps) {
  const [expanded, setExpanded] = useState(isRoot || depth(value) <= 1);

  if (value === null || value === undefined) {
    return (
      <div>
        <span style={{ color: "var(--muted, #888)" }}>{name}:</span>{" "}
        <span style={{ color: "var(--muted, #888)" }}>null</span>
      </div>
    );
  }

  const t = typeof value;

  if (t === "string") {
    return (
      <div>
        <span style={{ color: "var(--muted, #888)" }}>{name}:</span>{" "}
        <span style={{ color: "var(--green, #3fb950)" }}>"{value as string}"</span>
      </div>
    );
  }

  if (t === "number" || t === "bigint") {
    return (
      <div>
        <span style={{ color: "var(--muted, #888)" }}>{name}:</span>{" "}
        <span style={{ color: "#79c0ff" }}>{String(value)}</span>
      </div>
    );
  }

  if (t === "boolean") {
    return (
      <div>
        <span style={{ color: "var(--muted, #888)" }}>{name}:</span>{" "}
        <span style={{ color: "#f0883e" }}>{String(value)}</span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div>
          <span style={{ color: "var(--muted, #888)" }}>{name}:</span> []
        </div>
      );
    }
    // Render fixed-size tuples of primitives inline: [100, 250]
    const allPrimitive = value.every((v) => v !== null && typeof v !== "object");
    if (allPrimitive) {
      return (
        <div>
          <span style={{ color: "var(--muted, #888)" }}>{name}:</span>{" "}
          <span style={{ color: "#79c0ff" }}>[{value.join(", ")}]</span>
        </div>
      );
    }
    return (
      <div>
        <div onClick={() => setExpanded((e) => !e)} style={{ cursor: "pointer", userSelect: "none" }}>
          <span style={{ marginRight: 4, color: "var(--accent, #58a6ff)" }}>{expanded ? "▼" : "▶"}</span>
          <span style={{ color: "var(--muted, #888)" }}>{name}:</span>{" "}
          <span style={{ color: "var(--muted, #888)" }}>[{value.length}]</span>
        </div>
        {expanded && (
          <div
            style={{
              marginLeft: 16,
              borderLeft: "1px solid var(--border, #30363d)",
              paddingLeft: 8,
            }}
          >
            {value.map((item, idx) => (
              <ValueNode key={idx} name={`[${idx}]`} value={item} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    // Special rendering for annotated enum/union variants
    if ("_type" in obj && "variant" in obj) {
      const isError = "error" in obj;
      const variantColor = isError ? "#f85149" : "var(--accent, #58a6ff)";
      const hasData = "data" in obj;
      const hasValue = "value" in obj && !hasData;

      return (
        <div>
          <div
            onClick={() => hasData && setExpanded((e) => !e)}
            style={{
              cursor: hasData ? "pointer" : "default",
              userSelect: "none",
            }}
          >
            {hasData && <span style={{ marginRight: 4, color: "var(--accent, #58a6ff)" }}>{expanded ? "▼" : "▶"}</span>}
            <span style={{ color: "var(--muted, #888)" }}>{name}:</span>{" "}
            <span style={{ color: variantColor }}>
              {isError ? `Error::${obj.error}` : `${obj._type}::${obj.variant}`}
            </span>
            {hasValue && <span style={{ color: "#79c0ff", marginLeft: 6 }}>({String(obj.value ?? obj.code)})</span>}
          </div>
          {hasData && expanded && (
            <div
              style={{
                marginLeft: 16,
                borderLeft: "1px solid var(--border, #30363d)",
                paddingLeft: 8,
              }}
            >
              <ValueNode name="data" value={obj.data} />
            </div>
          )}
        </div>
      );
    }

    if (keys.length === 0) {
      return (
        <div>
          <span style={{ color: "var(--muted, #888)" }}>{name}:</span> {"{}"}
        </div>
      );
    }

    return (
      <div>
        <div onClick={() => setExpanded((e) => !e)} style={{ cursor: "pointer", userSelect: "none" }}>
          <span style={{ marginRight: 4, color: "var(--accent, #58a6ff)" }}>{expanded ? "▼" : "▶"}</span>
          <span style={{ color: "var(--muted, #888)" }}>{name}:</span>{" "}
          <span style={{ color: "var(--muted, #888)" }}>
            {"{"}…{"}"}
          </span>
        </div>
        {expanded && (
          <div
            style={{
              marginLeft: 16,
              borderLeft: "1px solid var(--border, #30363d)",
              paddingLeft: 8,
            }}
          >
            {keys.map((key) => (
              <ValueNode key={key} name={key} value={obj[key]} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <span style={{ color: "var(--muted, #888)" }}>{name}:</span> {String(value)}
    </div>
  );
}

/** Rough depth estimate to decide default expansion */
function depth(val: unknown): number {
  if (val === null || val === undefined || typeof val !== "object") return 0;
  if (Array.isArray(val)) return 1 + Math.max(0, ...val.map(depth));
  const keys = Object.keys(val as object);
  if (keys.length === 0) return 0;
  return 1 + Math.max(0, ...keys.map((k) => depth((val as Record<string, unknown>)[k])));
}
