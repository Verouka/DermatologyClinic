
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";
import {
    hashPassword,
    verifyPassword
} from "../utils/password.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });
    res.end(JSON.stringify(data));
}

export async function handleAdminProfileRoutes(req, res) {
    const pathname = new URL(req.url, "http://localhost").pathname;

    // ==========================================
    // ADMINISTRATOR AUTHENTICATION
    // ==========================================

    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 403, {
            error: "Administrator access required"
        });
        return true;
    }

    if (!session.administratorId) {
        sendJSON(res, 401, {
            error: "Administrator ID not found in session"
        });
        return true;
    }


    // ==========================================
    // GET ADMINISTRATOR PROFILE
    // ==========================================

    if (
        req.method === "GET" &&
        pathname === "/api/admin/profile"
    ) {
        try {
            const [rows] = await pool.execute(
                `
                SELECT
                    a.Administrator_ID AS adminId,
                    a.First_Name AS firstName,
                    a.Middle_Name AS middleName,
                    a.Last_Name AS lastName,
                    a.BirthDate AS dateOfBirth,
                    a.Gender AS gender,
                    uc.Email AS email,
                    a.Phone AS phone,
                    a.Street AS street,
                    a.City AS city,
                    a.State AS state,
                    a.Zip_Code AS zipCode,
                    a.OFFICE_Office_ID AS officeId,
                    a.Start_Date AS startDate,
                    a.Salary AS salary
                FROM administrator a
                INNER JOIN usercredential uc
                    ON uc.ADMINISTRATOR_Administrator_ID =
                       a.Administrator_ID
                WHERE a.Administrator_ID = ?
                  AND uc.role = 'administrator'
                LIMIT 1
                `,
                [session.administratorId]
            );

            if (rows.length === 0) {
                sendJSON(res, 404, {
                    error: "Administrator profile not found"
                });
                return true;
            }

            sendJSON(res, 200, {
                profile: rows[0]
            });

        } catch (error) {
            console.error("Admin profile loading error:", error);

            sendJSON(res, 500, {
                error: "Could not load administrator profile"
            });
        }

        return true;
    }


    // ==========================================
    // CHANGE ADMINISTRATOR PASSWORD
    // ==========================================

    if (
        req.method === "PATCH" &&
        pathname === "/api/admin/profile/change-password"
    ) {
        let body = "";

        try {
            for await (const chunk of req) {
                body += chunk;

                if (body.length > 10000) {
                    sendJSON(res, 413, {
                        error: "Request too large"
                    });
                    return true;
                }
            }

            let data;

            try {
                data = JSON.parse(body);
            } catch {
                sendJSON(res, 400, {
                    error: "Invalid JSON"
                });
                return true;
            }

            const { currentPassword, newPassword } = data;

            if (
                typeof currentPassword !== "string" ||
                typeof newPassword !== "string" ||
                !currentPassword ||
                !newPassword
            ) {
                sendJSON(res, 400, {
                    error: "Current and new passwords are required"
                });
                return true;
            }

            if (
                newPassword.length < 8 ||
                newPassword.length > 128
            ) {
                sendJSON(res, 400, {
                    error: "New password must be between 8 and 128 characters"
                });
                return true;
            }

            if (currentPassword === newPassword) {
                sendJSON(res, 400, {
                    error: "New password must be different from current password"
                });
                return true;
            }

            // Retrieve the administrator's account.
            const [rows] = await pool.execute(
                `
                SELECT
                    uc.UserID,
                    uc.Password_hash
                FROM usercredential uc
                INNER JOIN administrator a
                    ON a.Administrator_ID =
                       uc.ADMINISTRATOR_Administrator_ID
                WHERE a.Administrator_ID = ?
                  AND uc.role = 'administrator'
                LIMIT 1
                `,
                [session.administratorId]
            );

            if (rows.length === 0) {
                sendJSON(res, 404, {
                    error: "Administrator account not found"
                });
                return true;
            }

            const user = rows[0];

            // Verify the current password.
            const validPassword = await verifyPassword(
                currentPassword,
                user.Password_hash
            );

            if (!validPassword) {
                sendJSON(res, 401, {
                    error: "Current password is incorrect"
                });
                return true;
            }

            // Hash the new password.
            const newPasswordHash = await hashPassword(newPassword);

            // Update the database.
            const [updateResult] = await pool.execute(
                `
                UPDATE usercredential
                SET Password_hash = ?
                WHERE UserID = ?
                  AND role = 'administrator'
                `,
                [newPasswordHash, user.UserID]
            );

            if (updateResult.affectedRows !== 1) {
                sendJSON(res, 500, {
                    error: "Password could not be updated"
                });
                return true;
            }

            sendJSON(res, 200, {
                message: "Password changed successfully!"
            });

        } catch (error) {
            console.error("Admin password change error:", error);

            sendJSON(res, 500, {
                error: "Could not change administrator password"
            });
        }

        return true;
    }

    return false;
}
