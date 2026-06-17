export interface PackageNode {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  vulnerabilities?: Array<{
    id: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
  }>;
}

interface DependencyTree {
  [key: string]: PackageNode;
}

// Parse package.json to extract dependencies
export function parseDependencies(packageJson: string): Record<string, string> {
  try {
    const parsed = JSON.parse(packageJson);
    return {
      ...parsed.dependencies,
      ...parsed.devDependencies,
    };
  } catch {
    return {};
  }
}

// Mock vulnerability database (in production, would query a real DB)
const KNOWN_VULNERABILITIES: Record<string, any[]> = {
  lodash: [
    {
      id: "npm-lodash-1",
      severity: "high",
      title: "Prototype Pollution in defaultsDeep",
      versions: "<4.17.21",
    },
  ],
  express: [
    {
      id: "npm-express-1",
      severity: "medium",
      title: "Open Redirect vulnerability",
      versions: "<4.19.0",
    },
  ],
};

export async function fetchVulnerabilities(
  packageName: string,
  version: string,
): Promise<Array<{ id: string; severity: string; title: string }>> {
  // In production, call a real API like npm audit, Snyk, or safety-db
  const vulnerabilities = KNOWN_VULNERABILITIES[packageName] || [];

  return vulnerabilities
    .filter((vuln) => {
      // Simple version comparison (in production, use semver)
      return version.replace(/^[^0-9]/, "") < (vuln.versions.replace(/^</, "") || "999.999.999");
    })
    .map((vuln) => ({
      id: vuln.id,
      severity: vuln.severity,
      title: vuln.title,
    }));
}

export async function buildDependencyTree(dependencies: Record<string, string>): Promise<DependencyTree> {
  const tree: DependencyTree = {};

  for (const [name, version] of Object.entries(dependencies)) {
    const vulnerabilities = await fetchVulnerabilities(name, version);

    tree[name] = {
      name,
      version,
      vulnerabilities:
        vulnerabilities.length > 0
          ? (vulnerabilities as Array<{
              id: string;
              severity: "medium" | "critical" | "high" | "low";
              title: string;
            }>)
          : undefined,
    };
  }

  return tree;
}

export function calculateBundleSize(dependencies: Record<string, string>): string {
  // Rough estimation based on common package sizes
  const sizes: Record<string, number> = {
    react: 42,
    vue: 33,
    angular: 80,
    lodash: 71,
    moment: 64,
    "@stellar/stellar-sdk": 250,
  };

  let total = 0;
  for (const [name] of Object.entries(dependencies)) {
    total += sizes[name] || 50; // Default 50KB per package
  }

  return total > 1024 ? `${(total / 1024).toFixed(1)} MB` : `${total} KB`;
}
