
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

export async function handleAdminDashboardRoutes(req, res) {
    const pathname = new URL(req.url, "http://localhost").pathname;

    if (req.method !== "GET" || pathname !== "/api/admin/dashboard") {
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
        const [patientRows] = await pool.execute(`
            SELECT COUNT(*) AS total
            FROM patient
        `);

        const [doctorRows] = await pool.execute(`
            SELECT COUNT(*) AS total
            FROM doctor
        `);

        const [nurseRows] = await pool.execute(`
            SELECT COUNT(*) AS total
            FROM nurse
        `);

        const [paymentRows] = await pool.execute(`
            SELECT COALESCE(SUM(Payment_Amount), 0) AS total
            FROM payment
        `);

        sendJSON(res, 200, {
            totalPatients: Number(patientRows[0].total),
            totalDoctors: Number(doctorRows[0].total),
            totalNurses: Number(nurseRows[0].total),
            totalRevenue: Number(paymentRows[0].total)
        });

    } catch (error) {
        console.error("Admin dashboard loading error:", error);

        sendJSON(res, 500, {
            error: "Could not load dashboard information"
        });
    }

    return true;
}
