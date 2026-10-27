
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

export async function handleAdminAppointmentsRoutes(req, res) {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    if (
        req.method !== "GET" ||
        pathname !== "/api/admin/appointments"
    ) {
        return false;
    }

    // Verify administrator session
    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 403, {
            error: "Administrator access required"
        });

        return true;
    }

    try {
        // Retrieve appointments and their associated doctor names
        const [rows] = await pool.execute(`
            SELECT
                a.Appointment_Date AS appointmentDate,
                a.Appointment_Time AS appointmentTime,
                CONCAT_WS(
                    ' ',
                    d.First_Name,
                    d.Last_Name
                ) AS doctorName,
                a.OFFICE_Office_ID AS officeId,
                a.Appointment_Status AS status
            FROM appointment a
            LEFT JOIN doctor d
                ON d.Doctor_ID = a.DOCTOR_Doctor_ID
            ORDER BY
                a.Appointment_Date ASC,
                a.Appointment_Time ASC
        `);

        // Get the current local date and time
        const now = new Date();

        const today = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("-");

        const currentTime = [
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0"),
            String(now.getSeconds()).padStart(2, "0")
        ].join(":");

        const upcomingAppointments = [];
        const pastAppointments = [];

        // Separate appointments by their scheduled date and time
        for (const appointment of rows) {
            const date = String(
                appointment.appointmentDate
            ).slice(0, 10);

            const time = String(
                appointment.appointmentTime || "00:00:00"
            );

            const isUpcoming =
                date > today ||
                (date === today && time >= currentTime);

            if (isUpcoming) {
                upcomingAppointments.push(appointment);
            } else {
                pastAppointments.push(appointment);
            }
        }

        // Upcoming: soonest first
        // Past: most recent first
        pastAppointments.reverse();

        sendJSON(res, 200, {
            upcomingAppointments,
            pastAppointments
        });

    } catch (error) {
        console.error(
            "Admin appointments loading error:",
            error
        );

        sendJSON(res, 500, {
            error: "Could not load appointments"
        });
    }

    return true;
}
