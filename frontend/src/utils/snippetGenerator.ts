/**
 * Client SDK Snippet Generator
 * Issue #51: Client SDK Snippet Generator Utility
 */

export interface SnippetConfig {
  contractId: string;
  functionName: string;
  functionParams?: Array<{ name: string; type: string }>;
}

export function generateJavaScriptSnippet(config: SnippetConfig): string {
  const params = (config.functionParams || []).map((p) => p.name).join(", ");
  const paramTypes = (config.functionParams || [])
    .map((p) => `  ${p.name}, // ${p.type}`)
    .join("\n");

  return `import { Keypair, Client, StrKey, nativeToScval } from "@stellar/js-sdk";

const contractId = "${config.contractId}";
const server = new Client({ allowHttp: true, appName: "MyApp", appVersion: "1.0.0" });

async function invoke${
    config.functionName.charAt(0).toUpperCase() + config.functionName.slice(1)
  }(${params}) {
  const account = await server.getAccount(publicKey);
  
  const contractInvocation = new ContractInvocation({
    contractId,
    method: "${config.functionName}",
    args: [
${paramTypes ? paramTypes : "      // Add your parameters here"}
    ],
  });

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: "Test SDF Network",
  })
    .addOperation(contractInvocation)
    .setBaseFee("100")
    .setTimeout(30)
    .build();

  const signed = tx.sign(keypair);
  const result = await server.submitTransaction(signed);
  return result;
}`;
}

export function generateRustSnippet(config: SnippetConfig): string {
  const params = (config.functionParams || [])
    .map((p) => `${p.name}: ${p.type}`)
    .join(", ");

  return `use soroban_sdk::{contract, contractimpl, Env, Symbol, symbol_short};

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn invoke_external(env: Env) -> Result<i128, Error> {
        let contract_id = "${config.contractId}";
        let contract = ContractClient::new(&env, &ContractId::from_contract_id(contract_id));
        
        contract.${config.functionName}(&${params || "// params"})
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invoke() {
        let env = Env::default();
        // Test implementation
    }
}`;
}

export function generateTypeScriptSnippet(config: SnippetConfig): string {
  return `import { Client, Contract } from "@stellar/js-sdk";

interface ${config.functionName.charAt(0).toUpperCase() + config.functionName.slice(1)}Params {
${(config.functionParams || []).map((p) => `  ${p.name}: ${p.type};`).join("\n")}
}

async function invoke${
    config.functionName.charAt(0).toUpperCase() + config.functionName.slice(1)
  }(params: ${config.functionName.charAt(0).toUpperCase() + config.functionName.slice(1)}Params): Promise<any> {
  const contract = new Contract("${config.contractId}");
  
  const result = await contract.${config.functionName}(
${(config.functionParams || []).map((p) => `    params.${p.name}`).join(",\n")}
  );
  
  return result;
}`;
}
