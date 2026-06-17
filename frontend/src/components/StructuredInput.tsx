/**
 * StructuredInput.tsx
 *
 * Renders a form input for a Soroban contract parameter whose type is a
 * custom struct, enum, or union defined in the contract ABI.
 *
 * - Struct: renders one labelled sub-field per struct field
 * - Enum:   renders a <select> with the named variant options
 * - Union:  renders a <select> for the variant tag plus optional payload fields
 * - Primitives: delegates to a plain <input>
 *
 * The component calls onChange with a JSON-serialisable value that the
 * WriteContract component can pass to nativeToScVal / toScVal.
 */

import type { SpecType } from "../api";
import type { TypeIndex } from "./StructuredValue";

// ── Primitive type helpers ────────────────────────────────────────────────────

function primitiveInputType(type: string): string {
  const t = type.toLowerCase();
  if (t === "bool") return "checkbox";
  if (t.includes("int") || ["u32", "i32", "u64", "i64", "u128", "i128", "u256", "i256"].includes(t)) return "number";
  return "text";
}

// ── Main component ────────────────────────────────────────────────────────────

interface StructuredInputProps {
  /** ABI type string, e.g. "MyStruct", "MyEnum", "u128", "Address" */
  type: string;
  /** Current value (JSON-serialisable) */
  value: unknown;
  /** Called whenever the value changes */
  onChange: (value: unknown) => void;
  /** Map of all custom types from the contract spec */
  typeIndex: TypeIndex;
  /** Optional label prefix for nested fields */
  label?: string;
}

export default function StructuredInput({ type, value, onChange, typeIndex, label }: StructuredInputProps) {
  const typeDef = typeIndex.get(type);

  // ── Struct ────────────────────────────────────────────────────────────────
  if (typeDef?.kind === "struct") {
    return (
      <StructInput
        typeDef={typeDef}
        value={value as Record<string, unknown> | null}
        onChange={onChange}
        typeIndex={typeIndex}
        label={label ?? type}
      />
    );
  }

  // ── Enum ──────────────────────────────────────────────────────────────────
  if (typeDef?.kind === "enum" || typeDef?.kind === "error_enum") {
    return <EnumInput typeDef={typeDef} value={value as number | null} onChange={onChange} label={label ?? type} />;
  }

  // ── Union ─────────────────────────────────────────────────────────────────
  if (typeDef?.kind === "union") {
    return (
      <UnionInput
        typeDef={typeDef}
        value={value as { variant: string; data?: unknown } | null}
        onChange={onChange}
        typeIndex={typeIndex}
        label={label ?? type}
      />
    );
  }

  // ── Primitive / unknown type ──────────────────────────────────────────────
  return (
    <PrimitiveInput type={type} value={value as string | boolean | null} onChange={onChange} label={label ?? type} />
  );
}

// ── Struct input ──────────────────────────────────────────────────────────────

interface StructInputProps {
  typeDef: SpecType;
  value: Record<string, unknown> | null;
  onChange: (value: Record<string, unknown>) => void;
  typeIndex: TypeIndex;
  label: string;
}

function StructInput({ typeDef, value, onChange, typeIndex, label }: StructInputProps) {
  const fields = typeDef.fields ?? [];
  const current = value ?? {};

  function handleFieldChange(fieldName: string, fieldValue: unknown) {
    onChange({ ...current, [fieldName]: fieldValue });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
        {label} <span style={{ color: "var(--accent)", fontWeight: 400 }}>({typeDef.name})</span>
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          paddingLeft: 12,
          borderLeft: "2px solid var(--border)",
        }}
      >
        {fields.map((field) => (
          <div key={field.name} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 11, color: "var(--muted)" }}>
              {field.name} <span style={{ color: "var(--accent)" }}>({field.type})</span>
            </label>
            <StructuredInput
              type={field.type}
              value={current[field.name] ?? null}
              onChange={(v) => handleFieldChange(field.name, v)}
              typeIndex={typeIndex}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Enum input ────────────────────────────────────────────────────────────────

interface EnumInputProps {
  typeDef: SpecType;
  value: number | null;
  onChange: (value: number) => void;
  label: string;
}

function EnumInput({ typeDef, value, onChange, label }: EnumInputProps) {
  const cases = typeDef.cases ?? [];
  const selected = value ?? cases[0]?.value ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>
        {label} <span style={{ color: "var(--accent)" }}>({typeDef.name})</span>
      </span>
      <select value={selected} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%" }}>
        {cases.map((c) => (
          <option key={c.name} value={c.value ?? 0}>
            {c.name} ({c.value ?? 0})
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Union input ───────────────────────────────────────────────────────────────

interface UnionValue {
  variant: string;
  data?: unknown;
}

interface UnionInputProps {
  typeDef: SpecType;
  value: UnionValue | null;
  onChange: (value: UnionValue) => void;
  typeIndex: TypeIndex;
  label: string;
}

function UnionInput({ typeDef, value, onChange, typeIndex, label }: UnionInputProps) {
  const cases = typeDef.cases ?? [];
  const selectedVariant = value?.variant ?? cases[0]?.name ?? "";
  const matchedCase = cases.find((c) => c.name === selectedVariant);
  const payloadTypes = matchedCase?.types ?? [];

  function handleVariantChange(variant: string) {
    onChange({ variant, data: undefined });
  }

  function handleDataChange(data: unknown) {
    onChange({ variant: selectedVariant, data });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>
        {label} <span style={{ color: "var(--accent)" }}>({typeDef.name})</span>
      </span>
      <select value={selectedVariant} onChange={(e) => handleVariantChange(e.target.value)} style={{ width: "100%" }}>
        {cases.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Render payload fields for tuple variants */}
      {payloadTypes.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            paddingLeft: 12,
            borderLeft: "2px solid var(--border)",
          }}
        >
          {payloadTypes.length === 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "var(--muted)" }}>
                data <span style={{ color: "var(--accent)" }}>({payloadTypes[0]})</span>
              </label>
              <StructuredInput
                type={payloadTypes[0]}
                value={(value?.data as unknown) ?? null}
                onChange={handleDataChange}
                typeIndex={typeIndex}
              />
            </div>
          ) : (
            payloadTypes.map((pt, i) => {
              const dataArr = Array.isArray(value?.data) ? (value!.data as unknown[]) : [];
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <label style={{ fontSize: 11, color: "var(--muted)" }}>
                    [{i}] <span style={{ color: "var(--accent)" }}>({pt})</span>
                  </label>
                  <StructuredInput
                    type={pt}
                    value={dataArr[i] ?? null}
                    onChange={(v) => {
                      const next = [...dataArr];
                      next[i] = v;
                      handleDataChange(next);
                    }}
                    typeIndex={typeIndex}
                  />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Primitive input ───────────────────────────────────────────────────────────

interface PrimitiveInputProps {
  type: string;
  value: string | boolean | null;
  onChange: (value: string | boolean) => void;
  label: string;
}

function PrimitiveInput({ type, value, onChange, label }: PrimitiveInputProps) {
  const inputKind = primitiveInputType(type);

  if (inputKind === "checkbox") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={value === true || value === "true"}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      </div>
    );
  }

  return (
    <input
      type={inputKind}
      placeholder={`${label} (${type})`}
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%" }}
    />
  );
}
