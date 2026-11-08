
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

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

            console.error(
                "Admin profile loading error:",
                error
            );

            sendJSON(res, 500, {
                error: "Could not load administrator profile"
            });

        }

        return true;
    }

    return false;
}
