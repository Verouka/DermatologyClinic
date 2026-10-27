 
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";
 
export const handleDoctorAppointmentRoutes = async (req, res) => {
 
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
 
    if (
        path !== "/api/doctor/appointments" ||
        req.method !== "GET"
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
 
    if (!session || session.role !== "doctor" || !session.doctorId) {
        sendJSON(401, { error: "Unauthorized" });
        return true;
    }
 
    const scope = url.searchParams.get("scope") || "all";
 
    if (!["all", "upcoming", "past"].includes(scope)) {
        sendJSON(400, { error: "Invalid appointment scope" });
        return true;
    }
 
    if (req.method === "GET") {
        try {
            let dateFilter = "";
 
            if (scope === "upcoming") {
                dateFilter = `
                    AND TIMESTAMP(
                        a.Appointment_Date,
                        a.Appointment_Time
                    ) >= NOW()
                    AND LOWER(COALESCE(a.Appointment_Status, ''))
                        NOT IN ('cancelled', 'canceled', 'completed')
                `;
            }
 
            if (scope === "past") {
                dateFilter = `
                    AND (
                        TIMESTAMP(
                            a.Appointment_Date,
                            a.Appointment_Time
                        ) < NOW()
                        OR LOWER(COALESCE(a.Appointment_Status, ''))
                            IN ('cancelled', 'canceled', 'completed')
                    )
                `;
            }
 
            const [rows] = await pool.execute(
                `SELECT
                    a.Appointment_ID,
                    a.Appointment_Date,
                    a.Appointment_Time,
                    a.Appointment_Description,
                    a.Appointment_Status,
                    a.Booking_Method,
                    a.PATIENT_Patient_ID,
                    a.DOCTOR_Doctor_ID,
                    a.OFFICE_Office_ID,
 
                    p.First_Name AS Patient_First_Name,
                    p.Last_Name AS Patient_Last_Name,
 
                    o.Street AS Office_Street,
                    o.City AS Office_City,
                    o.State AS Office_State
 
                 FROM appointment AS a
 
                 INNER JOIN patient AS p
                    ON a.PATIENT_Patient_ID = p.Patient_ID
 
                 INNER JOIN office AS o
                    ON a.OFFICE_Office_ID = o.Office_ID
 
                 WHERE a.DOCTOR_Doctor_ID = ?
                 ${dateFilter}
 
                 ORDER BY
                    a.Appointment_Date DESC,
                    a.Appointment_Time DESC`,
                [session.doctorId]
            );
 
            sendJSON(200, rows);
 
        } catch (error) {
            console.error(
                "Doctor appointment loading error:",
                error
            );
 
            sendJSON(500, {
                error: "Could not load doctor appointments"
            });
        }
 
        return true;
    }
};
 