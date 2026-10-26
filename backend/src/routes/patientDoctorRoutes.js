

import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

export const handlePatientDoctorRoutes = async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;

    if (req.method !== "GET" || path !== "/api/patient/doctors") {
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

    try {
        const [doctors] = await pool.execute(
            `SELECT
                d.Doctor_ID,
                d.First_Name,
                d.Last_Name
             FROM doctor_has_patient AS dp
             INNER JOIN doctor AS d
                ON dp.DOCTOR_Doctor_ID = d.Doctor_ID
             WHERE dp.PATIENT_Patient_ID = ?
             ORDER BY d.Last_Name, d.First_Name`,
            [session.patientId]
        );

        sendJSON(200, doctors);

    } catch (error) {
        console.error("Assigned doctors error:", error);
        sendJSON(500, {
            error: "Could not load assigned doctors"
        });
    }

    return true;
};
