

import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

export const handleAppointmentOptionsRoutes = async (req, res) => {

    if (
        req.method !== "GET" ||
        req.url !== "/api/patient/appointment-options"
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

    try {
        const [rows] = await pool.execute(`
            SELECT
                o.Office_ID,
                o.Street,
                o.City,
                o.State,
                o.Zip_Code,
                d.Doctor_ID,
                d.First_Name,
                d.Last_Name
            FROM office AS o
            INNER JOIN office_has_doctor AS od
                ON o.Office_ID = od.OFFICE_Office_ID
            INNER JOIN doctor AS d
                ON d.Doctor_ID = od.DOCTOR_Doctor_ID
            ORDER BY o.City, d.Last_Name, d.First_Name
        `);

        sendJSON(200, rows);

    } catch (error) {
        console.error("Appointment options error:", error);
        sendJSON(500, {
            error: "Could not load offices and doctors"
        });
    }

    return true;
};