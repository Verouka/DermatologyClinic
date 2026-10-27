
import { getAccounts } from "./services/credentialService.js";

const accounts = await getAccounts();

console.log("Stored accounts:", accounts);