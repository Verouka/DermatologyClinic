
import pool from "../database.js";

export async function getAppointments(req, res, sendJSON) {
    const [rows] = await pool.query(`
        SELECT
            a.Appointment_ID AS id,
            a.PATIENT_Patient_ID AS patientId,
            a.DOCTOR_Doctor_ID AS doctorId,
            DATE_FORMAT(a.Appointment_Date, '%Y-%m-%d') AS date,
            TIME_FORMAT(a.Appointment_Time, '%H:%i') AS time,
            a.Appointment_Description AS reason,
            COALESCE(a.Appointment_Status, 'Pending') AS status,
            'Scheduled' AS visitStatus
        FROM appointment a
        ORDER BY a.Appointment_Date, a.Appointment_Time
    `);

    return sendJSON(res, 200, rows);
}

export async function createAppointment(req, res, sendJSON, readBody) {
    const body = await readBody(req);
    const { patientId, doctorId, date, time, reason, status } = body;

    if (!patientId || !doctorId || !date || !time) {
        return sendJSON(res, 400, {
            error: "Patient, doctor, date, and time are required."
        });
    }

    const [patients] = await pool.execute(
        "SELECT Patient_ID FROM patient WHERE Patient_ID = ?",
        [patientId]
    );

    if (patients.length === 0) {
        return sendJSON(res, 400, {
            error: "The selected patient does not exist."
        });
    }

    const [doctors] = await pool.execute(`
        SELECT OFFICE_Office_ID
        FROM office_has_doctor
        WHERE DOCTOR_Doctor_ID = ?
        ORDER BY OFFICE_Office_ID
        LIMIT 1
    `, [doctorId]);

    if (doctors.length === 0) {
        return sendJSON(res, 400, {
            error: "The selected doctor is not assigned to an office."
        });
    }

    const [conflicts] = await pool.execute(`
        SELECT Appointment_ID
        FROM appointment
        WHERE Appointment_Date = ?
          AND Appointment_Time = ?
          AND (
              PATIENT_Patient_ID = ?
              OR DOCTOR_Doctor_ID = ?
          )
          AND COALESCE(Appointment_Status, '') != 'Cancelled'
    `, [date, time, patientId, doctorId]);

    if (conflicts.length > 0) {
        return sendJSON(res, 409, {
            error: "The patient or doctor already has an appointment at that time."
        });
    }

    const allowedStatuses = [
        "Pending", "Scheduled", "Cancelled", "Rejected"
    ];

    const appointmentStatus = status || "Scheduled";

    if (!allowedStatuses.includes(appointmentStatus)) {
        return sendJSON(res, 400, {
            error: "Invalid appointment status."
        });
    }

    const [result] = await pool.execute(`
        INSERT INTO appointment (
            Appointment_Status,
            Appointment_Date,
            Appointment_Time,
            Appointment_Description,
            Booking_Method,
            PATIENT_Patient_ID,
            DOCTOR_Doctor_ID,
            OFFICE_Office_ID
        )
        VALUES (?, ?, ?, ?, 'Receptionist', ?, ?, ?)
    `, [
        appointmentStatus,
        date,
        time,
        reason || null,
        patientId,
        doctorId,
        doctors[0].OFFICE_Office_ID
    ]);

    return sendJSON(res, 201, {
        id: result.insertId,
        patientId: Number(patientId),
        doctorId: Number(doctorId),
        date,
        time,
        reason: reason || "",
        status: appointmentStatus,
        visitStatus: "Scheduled"
    });
}

export async function updateAppointment(req, res, sendJSON, readBody, id) {
    const body = await readBody(req);

    const fields = {
        status: "Appointment_Status",
        date: "Appointment_Date",
        time: "Appointment_Time",
        reason: "Appointment_Description"
    };

    const updates = [];
    const values = [];

    for (const [key, column] of Object.entries(fields)) {
        if (body[key] !== undefined) {
            if (key === "status" &&
                !["Pending", "Scheduled", "Cancelled", "Rejected"].includes(body[key])) {
                return sendJSON(res, 400, {
                    error: "Invalid appointment status."
                });
            }

            updates.push(`${column} = ?`);
            values.push(body[key]);
        }
    }

    if (body.patientId !== undefined) {
        updates.push("PATIENT_Patient_ID = ?");
        values.push(body.patientId);
    }

    if (body.doctorId !== undefined) {
        updates.push("DOCTOR_Doctor_ID = ?");
        values.push(body.doctorId);
    }

    if (updates.length === 0) {
        return sendJSON(res, 400, {
            error: "No supported appointment fields were provided."
        });
    }

    values.push(id);

    const [result] = await pool.execute(
        `UPDATE appointment SET ${updates.join(", ")}
         WHERE Appointment_ID = ?`,
        values
    );

    const [rows] = await pool.execute(`
        SELECT
            Appointment_ID AS id,
            PATIENT_Patient_ID AS patientId,
            DOCTOR_Doctor_ID AS doctorId,
            DATE_FORMAT(Appointment_Date, '%Y-%m-%d') AS date,
            TIME_FORMAT(Appointment_Time, '%H:%i') AS time,
            Appointment_Description AS reason,
            COALESCE(Appointment_Status, 'Pending') AS status,
            'Scheduled' AS visitStatus
        FROM appointment
        WHERE Appointment_ID = ?
    `, [id]);

    if (rows.length === 0) {
        return sendJSON(res, 404, {
            error: "Appointment not found."
        });
    }

    return sendJSON(res, 200, rows[0]);
}
