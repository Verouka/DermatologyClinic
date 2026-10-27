import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

export async function handleNurseDashboardRoutes(req, res) {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    if (pathname !== "/api/nurse/dashboard") {
        return false;
    }

    if (req.method !== "GET") {
        sendJSON(res, 405, {
            error: "Method not allowed."
        });
        return true;
    }

    const session = getSession(req);

    if (!session) {
        sendJSON(res, 401, {
            error: "Please log in first."
        });
        return true;
    }

    const nurseId = Number(session.nurseId);

    if (
        String(session.role).toLowerCase() !== "nurse" ||
        !Number.isSafeInteger(nurseId) ||
        nurseId <= 0
    ) {
        sendJSON(res, 403, {
            error: "Nurse access only."
        });
        return true;
    }

    try {
        // GET LOGGED-IN NURSE
        const [nurseRows] = await pool.execute(
            `SELECT
                Nurse_ID,
                First_Name,
                Last_Name,
                OFFICE_Office_ID
             FROM nurse
             WHERE Nurse_ID = ?
             LIMIT 1`,
            [nurseId]
        );

        if (!nurseRows.length) {
            sendJSON(res, 404, {
                error: "Nurse record not found."
            });
            return true;
        }

        const nurse = nurseRows[0];
        const officeId = nurse.OFFICE_Office_ID;

        if (!officeId) {
            sendJSON(res, 403, {
                error: "No office assigned to this nurse."
            });
            return true;
        }

        // GET TODAY'S SHIFT FROM SCHEDULE TABLE
        const [shiftRows] = await pool.execute(
            `SELECT
                Day_of_Week,
                TIME_FORMAT(
                    Start_Time,
                    '%h:%i %p'
                ) AS Start_Time,
                TIME_FORMAT(
                    End_Time,
                    '%h:%i %p'
                ) AS End_Time,
                OFFICE_Office_ID
             FROM schedule
             WHERE NURSE_Nurse_ID = ?
               AND OFFICE_Office_ID = ?
               AND LOWER(Day_of_Week) =
                   LOWER(DAYNAME(CURDATE()))
             ORDER BY Start_Time`,
            [nurseId, officeId]
        );

        // COUNT TODAY'S APPOINTMENTS
        const [countRows] = await pool.execute(
            `SELECT
                COUNT(*) AS totalAppointments,

                COALESCE(SUM(
                    LOWER(TRIM(Appointment_Status)) = 'checked in'
                ), 0) AS checkedIn,

                COALESCE(SUM(
                    LOWER(TRIM(Appointment_Status)) = 'in triage'
                ), 0) AS inTriage,

                COALESCE(SUM(
                    LOWER(TRIM(Appointment_Status)) = 'ready for doctor'
                ), 0) AS readyForDoctor,

                COALESCE(SUM(
                    LOWER(TRIM(Appointment_Status)) = 'scheduled'
                ), 0) AS scheduled

             FROM appointment
             WHERE OFFICE_Office_ID = ?
               AND Appointment_Date = CURDATE()`,
            [officeId]
        );

        const counts = countRows[0];

        // GET APPOINTMENT NOTIFICATIONS
        const [appointmentRows] = await pool.execute(
            `SELECT
                a.Appointment_ID,
                a.Appointment_Status,
                TIME_FORMAT(
                    a.Appointment_Time,
                    '%h:%i %p'
                ) AS Appointment_Time,
                p.First_Name,
                p.Last_Name

             FROM appointment a

             INNER JOIN patient p
                ON p.Patient_ID = a.PATIENT_Patient_ID

             WHERE a.OFFICE_Office_ID = ?
               AND a.Appointment_Date = CURDATE()
               AND LOWER(TRIM(a.Appointment_Status)) IN (
                   'checked in',
                   'in triage',
                   'ready for doctor'
               )

             ORDER BY a.Appointment_Time ASC,
                      a.Appointment_ID ASC
             LIMIT 10`,
            [officeId]
        );

        const notifications = appointmentRows.map(row => {
            const patientName = [
                row.First_Name,
                row.Last_Name
            ].filter(Boolean).join(" ");

            const status = String(
                row.Appointment_Status || ""
            ).trim().toLowerCase();

            let message;

            if (status === "checked in") {
                message =
                    `${patientName} is checked in ` +
                    `for the ${row.Appointment_Time} appointment.`;

            } else if (status === "in triage") {
                message =
                    `${patientName} is currently in triage.`;

            } else {
                message =
                    `${patientName} is ready for the doctor.`;
            }

            return {
                appointmentId: row.Appointment_ID,
                message
            };
        });

        // SEND DASHBOARD DATA
        sendJSON(res, 200, {
            nurse: {
                id: nurse.Nurse_ID,
                firstName: nurse.First_Name,
                lastName: nurse.Last_Name,
                officeId
            },

            todayShift: shiftRows.length
                ? shiftRows[0]
                : null,

            summary: {
                totalAppointments: Number(
                    counts.totalAppointments
                ),
                checkedIn: Number(counts.checkedIn),
                inTriage: Number(counts.inTriage),
                readyForDoctor: Number(
                    counts.readyForDoctor
                ),
                scheduled: Number(counts.scheduled)
            },

            notifications
        });

    } catch (error) {
        console.error("Nurse dashboard error:", error);

        sendJSON(res, 500, {
            error: "Unable to load nurse dashboard."
        });
    }

    return true;
}