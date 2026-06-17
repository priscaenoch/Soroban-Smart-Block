import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

interface RwaMetadataProps {
  contractId: string;
}

export default function RwaMetadataDisplay({ contractId }: RwaMetadataProps) {
  const { data: rwaInfo, isLoading } = useQuery({
    queryKey: ["rwa-metadata", contractId],
    queryFn: () => api.rwaMetadata(contractId),
    enabled: !!contractId,
  });

  if (isLoading) {
    return null;
  }

  if (!rwaInfo?.is_rwa) {
    return null;
  }

  const typeLabel =
    {
      benji: "Franklin Templeton Benji",
      rwa: "Real-World Asset",
    }[rwaInfo.rwa_type || "rwa"] ||
    rwaInfo.rwa_type ||
    "RWA Token";

  return (
    <div
      style={{
        background: "rgba(59, 130, 246, 0.1)",
        border: "2px solid #3b82f6",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 20 }}>🏢</span>
      <div>
        <div style={{ color: "#1e40af", fontWeight: 700, fontSize: 14 }}>Real-World Asset (RWA) Token</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Type: {typeLabel}</div>
      </div>
    </div>
  );
}
