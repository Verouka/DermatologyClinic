
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

export async function handleAdminClinicInfoRoutes(req, res) {
    const pathname = new URL(req.url, "http://localhost").pathname;

    if (req.method !== "GET" || pathname !== "/api/admin/clinic-info") {
        return false;
    }

    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 403, {
            error: "Administrator access required"
        });

        return true;
    }

    try {
        const [rows] = await pool.execute(`
            SELECT
                Office_ID AS officeId,
                Phone AS phone,
                Street AS street,
                City AS city,
                State AS state,
                Zip_Code AS zipCode
            FROM office
            ORDER BY Office_ID ASC
            LIMIT 1
        `);

        if (rows.length === 0) {
            sendJSON(res, 404, {
                error: "No clinic information found"
            });

            return true;
        }

        sendJSON(res, 200, {
            office: rows[0]
        });

    } catch (error) {
        console.error("Admin clinic information error:", error);

        sendJSON(res, 500, {
            error: "Could not load clinic information"
        });
    }

    return true;
}
