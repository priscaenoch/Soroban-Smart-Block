import { WebContainer } from "@webcontainer/api";

export interface SandboxFile {
  path: string;
  content: string;
  language: string;
}

export interface FileSystemTree {
  [key: string]: {
    file?: { contents: string };
    directory?: FileSystemTree;
  };
}

export const NODE_SDK_TEMPLATE: Record<string, SandboxFile> = {
  "src/index.js": {
    path: "src/index.js",
    language: "javascript",
    content: `import { SorobanExplorer } from 'soroban-explorer-sdk';
import dotenv from 'dotenv';

dotenv.config();

const explorer = new SorobanExplorer({
  network: 'testnet',
  rpcUrl: process.env.SOROBAN_RPC_URL,
});

console.log('Starting Soroban Event Listener...');
console.log('Connecting to testnet...');

explorer.on('event', (event) => {
  console.log('Event received:', {
    type: event.type,
    contract: event.contractId,
    function: event.functionName,
    data: event.data,
  });
});

explorer.on('error', (err) => {
  console.error('Error:', err.message);
});

console.log('Listening for events...');
await explorer.start();
`,
  },
  "package.json": {
    path: "package.json",
    language: "json",
    content: `{
  "name": "soroban-explorer-demo",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "soroban-explorer-sdk": "0.2.0",
    "dotenv": "16.4.5"
  }
}
`,
  },
  ".env": {
    path: ".env",
    language: "plaintext",
    content: `SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
EXPLORER_CONTRACT_ID=CABCD1234567890ABCD1234567890ABCD1234567890ABCD1234567890ABC
`,
  },
};

export async function initWebContainer(): Promise<WebContainer> {
  try {
    const container = await WebContainer.boot();
    console.log("WebContainer initialized");
    return container;
  } catch (error) {
    console.error("Failed to initialize WebContainer:", error);
    throw error;
  }
}

export async function mountFiles(container: WebContainer, files: Map<string, SandboxFile>): Promise<void> {
  const tree: FileSystemTree = {};

  for (const [, file] of files) {
    const parts = file.path.split("/").filter(Boolean);
    let current = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { directory: {} };
      }
      current = (current[part].directory as FileSystemTree) || {};
    }

    const lastPart = parts[parts.length - 1];
    current[lastPart] = { file: { contents: file.content } };
  }

  await container.mount(tree as any);
}

export async function runCommand(
  container: WebContainer,
  command: string,
  onOutput: (line: string) => void,
): Promise<number> {
  const [cmd, ...args] = command.split(" ");
  const process = await container.spawn(cmd, args);

  let exitCode = 0;

  process.output.pipeTo(
    new WritableStream<string>({
      write(chunk) {
        onOutput(chunk);
      },
    }),
  );

  exitCode = await process.exit;
  return exitCode;
}
