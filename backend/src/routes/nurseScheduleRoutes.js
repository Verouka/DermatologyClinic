import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

export async function handleNurseScheduleRoutes(req, res) {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    if (pathname !== "/api/nurse/schedule") {
        return false;
    }

    if (req.method !== "GET") {
        sendJSON(res, 405, {
            error: "Method not allowed."
        });
        return true;
    }

    try {
        const session = getSession(req);

        if (!session) {
            sendJSON(res, 401, {
                error: "Please log in first."
            });
            return true;
        }

        if (String(session.role).toLowerCase() !== "nurse") {
            sendJSON(res, 403, {
                error: "Nurse access only."
            });
            return true;
        }

        const nurseId = Number(session.nurseId);

        if (!Number.isInteger(nurseId) || nurseId <= 0) {
            sendJSON(res, 403, {
                error: "No nurse record is linked to this account."
            });
            return true;
        }

        const sql = `
            SELECT
                s.Schedule_ID,
                s.Day_of_week AS dayOfWeek,
                TIME_FORMAT(s.Start_Time, '%H:%i') AS startTime,
                TIME_FORMAT(s.End_Time, '%H:%i') AS endTime,
                s.OFFICE_Office_ID AS officeId,
                o.Street,
                o.City,
                o.State,
                d.First_Name AS doctorFirstName,
                d.Last_Name AS doctorLastName
            FROM schedule s
            LEFT JOIN office o
                ON o.Office_ID = s.OFFICE_Office_ID
            LEFT JOIN doctor d
                ON d.Doctor_ID = s.DOCTOR_Doctor_ID
            INNER JOIN nurse n
                ON n.Nurse_ID = s.NURSE_Nurse_ID
            WHERE s.NURSE_Nurse_ID = ?
              AND s.OFFICE_Office_ID = n.OFFICE_Office_ID
            ORDER BY
                FIELD(
                    LOWER(s.Day_of_week),
                    'monday',
                    'tuesday',
                    'wednesday',
                    'thursday',
                    'friday',
                    'saturday',
                    'sunday'
                ),
                s.Start_Time
        `;

        const [rows] = await pool.execute(sql, [nurseId]);

        const schedule = rows.map(row => {
            const officeAddress = [
                row.Street,
                row.City,
                row.State
            ].filter(Boolean).join(", ");

            return {
                scheduleId: row.Schedule_ID,
                dayOfWeek: row.dayOfWeek,
                startTime: row.startTime,
                endTime: row.endTime,
                office: row.officeId
                    ? `Office #${row.officeId}${
                        officeAddress ? " - " + officeAddress : ""
                    }`
                    : "Not assigned",
                doctor: row.doctorFirstName && row.doctorLastName
                    ? `Dr. ${row.doctorFirstName} ${row.doctorLastName}`
                    : "Not assigned"
            };
        });

        sendJSON(res, 200, schedule);

    } catch (error) {
        console.error("Nurse schedule error:", error);

        sendJSON(res, 500, {
            error: "Could not load nurse schedule."
        });
    }

    return true;
}