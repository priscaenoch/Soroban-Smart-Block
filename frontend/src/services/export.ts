import JSZip from "jszip";
import { SandboxFile } from "./webcontainer";

export async function exportAsZip(
  files: Map<string, SandboxFile>,
  _projectName: string = "soroban-sandbox",
): Promise<Blob> {
  const zip = new JSZip();

  for (const [, file] of files) {
    zip.file(file.path, file.content);
  }

  return zip.generateAsync({ type: "blob" });
}

export function downloadZip(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateSandboxId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function createShareableUrl(sandboxId: string): string {
  const origin = window.location.origin;
  return `${origin}/sandbox/${sandboxId}`;
}

export function copySandboxUrl(sandboxId: string): void {
  const url = createShareableUrl(sandboxId);
  navigator.clipboard.writeText(url).then(() => {
    console.log("Sandbox URL copied to clipboard:", url);
  });
}

export async function generateQRCode(text: string): Promise<string> {
  // Using qrcode.react would require adding dependency, so use canvas API
  // For production, use a library like qrcode.react or qr-code
  return text; // Placeholder
}
