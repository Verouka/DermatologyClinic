import pool from "../database.js";
import { getSession } from "../services/sessionService.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

export async function handleAdminSettingsRoutes(req, res) {

    const pathname = new URL(req.url, "http://localhost").pathname;

    if (
        req.method !== "PATCH" ||
        pathname !== "/api/admin/profile/change-password"
    ) {
        return false;
    }

    try {

        // ==========================================
        // ADMINISTRATOR AUTHENTICATION
        // ==========================================

        const session = getSession(req);

        if (!session || session.role !== "administrator") {
            sendJSON(res, 403, {
                success: false,
                message: "Administrator access required."
            });

            return true;
        }

        if (!session.administratorId) {
            sendJSON(res, 401, {
                success: false,
                message: "Administrator ID not found in session."
            });

            return true;
        }

        // ==========================================
        // READ REQUEST BODY
        // ==========================================

        let body = "";

        for await (const chunk of req) {
            body += chunk;
        }

        let data;

        try {
            data = JSON.parse(body);
        } catch {
            sendJSON(res, 400, {
                success: false,
                message: "Invalid request data."
            });

            return true;
        }

        const { currentPassword, newPassword } = data;

        // ==========================================
        // VALIDATE PASSWORDS
        // ==========================================

        if (!currentPassword || !newPassword) {
            sendJSON(res, 400, {
                success: false,
                message: "Please provide your current and new passwords."
            });

            return true;
        }

        if (
            typeof newPassword !== "string" ||
            newPassword.length < 8 ||
            newPassword.length > 128
        ) {
            sendJSON(res, 400, {
                success: false,
                message: "Your new password must be between 8 and 128 characters."
            });

            return true;
        }

        if (currentPassword === newPassword) {
            sendJSON(res, 400, {
                success: false,
                message: "Your new password must be different from your current password."
            });

            return true;
        }

        // ==========================================
        // GET ADMINISTRATOR CREDENTIALS
        // ==========================================

        const [rows] = await pool.execute(
            `
            SELECT
                uc.UserID,
                uc.Password_hash
            FROM usercredential uc
            WHERE uc.ADMINISTRATOR_Administrator_ID = ?
              AND uc.role = 'administrator'
            LIMIT 1
            `,
            [session.administratorId]
        );

        if (rows.length === 0) {
            sendJSON(res, 404, {
                success: false,
                message: "Administrator account not found."
            });

            return true;
        }

        const user = rows[0];

        // ==========================================
        // VERIFY CURRENT PASSWORD
        // ==========================================

        const passwordIsValid = await verifyPassword(
            currentPassword,
            user.Password_hash
        );

        if (!passwordIsValid) {
            sendJSON(res, 400, {
                success: false,
                message: "Your current password is incorrect."
            });

            return true;
        }

        // ==========================================
        // UPDATE PASSWORD
        // ==========================================

        const newPasswordHash = await hashPassword(newPassword);

        await pool.execute(
            `
            UPDATE usercredential
            SET Password_hash = ?
            WHERE UserID = ?
            `,
            [newPasswordHash, user.UserID]
        );

        sendJSON(res, 200, {
            success: true,
            message: "Password changed successfully."
        });

        return true;

    } catch (error) {

        console.error("Admin password change error:", error);

        sendJSON(res, 500, {
            success: false,
            message: "An error occurred while changing your password."
        });

        return true;
    }
}