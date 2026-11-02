
import pool from "../database.js";
import {
    hashPassword,
    verifyPassword
} from "../utils/password.js";
import { getSession } from "../services/sessionService.js";

export const handleDoctorSettingsRoutes = async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;

    const isPassword =
        path === "/api/doctor/settings/password" &&
        req.method === "PATCH";

    if (!isPassword) return false;

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        });

        res.end(JSON.stringify(data));
    };

    const session = getSession(req);

    if (
        !session ||
        session.role !== "doctor" ||
        !session.userId ||
        !session.doctorId
    ) {
        sendJSON(401, { error: "Unauthorized" });
        return true;
    }

    let body = "";

    try {
        for await (const chunk of req) {
            body += chunk;

            if (Buffer.byteLength(body, "utf8") > 10000) {
                sendJSON(413, { error: "Request too large" });
                return true;
            }
        }
    } catch {
        sendJSON(400, { error: "Could not read request" });
        return true;
    }

    let data;

    try {
        data = JSON.parse(body);
    } catch {
        sendJSON(400, { error: "Invalid JSON" });
        return true;
    }

    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        sendJSON(400, { error: "Invalid password information" });
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
        sendJSON(400, { error: "Invalid password information" });
        return true;
    }

    try {
        const [rows] = await pool.execute(
            `SELECT Password_hash
             FROM usercredential
             WHERE UserID = ?
               AND DOCTOR_Doctor_ID = ?
             LIMIT 1`,
            [session.userId, session.doctorId]
        );

        if (rows.length === 0) {
            sendJSON(404, { error: "Account not found" });
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

        const [result] = await pool.execute(
            `UPDATE usercredential
             SET Password_hash = ?
             WHERE UserID = ?
               AND DOCTOR_Doctor_ID = ?
               AND Password_hash = ?`,
            [
                newHash,
                session.userId,
                session.doctorId,
                rows[0].Password_hash
            ]
        );

        if (result.affectedRows === 0) {
            sendJSON(409, {
                error: "Account was updated. Please try again."
            });
            return true;
        }

        sendJSON(200, {
            message: "Password changed successfully!"
        });

    } catch (error) {
        console.error("Doctor password change error:", error);

        sendJSON(500, {
            error: "Could not change password"
        });
    }

    return true;
};
