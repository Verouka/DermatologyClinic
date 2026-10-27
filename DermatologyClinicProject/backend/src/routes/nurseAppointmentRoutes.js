import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });
    res.end(JSON.stringify(data));
}

async function getNurseOffice(nurseId) {
    const [rows] = await pool.execute(
        `SELECT OFFICE_Office_ID
         FROM nurse
         WHERE Nurse_ID = ?
         LIMIT 1`,
        [nurseId]
    );

    return rows.length ? rows[0].OFFICE_Office_ID : null;
}

async function getAppointments(officeId) {
    const [rows] = await pool.execute(
        `SELECT
            a.Appointment_ID,
            a.Appointment_Status,
            DATE_FORMAT(a.Appointment_Date, '%Y-%m-%d')
                AS Appointment_Date,
            TIME_FORMAT(a.Appointment_Time, '%H:%i:%s')
                AS Appointment_Time,
            a.Appointment_Description,
            a.Booking_Method,
            a.PATIENT_Patient_ID,
            a.DOCTOR_Doctor_ID,
            p.First_Name,
            p.Middle_Name,
            p.Last_Name
         FROM appointment a
         INNER JOIN patient p
            ON p.Patient_ID = a.PATIENT_Patient_ID
         WHERE a.OFFICE_Office_ID = ?
           AND a.Appointment_Date = CURDATE()
         ORDER BY a.Appointment_Time, a.Appointment_ID`,
        [officeId]
    );

    return rows;
}

async function updateAppointment(
    appointmentId,
    officeId,
    expectedStatus,
    newStatus
) {
    const [result] = await pool.execute(
        `UPDATE appointment
         SET Appointment_Status = ?
         WHERE Appointment_ID = ?
           AND OFFICE_Office_ID = ?
           AND Appointment_Date = CURDATE()
           AND LOWER(TRIM(Appointment_Status)) = ?`,
        [
            newStatus,
            appointmentId,
            officeId,
            expectedStatus
        ]
    );

    return result.affectedRows > 0;
}

export async function handleNurseAppointmentRoutes(req, res) {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    if (
        pathname !== "/api/nurse/appointments" &&
        !/^\/api\/nurse\/appointments\/\d+\/(start-triage|ready-for-doctor)$/.test(pathname)
    ) {
        return false;
    }

    const session = getSession(req);

    if (!session) {
        sendJSON(res, 401, {
            error: "Please log in first."
        });
        return true;
    }

    if (
        String(session.role).toLowerCase() !== "nurse" ||
        !Number.isInteger(Number(session.nurseId)) ||
        Number(session.nurseId) <= 0
    ) {
        sendJSON(res, 403, {
            error: "Nurse access only."
        });
        return true;
    }

    try {
        const officeId = await getNurseOffice(
            Number(session.nurseId)
        );

        if (!officeId) {
            sendJSON(res, 403, {
                error: "No assigned office found for this nurse."
            });
            return true;
        }

        if (pathname === "/api/nurse/appointments") {
            if (req.method !== "GET") {
                sendJSON(res, 405, {
                    error: "Method not allowed."
                });
                return true;
            }

            const appointments = await getAppointments(officeId);

            sendJSON(res, 200, {
                appointments
            });
            return true;
        }

        if (req.method !== "PATCH") {
            sendJSON(res, 405, {
                error: "Method not allowed."
            });
            return true;
        }

        const match = pathname.match(
            /^\/api\/nurse\/appointments\/(\d+)\/(start-triage|ready-for-doctor)$/
        );

        const appointmentId = Number(match[1]);
        const action = match[2];

        if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) {
            sendJSON(res, 400, {
                error: "Invalid appointment ID."
            });
            return true;
        }

        const expectedStatus = action === "start-triage"
            ? "checked in"
            : "in triage";

        const newStatus = action === "start-triage"
            ? "In Triage"
            : "Ready for Doctor";

        const updated = await updateAppointment(
            appointmentId,
            officeId,
            expectedStatus,
            newStatus
        );

        if (!updated) {
            sendJSON(res, 409, {
                error:
                    "This appointment is not in the required status, " +
                    "is not scheduled for today, or does not belong " +
                    "to your assigned office. Refresh the page."
            });
            return true;
        }

        const [rows] = await pool.execute(
            `SELECT Appointment_ID,
                    PATIENT_Patient_ID,
                    Appointment_Status
             FROM appointment
             WHERE Appointment_ID = ?
               AND OFFICE_Office_ID = ?`,
            [appointmentId, officeId]
        );

        sendJSON(res, 200, {
            success: true,
            appointment: rows[0]
        });

    } catch (error) {
        console.error("Nurse appointments error:", error);

        sendJSON(res, 500, {
            error: "Unable to process nurse appointments."
        });
    }

    return true;
}