
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = await scryptAsync(password, salt, 64);

    return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(":");

    const storedKey = Buffer.from(hash, "hex");
    const derivedKey = await scryptAsync(password, salt, storedKey.length);

    return timingSafeEqual(storedKey, derivedKey);
}