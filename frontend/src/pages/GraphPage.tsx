import ContractDependencyGraph3D from "../components/ContractDependencyGraph3D";

export default function GraphPage() {
  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Live Contract Dependency Graph</h1>
      <ContractDependencyGraph3D />
    </div>
  );
}
