
import { randomBytes } from "node:crypto";

const sessions = new Map();
const SESSION_DURATION = 60 * 60 * 1000;

export function createSession(user) {
    const token = randomBytes(32).toString("hex");

    sessions.set(token, {
        ...user,
        expiresAt: Date.now() + SESSION_DURATION
    });

    return token;
}

export function getSession(req) {
    const cookies = req.headers.cookie || "";

    const sessionCookie = cookies.split(";").map(c => c.trim())
        .find(c => c.startsWith("clinic_session="));

    if (!sessionCookie) return null;

    const token = sessionCookie.substring("clinic_session=".length);
    const session = sessions.get(token);

    if (!session) return null;

    if (Date.now() >= session.expiresAt) {
        sessions.delete(token);
        return null;
    }

    return session;
}

export function deleteSession(req) {
    const cookies = req.headers.cookie || "";

    const sessionCookie = cookies.split(";").map(c => c.trim())
        .find(c => c.startsWith("clinic_session="));

    if (sessionCookie) {
        const token = sessionCookie.substring("clinic_session=".length);
        sessions.delete(token);
    }
}