
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

async function readRequestBody(req, res) {
    let body = "";

    try {
        for await (const chunk of req) {
            body += chunk;

            if (body.length > 10000) {
                sendJSON(res, 413, {
                    error: "Request too large"
                });

                return null;
            }
        }
    } catch (error) {
        console.error("Error reading request body:", error);

        sendJSON(res, 400, {
            error: "Could not read request body"
        });

        return null;
    }

    try {
        return JSON.parse(body);
    } catch {
        sendJSON(res, 400, {
            error: "Invalid JSON"
        });

        return null;
    }
}

export async function handleAdminAppointmentsRoutes(req, res) {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    if (
        !["GET", "DELETE"].includes(req.method) ||
        pathname !== "/api/admin/appointments"
    ) {
        return false;
    }

    // VERIFY ADMINISTRATOR SESSION
    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 403, {
            error: "Administrator access required"
        });

        return true;
    }

    // DELETE APPOINTMENT
    if (req.method === "DELETE") {
        const data = await readRequestBody(req, res);

        if (data === null) {
            return true;
        }

        const appointmentId = Number(data.id);

        if (
            !Number.isSafeInteger(appointmentId) ||
            appointmentId <= 0
        ) {
            sendJSON(res, 400, {
                error: "Invalid appointment ID"
            });

            return true;
        }

        try {
            const [result] = await pool.execute(
                `DELETE FROM appointment
                 WHERE Appointment_ID = ?`,
                [appointmentId]
            );

            if (result.affectedRows === 0) {
                sendJSON(res, 404, {
                    error: "Appointment not found"
                });

                return true;
            }

            sendJSON(res, 200, {
                message: "Appointment deleted successfully",
                id: appointmentId
            });

        } catch (error) {
            console.error(
                "Admin appointment deletion error:",
                error
            );

            if (error.code === "ER_ROW_IS_REFERENCED_2") {
                sendJSON(res, 409, {
                    error:
                        "Cannot delete this appointment because other records reference it."
                });
            } else {
                sendJSON(res, 500, {
                    error: "Could not delete appointment"
                });
            }
        }

        return true;
    }

    // LOAD APPOINTMENTS
    try {
        const [rows] = await pool.execute(`
            SELECT
                a.Appointment_ID AS id,
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

        // GET CURRENT LOCAL DATE AND TIME
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

        // SEPARATE UPCOMING AND PAST APPOINTMENTS
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

        // UPCOMING: SOONEST FIRST
        // PAST: MOST RECENT FIRST
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
