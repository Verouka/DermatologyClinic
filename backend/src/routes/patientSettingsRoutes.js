

import pool from "../database.js";
import {
    hashPassword,
    verifyPassword
} from "../utils/password.js";
import { getSession } from "../services/sessionService.js";

export const handlePatientSettingsRoutes = async (req, res) => {
    if (
        req.method !== "PATCH" ||
        req.url !== "/api/patient/settings/password"
    ) {
        return false;
    }

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json"
        });
        res.end(JSON.stringify(data));
    };

    const session = getSession(req);

    if (
        !session ||
        session.role !== "patient" ||
        !session.userId
    ) {
        sendJSON(401, {
            error: "Unauthorized"
        });
        return true;
    }

    let body = "";

    for await (const chunk of req) {
        body += chunk;

        if (body.length > 10000) {
            sendJSON(413, {
                error: "Request too large"
            });
            return true;
        }
    }

    let data;

    try {
        data = JSON.parse(body);
    } catch {
        sendJSON(400, {
            error: "Invalid JSON"
        });
        return true;
    }

    const { currentPassword, newPassword } = data;

    if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        newPassword.length < 8 ||
        newPassword.length > 128
    ) {
        sendJSON(400, {
            error: "Invalid password information"
        });
        return true;
    }

    try {
        const [rows] = await pool.execute(
            `SELECT Password_hash
             FROM usercredential
             WHERE UserID = ?
             AND PATIENT_Patient_ID = ?
             LIMIT 1`,
            [session.userId, session.patientId]
        );

        if (rows.length === 0) {
            sendJSON(404, {
                error: "Account not found"
            });
            return true;
        }

        const validPassword = await verifyPassword(
            currentPassword,
            rows[0].Password_hash
        );

        if (!validPassword) {
            sendJSON(401, {
                error: "Current password is incorrect"
            });
            return true;
        }

        if (currentPassword === newPassword) {
            sendJSON(400, {
                error: "New password must be different"
            });
            return true;
        }

        const newHash = await hashPassword(newPassword);

        await pool.execute(
            `UPDATE usercredential
             SET Password_hash = ?
             WHERE UserID = ?
             AND PATIENT_Patient_ID = ?`,
            [newHash, session.userId, session.patientId]
        );

        sendJSON(200, {
            message: "Password changed successfully!"
        });

    } catch (error) {
        console.error("Password change error:", error);

        sendJSON(500, {
            error: "Could not change password"
        });
    }

    return true;
};
