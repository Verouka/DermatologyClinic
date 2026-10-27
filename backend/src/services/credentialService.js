import { readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const credentialFile = fileURLToPath(
    new URL("../../Private/credential.json", import.meta.url)
);

// Read existing accounts
export async function getAccounts() {
    const content = await readFile(credentialFile, "utf8");
    const data = JSON.parse(content);

    if (!Array.isArray(data.accounts)) {
        throw new Error("Invalid credential file");
    }

    return data.accounts;
}

// Save a new account
export async function saveAccount(account) {
    const accounts = await getAccounts();

    const email = account.email.trim().toLowerCase();

    const exists = accounts.some(
        (user) => user.email === email
    );

    if (exists) {
        throw new Error("Account already exists");
    }

    const newAccount = {
        id: randomUUID(),
        email,
        role: account.role,
        patientId: account.patientId,
        passwordHash: account.passwordHash
    };

    accounts.push(newAccount);

    const temporaryFile = credentialFile + ".tmp";

    await writeFile(
        temporaryFile,
        JSON.stringify({ accounts }, null, 2),
        { encoding: "utf8", mode: 0o600 }
    );

    await rename(temporaryFile, credentialFile);

    return newAccount;
}