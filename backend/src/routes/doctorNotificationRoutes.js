import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

// Cancellation notices are derived from the EXISTING appointment table.
// Read flags live in this server process only; the browser also caches them
// locally so they can remain read after a server restart on that browser.
// No notification table or notification-preferences service is required.
const readByDoctor = new Map();

export const handleDoctorNotificationRoutes = async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    const isList = req.method === "GET" && path === "/api/doctor/notifications";
    const readMatch = path.match(
        /^\/api\/doctor\/notifications\/cancel-([1-9]\d*)\/read$/
    );
    const isRead = req.method === "PATCH" && readMatch !== null;

    if (!isList && !isRead) return false;

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        });
        res.end(JSON.stringify(data));
    };

    // Uses the supplied sessionService.js. Nothing is read from the
    // credential JSON or trusted from a browser-provided doctor ID.
    const session = getSession(req);
    const doctorId = Number(session?.doctorId);
    if (
        !session || session.role !== "doctor" ||
        !Number.isSafeInteger(doctorId) || doctorId <= 0
    ) {
        sendJSON(401, {
            error: "Doctor login required (session must include doctorId)"
        });
        return true;
    }

    try {
        const read = readByDoctor.get(doctorId) || new Set();

        if (isList) {
            const [rows] = await pool.execute(
                `SELECT
                    a.Appointment_ID,
                    DATE_FORMAT(a.Appointment_Date, '%Y-%m-%d') AS Appointment_Date,
                    TIME_FORMAT(a.Appointment_Time, '%H:%i') AS Appointment_Time,
                    p.First_Name,
                    p.Last_Name
                 FROM appointment AS a
                 INNER JOIN patient AS p
                    ON p.Patient_ID = a.PATIENT_Patient_ID
                 WHERE a.DOCTOR_Doctor_ID = ?
                   AND LOWER(TRIM(a.Appointment_Status)) IN ('canceled', 'cancelled')
                 ORDER BY a.Appointment_Date DESC, a.Appointment_Time DESC
                 LIMIT 100`,
                [doctorId]
            );

            const notifications = rows.map(appt => ({
                Notification_ID: `cancel-${appt.Appointment_ID}`,
                Kind: "appointment-cancellation",
                Title: "Appointment canceled",
                Message:
                    `Appointment #${appt.Appointment_ID} for ` +
                    `${[appt.First_Name, appt.Last_Name].filter(Boolean).join(" ") || "a patient"}` +
                    ` (scheduled ${appt.Appointment_Date || "date unknown"}` +
                    `${appt.Appointment_Time ? ` at ${appt.Appointment_Time}` : ""}) was canceled.`,
                // Appointment date is NOT the cancellation timestamp.
                Created_At: null,
                Is_Read: read.has(Number(appt.Appointment_ID))
            }));

            sendJSON(200, {
                viewerId: doctorId,
                notifications,
                unreadCount: notifications.filter(n => !n.Is_Read).length
            });
            return true;
        }

        // Mark a synthetic cancellation notification as read. Confirm that
        // the appointment is actually canceled AND belongs to this doctor.
        const appointmentId = Number(readMatch[1]);
        if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) {
            sendJSON(400, { error: "Invalid appointment ID" });
            return true;
        }
        const [rows] = await pool.execute(
            `SELECT Appointment_ID
             FROM appointment
             WHERE Appointment_ID = ?
               AND DOCTOR_Doctor_ID = ?
               AND LOWER(TRIM(Appointment_Status)) IN ('canceled', 'cancelled')
             LIMIT 1`,
            [appointmentId, doctorId]
        );
        if (rows.length === 0) {
            sendJSON(404, { error: "Cancellation notification not found" });
            return true;
        }
        read.add(appointmentId);
        readByDoctor.set(doctorId, read);
        sendJSON(200, { message: "Notification marked as read" });

    } catch (error) {
        console.error("Doctor cancellation notifications error:", error);
        sendJSON(500, { error: "Could not load or update notifications" });
    }
    return true;
};
