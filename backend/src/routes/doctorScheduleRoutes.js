
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";
import {
    getDoctorSchedule,
    updateDoctorScheduleAppointment
} from "../controllers/doctorScheduleController.js";

function sendJSON(res, statusCode, payload) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    res.end(JSON.stringify(payload));
}

function mondayThisWeek() {
    const now = new Date();
    const monday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    monday.setDate(
        monday.getDate() - (monday.getDay() + 6) % 7
    );

    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, "0");
    const d = String(monday.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}

function validMonday(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return false;
    }

    const date = new Date(`${dateString}T12:00:00Z`);

    return Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === dateString &&
        date.getUTCDay() === 1;
}

export async function handleDoctorScheduleRoutes(req, res) {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname;

    const listing = pathname === "/api/doctor/schedule";

    const actionMatch =
        /^\/api\/doctor\/schedule\/appointments\/([1-9]\d*)\/(start-consultation|complete)$/.exec(pathname);

    if (!listing && !actionMatch) return false;

    if (
        (listing && req.method !== "GET") ||
        (actionMatch && req.method !== "PATCH")
    ) {
        sendJSON(res, 405, { error: "Method not allowed" });
        return true;
    }

    const session = getSession(req);
    const doctorId = Number(session?.doctorId);

    if (
        !session ||
        session.role !== "doctor" ||
        !Number.isSafeInteger(doctorId) ||
        doctorId <= 0
    ) {
        sendJSON(res, 401, {
            error: "Doctor login required"
        });
        return true;
    }

    if (listing) {
        const weekStart =
            url.searchParams.get("weekStart") || mondayThisWeek();

        if (!validMonday(weekStart)) {
            sendJSON(res, 400, {
                error: "weekStart must be a valid Monday (YYYY-MM-DD)."
            });
            return true;
        }

        try {
            const data = await getDoctorSchedule(
                pool,
                doctorId,
                weekStart
            );

            sendJSON(res, 200, data);
        } catch (error) {
            console.error("Doctor schedule loading error:", error);
            sendJSON(res, 500, {
                error: "Could not load doctor schedule"
            });
        }

        return true;
    }

    const appointmentId = Number(actionMatch[1]);

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
        const result = await updateDoctorScheduleAppointment(
            pool,
            doctorId,
            appointmentId,
            actionMatch[2]
        );

        sendJSON(res, result.statusCode, result.payload);
    } catch (error) {
        console.error("Doctor schedule action error:", error);
        sendJSON(res, 500, {
            error: "Could not update appointment status"
        });
    }

    return true;
}


