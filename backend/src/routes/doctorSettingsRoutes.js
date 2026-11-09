
import pool from "../database.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { getSession } from "../services/sessionService.js";

export const handleDoctorSettingsRoutes = async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    const isAccount = req.method === "GET" &&
        path === "/api/doctor/settings/account";
    const isPassword = req.method === "PATCH" &&
        path === "/api/doctor/settings/password";

    if (!isAccount && !isPassword) return false;

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        });
        res.end(JSON.stringify(data));
    };

    // Session created by existing login code; do not trust doctor ID from browser.
    const session = getSession(req);
    const doctorId = Number(session?.doctorId);
    if (session?.role !== "doctor" ||
        !Number.isSafeInteger(doctorId) || doctorId <= 0) {
        sendJSON(401, { error: "Doctor login required" });
        return true;
    }

    if (isAccount) {
        try {
            // DOCTOR_Doctor_ID is UNIQUE in usercredential. 
            const [rows] = await pool.execute(
                `SELECT Email
                 FROM usercredential
                 WHERE DOCTOR_Doctor_ID = ? AND role = 'doctor'
                 LIMIT 1`,
                [doctorId]
            );
            if (rows.length === 0) {
                sendJSON(404, { error: "Doctor login account not found in MySQL" });
            } else {
                sendJSON(200, { email: rows[0].Email });
            }
        } catch (error) {
            console.error("Doctor account email error:", error);
            sendJSON(500, { error: "Could not load doctor account email" });
        }
        return true;
    }

    // Password route
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

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        sendJSON(400, { error: "Invalid password information" });
        return true;
    }

    const { currentPassword, newPassword } = data;
    if (typeof currentPassword !== "string" || !currentPassword ||
        typeof newPassword !== "string" ||
        newPassword.length < 8 || newPassword.length > 128) {
        sendJSON(400, { error: "Invalid password information" });
        return true;
    }
    if (currentPassword === newPassword) {
        sendJSON(400, { error: "New password must be different" });
        return true;
    }

    try {
        const [rows] = await pool.execute(
            `SELECT UserID, Password_hash
             FROM usercredential
             WHERE DOCTOR_Doctor_ID = ? AND role = 'doctor'
             LIMIT 1`,
            [doctorId]
        );
        if (rows.length === 0) {
            sendJSON(404, { error: "Doctor login account not found in MySQL" });
            return true;
        }
        const { UserID: userId, Password_hash: oldHash } = rows[0];

        if (!(await verifyPassword(currentPassword, oldHash))) {
            sendJSON(401, { error: "Current password is incorrect" });
            return true;
        }

        const newHash = await hashPassword(newPassword);
        // Comparing old hash guards against concurrent password changes.
        const [result] = await pool.execute(
            `UPDATE usercredential
             SET Password_hash = ?
             WHERE UserID = ? AND DOCTOR_Doctor_ID = ?
               AND role = 'doctor' AND Password_hash = ?`,
            [newHash, userId, doctorId, oldHash]
        );
        if (result.affectedRows !== 1) {
            sendJSON(409, { error: "Account changed. Retry password update." });
            return true;
        }

        sendJSON(200, { message: "Password changed successfully!" });
    } catch (error) {
        console.error("Doctor password change error:", error);
        sendJSON(500, { error: "Could not change password" });
    }
    return true;
};
