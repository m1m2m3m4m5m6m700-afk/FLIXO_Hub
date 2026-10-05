import { MVP_EXECUTABLE_TOOL_IDS } from '../src/config/manual-capability-definition.ts';
import { assertReadyToolsHaveOutputContracts } from '../src/lib/contracts/tool-output-contracts.ts';

assertReadyToolsHaveOutputContracts({ scopeIds: MVP_EXECUTABLE_TOOL_IDS });
console.log(`MVP_OUTPUT_CONTRACT_PARITY=PASS scope=${MVP_EXECUTABLE_TOOL_IDS.length}`);
