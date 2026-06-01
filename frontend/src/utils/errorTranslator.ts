/**
 * Error Code to Human-Friendly Message Mapper
 * Issue #49: Human-Friendly Error State Explainer UI
 */

const ERROR_DICTIONARY: Record<string, string> = {
  "102": "Execution Failed: Out of Gas",
  "103": "Execution Failed: Unauthorized Access",
  "104": "Execution Failed: Invalid Input",
  "105": "Execution Failed: Contract Not Found",
  "106": "Execution Failed: Invalid Ledger",
  "107": "Execution Failed: Resource Limit Exceeded",
  "108": "Execution Failed: Assertion Failed",
  "109": "Execution Failed: Runtime Panic",
  "110": "Execution Failed: Invalid Operation",
};

export interface ParsedError {
  code: string;
  category: string;
  message: string;
  raw: string;
}

export function translateError(error: string): ParsedError {
  // Try to extract error code
  const codeMatch = error.match(/Error\((\w+),\s*(\d+)\)/);
  
  if (codeMatch) {
    const [, category, code] = codeMatch;
    const message = ERROR_DICTIONARY[code] || `Execution Failed: Unknown Error (${code})`;
    return { code, category, message, raw: error };
  }

  return {
    code: "unknown",
    category: "unknown",
    message: error || "An unknown error occurred",
    raw: error,
  };
}

export function getErrorSeverity(code: string): "critical" | "warning" | "info" {
  const criticalCodes = ["102", "105", "107"];
  const warningCodes = ["103", "104", "108", "109"];
  
  if (criticalCodes.includes(code)) return "critical";
  if (warningCodes.includes(code)) return "warning";
  return "info";
}
