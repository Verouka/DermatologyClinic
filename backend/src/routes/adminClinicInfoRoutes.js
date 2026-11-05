
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

    if (
        req.method !== "GET" ||
        pathname !== "/api/admin/clinic-info"
    ) {
        return false;
    }

    // Check administrator session.
    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 403, {
            error: "Administrator access required"
        });

        return true;
    }

    try {
        // Retrieve all clinic offices.
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
        `);

        sendJSON(res, 200, {
            offices: rows
        });

    } catch (error) {
        console.error("Admin clinic information error:", error);

        sendJSON(res, 500, {
            error: "Could not load clinic information"
        });
    }

    return true;
}
