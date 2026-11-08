import pool from "../database.js";
import { getSession } from "../services/sessionService.js";
import { validateAllOfficeSchedules } from "./adminScheduleRoutes.js";


/* =====================================
   HELPERS
===================================== */

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}


async function readRequestBody(req) {
    let body = "";

    for await (const chunk of req) {
        body += chunk;
    }

    if (!body) {
        return {};
    }

    return JSON.parse(body);
}


const VALID_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];


/* =====================================
   ADMIN CLINIC INFORMATION ROUTES
===================================== */

export async function handleAdminClinicInfoRoutes(req, res) {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    const isGetRequest =
        req.method === "GET" &&
        pathname === "/api/admin/clinic-info";

    const patchMatch = pathname.match(
        /^\/api\/admin\/clinic-info\/(\d+)$/
    );

    const isPatchRequest =
        req.method === "PATCH" &&
        patchMatch !== null;

    if (!isGetRequest && !isPatchRequest) {
        return false;
    }

    // Check administrator session.
    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 403, {
            error: "Administrator access required."
        });

        return true;
    }

    try {
        // Retrieve all clinic offices.
        if (isGetRequest) {
            const [rows] = await pool.execute(`
                SELECT
                    Office_ID AS officeId,
                    Phone AS phone,
                    Street AS street,
                    City AS city,
                    State AS state,
                    Zip_Code AS zipCode,
                    Open_Time AS openTime,
                    Close_Time AS closeTime,
                    Days_Closed AS daysClosed
                FROM office
                ORDER BY Office_ID ASC
            `);

            sendJSON(res, 200, {
                offices: rows
            });

            return true;
        }

        // Update office hours.
        const officeId = Number(patchMatch[1]);

        if (!Number.isSafeInteger(officeId) || officeId <= 0) {
            sendJSON(res, 400, {
                error: "Invalid office ID."
            });

            return true;
        }

        let body;

        try {
            body = await readRequestBody(req);
        } catch {
            sendJSON(res, 400, {
                error: "Invalid JSON request body."
            });

            return true;
        }

        const { openTime, closeTime, closedDays } = body;

        // Validate opening and closing times.
        const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

        if (
            typeof openTime !== "string" ||
            typeof closeTime !== "string" ||
            !timePattern.test(openTime) ||
            !timePattern.test(closeTime)
        ) {
            sendJSON(res, 400, {
                error: "Please provide valid opening and closing times."
            });

            return true;
        }

        if (openTime >= closeTime) {
            sendJSON(res, 400, {
                error: "Closing time must be later than opening time."
            });

            return true;
        }

        // Validate closed days.
        if (
            !Array.isArray(closedDays) ||
            !closedDays.every(day => VALID_DAYS.includes(day)) ||
            new Set(closedDays).size !== closedDays.length
        ) {
            sendJSON(res, 400, {
                error: "Please provide a valid list of closed days."
            });

            return true;
        }

        // Confirm the office exists.
        const [officeRows] = await pool.execute(
            "SELECT Office_ID FROM office WHERE Office_ID = ?",
            [officeId]
        );

        if (officeRows.length === 0) {
            sendJSON(res, 404, {
                error: "Clinic office not found."
            });

            return true;
        }

        // Save the office hours and closed days.
        await pool.execute(
            `
                UPDATE office
                SET
                    Open_Time = ?,
                    Close_Time = ?,
                    Days_Closed = ?
                WHERE Office_ID = ?
            `,
            [
                `${openTime}:00`,
                `${closeTime}:00`,
                closedDays.join(","),
                officeId
            ]
        );

        // Validate all office schedules using the updated office hours.
        let validationResult;

        try {
            validationResult = await validateAllOfficeSchedules();
        } catch (validationError) {
            console.error(
                "Office schedule validation after hours update failed:",
                validationError
            );

            // The office update already succeeded.
            sendJSON(res, 200, {
                message: "Office hours were updated, but schedule validation could not be completed.",
                validationFailed: true
            });

            return true;
        }

        sendJSON(res, 200, {
            message: "Office hours updated successfully.",
            validation: validationResult
        });

        return true;

    } catch (error) {
        console.error("Admin clinic information error:", error);

        sendJSON(res, 500, {
            error: "Could not process clinic information."
        });

        return true;
    }
}