
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

export const handlePatientRoutes = async (req, res) => {

    if (
        req.url !== "/api/patient/me" ||
        !["GET", "PATCH"].includes(req.method)
    ) {
        return false;
    }

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json"
        });
        res.end(JSON.stringify(data));
    };

    const session = getSession(req);

    if (!session || session.role !== "patient" || !session.patientId) {
        sendJSON(401, { error: "Unauthorized" });
        return true;
    }

    // Retrieve the logged-in patient's profile.
    if (req.method === "GET") {
        try {
            const [rows] = await pool.execute(
                `SELECT Patient_ID, First_Name, Last_Name, Email,
                        BirthDate, Phone, Street
                 FROM patient
                 WHERE Patient_ID = ?
                 LIMIT 1`,
                [session.patientId]
            );

            if (rows.length === 0) {
                sendJSON(404, { error: "Patient not found" });
                return true;
            }

            sendJSON(200, rows[0]);

        } catch (error) {
            console.error("Patient profile error:", error);
            sendJSON(500, { error: "Could not load profile" });
        }

        return true;
    }

    // Update the logged-in patient's contact information.
    if (req.method === "PATCH") {
        let body = "";

        for await (const chunk of req) {
            body += chunk;

            if (body.length > 10000) {
                sendJSON(413, { error: "Request too large" });
                return true;
            }
        }

        let data;

        try {
            data = JSON.parse(body);
        } catch {
            sendJSON(400, { error: "Invalid JSON" });
            return true;
        }

        const { phone, address } = data;

        if (
            typeof phone !== "string" ||
            !/^\d{3}-\d{3}-\d{4}$/.test(phone.trim()) ||
            typeof address !== "string" ||
            !address.trim() ||
            address.trim().length > 45
        ) {
            sendJSON(400, {
                error: "Enter a valid phone number and address"
            });
            return true;
        }

        try {
            const [result] = await pool.execute(
                `UPDATE patient
                 SET Phone = ?, Street = ?
                 WHERE Patient_ID = ?`,
                [phone.trim(), address.trim(), session.patientId]
            );

            if (result.affectedRows === 0) {
                sendJSON(404, { error: "Patient not found" });
                return true;
            }

            sendJSON(200, {
                message: "Profile updated successfully"
            });

        } catch (error) {
            console.error("Profile update error:", error);
            sendJSON(500, { error: "Could not update profile" });
        }

        return true;
    }
};
