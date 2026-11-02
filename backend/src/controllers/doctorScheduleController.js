

export async function getDoctorSchedule(pool, doctorId, weekStart) {
    const [workHours] = await pool.execute(
        `SELECT
            s.Schedule_ID,
            s.Day_of_Week,
            TIME_FORMAT(s.Start_Time, '%H:%i') AS Start_Time,
            TIME_FORMAT(s.End_Time, '%H:%i') AS End_Time,
            s.OFFICE_Office_ID AS Office_ID,
            o.City AS Office_City,
            o.State AS Office_State
         FROM schedule s
         LEFT JOIN office o
            ON o.Office_ID = s.OFFICE_Office_ID
         WHERE s.DOCTOR_Doctor_ID = ?
         ORDER BY FIELD(
            LOWER(s.Day_of_Week),
            'monday', 'tuesday', 'wednesday',
            'thursday', 'friday', 'saturday', 'sunday'
         ), s.Start_Time`,
        [doctorId]
    );

    const [weeklyAppointments] = await pool.execute(
        `SELECT
            a.Appointment_ID,
            DATE_FORMAT(a.Appointment_Date, '%Y-%m-%d')
                AS Appointment_Date,
            TIME_FORMAT(a.Appointment_Time, '%H:%i')
                AS Appointment_Time,
            a.Appointment_Status,
            a.Appointment_Description,
            a.OFFICE_Office_ID,
            p.First_Name,
            p.Middle_Name,
            p.Last_Name
         FROM appointment a
         INNER JOIN patient p
            ON p.Patient_ID = a.PATIENT_Patient_ID
         WHERE a.DOCTOR_Doctor_ID = ?
           AND a.Appointment_Date >= ?
           AND a.Appointment_Date < DATE_ADD(?, INTERVAL 7 DAY)
         ORDER BY a.Appointment_Date, a.Appointment_Time`,
        [doctorId, weekStart, weekStart]
    );

    return {
        workHours,
        weeklyAppointments
    };
}

export async function updateDoctorScheduleAppointment(
    pool,
    doctorId,
    appointmentId,
    action
) {
    const transitions = {
        "start-consultation": {
            from: "Ready for Doctor",
            to: "In Consultation",
            message: "Consultation started successfully."
        },
        "complete": {
            from: "In Consultation",
            to: "Completed",
            message: "Appointment completed successfully."
        }
    };

    const transition = transitions[action];

    if (!transition) {
        return {
            statusCode: 400,
            payload: { error: "Invalid appointment action." }
        };
    }

    const [result] = await pool.execute(
        `UPDATE appointment
         SET Appointment_Status = ?
         WHERE Appointment_ID = ?
           AND DOCTOR_Doctor_ID = ?
           AND Appointment_Date = CURDATE()
           AND LOWER(TRIM(Appointment_Status)) = LOWER(?)`,
        [
            transition.to,
            appointmentId,
            doctorId,
            transition.from
        ]
    );

    if (result.affectedRows === 0) {
        return {
            statusCode: 409,
            payload: {
                error: "Appointment was not found, is not today, or is not in the required status."
            }
        };
    }

    return {
        statusCode: 200,
        payload: {
            message: transition.message,
            appointmentId,
            status: transition.to
        }
    };
}
