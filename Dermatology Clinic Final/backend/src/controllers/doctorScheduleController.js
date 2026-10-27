// Reuse the shared MySQL pool; this controller never creates a connection/server.
export async function getDoctorSchedule(pool, doctorId, weekStart) {
    const workHoursSQL = `
        SELECT
            s.Schedule_ID,
            s.Day_of_Week,
            s.Start_Time,
            s.End_Time,
            s.OFFICE_Office_ID AS Office_ID,
            o.City AS Office_City,
            o.State AS Office_State,
            o.Street AS Office_Street
        FROM schedule AS s
        JOIN office AS o ON o.Office_ID = s.OFFICE_Office_ID
        WHERE s.DOCTOR_Doctor_ID = ?
        ORDER BY FIELD(s.Day_of_Week,
            'Monday', 'Tuesday', 'Wednesday', 'Thursday',
            'Friday', 'Saturday', 'Sunday'), s.Start_Time
    `;

    const appointmentsSQL = `
        SELECT
            a.Appointment_ID,
            DATE_FORMAT(a.Appointment_Date, '%Y-%m-%d') AS Appointment_Date,
            a.Appointment_Time,
            a.Appointment_Status,
            a.Appointment_Description,
            a.Booking_Method,
            a.PATIENT_Patient_ID,
            a.OFFICE_Office_ID,
            p.First_Name,
            p.Middle_Name,
            p.Last_Name
        FROM appointment AS a
        JOIN patient AS p ON p.Patient_ID = a.PATIENT_Patient_ID
        WHERE a.DOCTOR_Doctor_ID = ?
          AND a.Appointment_Date >= ?
          AND a.Appointment_Date < DATE_ADD(?, INTERVAL 7 DAY)
        ORDER BY a.Appointment_Date, a.Appointment_Time, a.Appointment_ID
    `;

    const [[workHours], [weeklyAppointments]] = await Promise.all([
        pool.execute(workHoursSQL, [doctorId]),
        pool.execute(appointmentsSQL, [doctorId, weekStart, weekStart])
    ]);

    return { workHours, weeklyAppointments };
}

export async function updateDoctorScheduleAppointment(pool, doctorId, appointmentId, action) {
    const expectedStatus = action === 'start-consultation'
        ? 'ready for doctor'
        : 'in consultation';
    const nextStatus = action === 'start-consultation'
        ? 'In Consultation'
        : 'Completed';

    // This atomic update also prevents changing another doctor's appointment,
    // skipping triage, or overwriting a status changed by a nurse.
    const [result] = await pool.execute(`
        UPDATE appointment
        SET Appointment_Status = ?
        WHERE Appointment_ID = ?
          AND DOCTOR_Doctor_ID = ?
          AND Appointment_Date = CURRENT_DATE()
          AND LOWER(TRIM(COALESCE(Appointment_Status, ''))) = ?
    `, [nextStatus, appointmentId, doctorId, expectedStatus]);

    if (result.affectedRows === 1) {
        return {
            statusCode: 200,
            payload: {
                message: action === 'start-consultation'
                    ? 'Consultation started.'
                    : 'Appointment completed.',
                appointmentId,
                status: nextStatus
            }
        };
    }

    const [rows] = await pool.execute(`
        SELECT Appointment_ID
        FROM appointment
        WHERE Appointment_ID = ? AND DOCTOR_Doctor_ID = ?
        LIMIT 1
    `, [appointmentId, doctorId]);

    if (!rows.length) {
        return {
            statusCode: 404,
            payload: { error: 'Appointment not found for this doctor.' }
        };
    }

    return {
        statusCode: 409,
        payload: {
            error: 'Only today\'s appointments in the required status can be updated. Refresh the schedule to see the latest nurse update.'
        }
    };
}
