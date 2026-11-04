// Routes for the EXISTING Doctor Settings page. No new tables or connections.
import pool from "../database.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { getSession } from "../services/sessionService.js";
import {
    getDoctorNotificationPreferences,
    setDoctorNotificationPreferences
} from "../services/doctorNotificationPreferences.js";

export const handleDoctorSettingsRoutes = async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;

    const isAccount = req.method === "GET" &&
        path === "/api/doctor/settings/account";
    const isPassword = req.method === "PATCH" &&
        path === "/api/doctor/settings/password";
    const isNotifications = ["GET", "PATCH"].includes(req.method) &&
        path === "/api/doctor/settings/notifications";

    if (!isAccount && !isPassword && !isNotifications) return false;

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        });
        res.end(JSON.stringify(data));
    };

    // Use the user's logged-in account, never an ID sent from the browser.
    const session = getSession(req);
    if (
        !session ||
        session.role !== "doctor" ||
        !session.userId ||
        !session.doctorId
    ) {
        sendJSON(401, { error: "Doctor login required" });
        return true;
    }

    if (isAccount) {
        try {
            // Login/account email, not the potentially different doctor.Email.
            const [rows] = await pool.execute(
                `SELECT Email
                 FROM usercredential
                 WHERE UserID = ? AND DOCTOR_Doctor_ID = ?
                   AND role = 'doctor'
                 LIMIT 1`,
                [session.userId, session.doctorId]
            );

            if (rows.length === 0) {
                sendJSON(404, { error: "Doctor login account not found" });
            } else {
                sendJSON(200, { email: rows[0].Email });
            }
        } catch (error) {
            console.error("Load Doctor account email error:", error);
            sendJSON(500, { error: "Could not load Doctor account email" });
        }
        return true;
    }

    if (isNotifications && req.method === "GET") {
        sendJSON(200, getDoctorNotificationPreferences(session.userId));
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

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        sendJSON(400, { error: "Invalid request information" });
        return true;
    }

    if (isNotifications) {
        if (
            typeof data.appointmentReminders !== "boolean" ||
            typeof data.medicalUpdates !== "boolean"
        ) {
            sendJSON(400, { error: "Preferences must be true or false" });
            return true;
        }

        const prefs = setDoctorNotificationPreferences(session.userId, data);
        sendJSON(200, {
            message: "Notification preferences saved temporarily",
            ...prefs
        });
        return true;
    }

    const { currentPassword, newPassword } = data;
    if (
        typeof currentPassword !== "string" || !currentPassword ||
        typeof newPassword !== "string" ||
        newPassword.length < 8 || newPassword.length > 128
    ) {
        sendJSON(400, { error: "Invalid password information" });
        return true;
    }

    if (newPassword === currentPassword) {
        sendJSON(400, { error: "New password must be different" });
        return true;
    }

    try {
        const [rows] = await pool.execute(
            `SELECT Password_hash
             FROM usercredential
             WHERE UserID = ? AND DOCTOR_Doctor_ID = ?
               AND role = 'doctor'
             LIMIT 1`,
            [session.userId, session.doctorId]
        );

        if (rows.length === 0) {
            sendJSON(404, { error: "Doctor login account not found" });
            return true;
        }

        const oldHash = rows[0].Password_hash;
        if (!(await verifyPassword(currentPassword, oldHash))) {
            sendJSON(401, { error: "Current password is incorrect" });
            return true;
        }

        // The same scrypt hash helper used by the existing Patient Settings route.
        const newHash = await hashPassword(newPassword);
        const [result] = await pool.execute(
            `UPDATE usercredential
             SET Password_hash = ?
             WHERE UserID = ? AND DOCTOR_Doctor_ID = ?
               AND role = 'doctor' AND Password_hash = ?`,
            [newHash, session.userId, session.doctorId, oldHash]
        );

        if (result.affectedRows === 0) {
            sendJSON(409, { error: "Account changed; retry your password update" });
            return true;
        }

        sendJSON(200, { message: "Password changed successfully!" });
    } catch (error) {
        console.error("Doctor password change error:", error);
        sendJSON(500, { error: "Could not change password" });
    }

    return true;
};
