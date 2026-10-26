
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

export const handlePatientAppointmentRoutes = async (req, res) => {

    const path = new URL(req.url, "http://localhost").pathname;

    const isAppointmentRoute =
        path === "/api/patient/appointments" &&
        ["GET", "POST"].includes(req.method);

    const cancelMatch = path.match(
        /^\/api\/patient\/appointments\/([1-9]\d*)\/cancel$/
    );

    const isCancelRoute =
        req.method === "PATCH" && cancelMatch !== null;

    if (!isAppointmentRoute && !isCancelRoute) {
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

    // Cancel the logged-in patient's pending appointment.
    if (isCancelRoute) {
        const appointmentId = Number(cancelMatch[1]);

        if (!Number.isSafeInteger(appointmentId)) {
            sendJSON(400, { error: "Invalid appointment ID" });
            return true;
        }

        let connection;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const [result] = await connection.execute(
                `UPDATE appointment
                 SET Appointment_Status = 'Cancelled'
                 WHERE Appointment_ID = ?
                   AND PATIENT_Patient_ID = ?
                   AND Appointment_Status = 'Pending'
                   AND TIMESTAMP(Appointment_Date, Appointment_Time) > NOW()`,
                [appointmentId, session.patientId]
            );

            if (result.affectedRows === 0) {
                await connection.rollback();

                sendJSON(409, {
                    error: "This appointment cannot be cancelled."
                });
                return true;
            }

            // Create notification for the patient's account.
            await connection.execute(
                `INSERT INTO notification (UserID, Title, Message)
                 SELECT UserID, ?, ?
                 FROM usercredential
                 WHERE PATIENT_Patient_ID = ?`,
                [
                    "Appointment Cancelled",
                    `Your appointment #${appointmentId} has been cancelled successfully.`,
                    session.patientId
                ]
            );

            await connection.commit();

            sendJSON(200, {
                message: "Appointment cancelled successfully"
            });

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }

            console.error("Appointment cancellation error:", error);

            sendJSON(500, {
                error: "Could not cancel appointment"
            });

        } finally {
            if (connection) {
                connection.release();
            }
        }

        return true;
    }

    // Retrieve the logged-in patient's appointments.
    if (req.method === "GET") {
        try {
            const [rows] = await pool.execute(
                `SELECT
                    a.Appointment_ID,
                    a.Appointment_Date,
                    a.Appointment_Time,
                    a.Appointment_Description,
                    a.Appointment_Status,
                    a.DOCTOR_Doctor_ID,
                    a.OFFICE_Office_ID,
                    d.First_Name AS Doctor_First_Name,
                    d.Last_Name AS Doctor_Last_Name,
                    o.Street AS Office_Street,
                    o.City AS Office_City,
                    o.State AS Office_State
                 FROM appointment AS a
                 INNER JOIN doctor AS d
                    ON a.DOCTOR_Doctor_ID = d.Doctor_ID
                 INNER JOIN office AS o
                    ON a.OFFICE_Office_ID = o.Office_ID
                 WHERE a.PATIENT_Patient_ID = ?
                 ORDER BY a.Appointment_Date DESC,
                          a.Appointment_Time DESC`,
                [session.patientId]
            );

            sendJSON(200, rows);

        } catch (error) {
            console.error("Appointment loading error:", error);

            sendJSON(500, {
                error: "Could not load appointments"
            });
        }

        return true;
    }

    // Create an appointment request.
    if (req.method === "POST") {
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

        const {
            officeId,
            doctorId,
            appointmentDate,
            appointmentTime,
            reason
        } = data;

        const validDate =
            typeof appointmentDate === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) &&
            !Number.isNaN(Date.parse(appointmentDate)) &&
            new Date(appointmentDate).toISOString().slice(0, 10) === appointmentDate;

        const validTime =
            typeof appointmentTime === "string" &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime);

        if (
            !Number.isSafeInteger(officeId) || officeId <= 0 ||
            !Number.isSafeInteger(doctorId) || doctorId <= 0 ||
            !validDate ||
            !validTime ||
            typeof reason !== "string" ||
            !reason.trim() ||
            reason.trim().length > 250
        ) {
            sendJSON(400, {
                error: "Invalid appointment information"
            });
            return true;
        }

        const now = new Date();
        const requestedDateTime = new Date(
            `${appointmentDate}T${appointmentTime}:00`
        );

        if (requestedDateTime <= now) {
            sendJSON(400, {
                error: "Please select a future appointment date and time"
            });
            return true;
        }

        let connection;

        try {
            connection = await pool.getConnection();

            // Verify the doctor works at the selected office.
            const [assignments] = await connection.execute(
                `SELECT 1
                 FROM office_has_doctor
                 WHERE OFFICE_Office_ID = ?
                   AND DOCTOR_Doctor_ID = ?
                 LIMIT 1`,
                [officeId, doctorId]
            );

            if (assignments.length === 0) {
                sendJSON(400, {
                    error: "This doctor is not assigned to the selected office"
                });
                return true;
            }

            // Check for conflicting appointments.
            const [conflicts] = await connection.execute(
                `SELECT Appointment_ID
                 FROM appointment
                 WHERE DOCTOR_Doctor_ID = ?
                   AND Appointment_Date = ?
                   AND Appointment_Time = ?
                   AND (
                       Appointment_Status IS NULL
                       OR Appointment_Status NOT IN ('Cancelled', 'Canceled')
                   )
                 LIMIT 1`,
                [doctorId, appointmentDate, appointmentTime]
            );

            if (conflicts.length > 0) {
                sendJSON(409, {
                    error: "This doctor already has an appointment at that time"
                });
                return true;
            }

            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO appointment (
                    Appointment_Status,
                    Appointment_Date,
                    Appointment_Time,
                    Appointment_Description,
                    Booking_Method,
                    PATIENT_Patient_ID,
                    DOCTOR_Doctor_ID,
                    OFFICE_Office_ID
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    "Pending",
                    appointmentDate,
                    appointmentTime,
                    reason.trim(),
                    "Online",
                    session.patientId,
                    doctorId,
                    officeId
                ]
            );

            // Create a notification automatically.
            await connection.execute(
                `INSERT INTO notification (UserID, Title, Message)
                 SELECT UserID, ?, ?
                 FROM usercredential
                 WHERE PATIENT_Patient_ID = ?`,
                [
                    "Appointment Request Submitted",
                    `Your appointment request for ${appointmentDate} at ${appointmentTime} has been submitted and is pending confirmation.`,
                    session.patientId
                ]
            );

            await connection.commit();

            sendJSON(201, {
                message: "Appointment request submitted successfully",
                appointmentId: result.insertId
            });

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }

            console.error("Appointment creation error:", error);

            sendJSON(500, {
                error: "Could not create appointment"
            });

        } finally {
            if (connection) {
                connection.release();
            }
        }

        return true;
    }
};

