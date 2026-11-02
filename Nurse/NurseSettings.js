import pool from "./database.js";

// Helper to parse JSON request bodies
const parseBody = (req) => new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
});

export async function getNurseSettings(req, res) {
    try {
        // Fetch nurse details if needed for settings context
        const [rows] = await pool.query("SELECT Email, Phone FROM nurse WHERE Nurse_ID = 501");
        const nurse = rows[0] || {};

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            email: nurse.Email,
            phone: nurse.Phone,
            emailNotifications: true,
            smsAlerts: true
        }));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}

export async function updateNurseSettings(req, res) {
    try {
        const data = await parseBody(req);
        // Handle saving settings preferences
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Settings updated successfully" }));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}

export async function requestPasswordReset(req, res) {
    try {
        const [rows] = await pool.query("SELECT Email FROM nurse WHERE Nurse_ID = 501");
        const nurse = rows[0];

        if (!nurse) {
            res.writeHead(404, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Nurse not found" }));
        }

        // Logic for handling password reset request simulation
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: `Password reset link sent to ${nurse.Email}` }));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}