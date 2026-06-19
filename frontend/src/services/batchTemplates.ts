import { BatchCall, BatchTemplate } from "../types/batch";

export const BATCH_TEMPLATES: Record<string, BatchTemplate> = {
  "dex-swap": {
    id: "dex-swap",
    name: "DEX Swap",
    description: "Swap one token for another through a DEX pair contract",
    icon: "🔄",
    calls: [
      {
        id: "swap-call",
        contractId: "{{router_contract}}",
        functionName: "swap",
        args: [
          { name: "token_in", value: "{{token_in}}", type: "address" },
          { name: "token_out", value: "{{token_out}}", type: "address" },
          { name: "amount_in", value: "{{amount_in}}", type: "i128" },
        ],
      },
    ],
    parameters: [
      { name: "router_contract", type: "contract", placeholder: "Router contract ID", required: true },
      { name: "token_in", type: "address", placeholder: "Input token contract", required: true },
      { name: "token_out", type: "address", placeholder: "Output token contract", required: true },
      { name: "amount_in", type: "amount", placeholder: "Amount to swap", required: true },
    ],
  },
  "nft-mint-list": {
    id: "nft-mint-list",
    name: "NFT Mint + List",
    description: "Mint an NFT and immediately list it for sale (atomic)",
    icon: "🎨",
    calls: [
      {
        id: "nft-mint",
        contractId: "{{nft_contract}}",
        functionName: "mint",
        args: [
          { name: "to", value: "{{recipient}}", type: "address" },
          { name: "name", value: "{{name}}", type: "string" },
          { name: "uri", value: "{{uri}}", type: "string" },
        ],
      },
      {
        id: "nft-approve",
        contractId: "{{nft_contract}}",
        functionName: "approve",
        args: [
          { name: "operator", value: "{{marketplace_contract}}", type: "address" },
          { name: "id", value: "output:nft-mint:token_id", type: "u32" },
        ],
      },
      {
        id: "nft-list",
        contractId: "{{marketplace_contract}}",
        functionName: "list",
        args: [
          { name: "seller", value: "{{recipient}}", type: "address" },
          { name: "token_id", value: "output:nft-mint:token_id", type: "u32" },
          { name: "price", value: "{{price}}", type: "i128" },
        ],
      },
    ],
    parameters: [
      { name: "nft_contract", type: "contract", placeholder: "NFT contract ID", required: true },
      { name: "marketplace_contract", type: "contract", placeholder: "Marketplace contract ID", required: true },
      { name: "recipient", type: "address", placeholder: "Recipient address", required: true },
      { name: "name", type: "string", placeholder: "NFT name", required: true },
      { name: "uri", type: "string", placeholder: "Token URI", required: true },
      { name: "price", type: "amount", placeholder: "List price", required: true },
    ],
  },
  "lp-add-remove": {
    id: "lp-add-remove",
    name: "LP Add/Remove Liquidity",
    description: "Add liquidity to a pool and return LP tokens",
    icon: "💧",
    calls: [
      {
        id: "lp-deposit",
        contractId: "{{lp_contract}}",
        functionName: "deposit",
        args: [
          { name: "token_a", value: "{{token_a}}", type: "address" },
          { name: "token_b", value: "{{token_b}}", type: "address" },
          { name: "amount_a", value: "{{amount_a}}", type: "i128" },
          { name: "amount_b", value: "{{amount_b}}", type: "i128" },
        ],
      },
    ],
    parameters: [
      { name: "lp_contract", type: "contract", placeholder: "LP contract ID", required: true },
      { name: "token_a", type: "address", placeholder: "First token", required: true },
      { name: "token_b", type: "address", placeholder: "Second token", required: true },
      { name: "amount_a", type: "amount", placeholder: "Amount A", required: true },
      { name: "amount_b", type: "amount", placeholder: "Amount B", required: true },
    ],
  },
  "stake-unstake": {
    id: "stake-unstake",
    name: "Stake + Unstake",
    description: "Delegate to a validator and undelegate after some time",
    icon: "⚡",
    calls: [
      {
        id: "stake",
        contractId: "{{staking_contract}}",
        functionName: "stake",
        args: [
          { name: "amount", value: "{{stake_amount}}", type: "i128" },
          { name: "validator", value: "{{validator}}", type: "address" },
        ],
      },
    ],
    parameters: [
      { name: "staking_contract", type: "contract", placeholder: "Staking contract ID", required: true },
      { name: "stake_amount", type: "amount", placeholder: "Amount to stake", required: true },
      { name: "validator", type: "address", placeholder: "Validator address", required: true },
    ],
  },
  "multi-transfer": {
    id: "multi-transfer",
    name: "Multi-Transfer",
    description: "Batch transfer tokens to multiple recipients",
    icon: "📤",
    calls: [],
    parameters: [
      { name: "token_contract", type: "contract", placeholder: "Token contract ID", required: true },
    ],
  },
  "auction-bid-withdraw": {
    id: "auction-bid-withdraw",
    name: "Auction Bid + Withdraw",
    description: "Place a bid in an auction and allow withdraw on failure",
    icon: "🏛️",
    calls: [
      {
        id: "auction-bid",
        contractId: "{{auction_contract}}",
        functionName: "bid",
        args: [
          { name: "bid_amount", value: "{{bid_amount}}", type: "i128" },
        ],
      },
    ],
    parameters: [
      { name: "auction_contract", type: "contract", placeholder: "Auction contract ID", required: true },
      { name: "bid_amount", type: "amount", placeholder: "Bid amount", required: true },
    ],
  },
};

export function getBatchTemplate(id: string): BatchTemplate | undefined {
  return BATCH_TEMPLATES[id];
}

export function listBatchTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  icon?: string;
}> {
  return Object.entries(BATCH_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
    description: template.description,
    icon: template.icon,
  }));
}

export function fillTemplateParameters(
  template: BatchTemplate,
  values: Record<string, string>,
): BatchCall[] {
  const result: BatchCall[] = [];
  
  for (const call of template.calls) {
    const filledCall: BatchCall = {
      ...call,
      contractId: call.contractId.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || ""),
      args: call.args.map((arg) => ({
        ...arg,
        value: arg.value.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || ""),
      })),
    };
    result.push(filledCall);
  }
  
  return result;
}