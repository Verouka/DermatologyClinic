import pool from "../database.js";
import { getSession } from "../services/sessionService.js";


/* =====================================
   HELPERS
===================================== */

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}


function getAdministratorUserId(session) {
    return Number(
        session.UserID ??
        session.userID ??
        session.userId
    );
}


/* =====================================
   ADMIN NOTIFICATIONS
===================================== */

export async function handleAdminNotificationRoutes(req, res) {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname;

    const BASE_PATH = "/api/admin/notifications";

    if (
        pathname !== BASE_PATH &&
        !pathname.startsWith(`${BASE_PATH}/`)
    ) {
        return false;
    }

    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 401, {
            message: "Unauthorized. Administrator access required."
        });

        return true;
    }

    const userId = getAdministratorUserId(session);

    if (!Number.isInteger(userId) || userId <= 0) {
        sendJSON(res, 403, {
            message: "Administrator session does not contain a valid user ID."
        });

        return true;
    }

    try {
        // GET /api/admin/notifications
        if (
            req.method === "GET" &&
            pathname === BASE_PATH
        ) {
            const [notifications] = await pool.execute(
                `
                SELECT
                    Notification_ID,
                    Title,
                    Message,
                    Is_Read,
                    Created_At
                FROM notification
                WHERE UserID = ?
                  AND Is_Read = 0
                ORDER BY Created_At DESC
                `,
                [userId]
            );

            sendJSON(res, 200, {
                notifications
            });

            return true;
        }

        // PATCH /api/admin/notifications/:id/read
        const markReadMatch = pathname.match(
            /^\/api\/admin\/notifications\/(\d+)\/read$/
        );

        if (
            req.method === "PATCH" &&
            markReadMatch
        ) {
            const notificationId = Number(markReadMatch[1]);

            const [result] = await pool.execute(
                `
                UPDATE notification
                SET Is_Read = 1
                WHERE Notification_ID = ?
                  AND UserID = ?
                `,
                [
                    notificationId,
                    userId
                ]
            );

            if (result.affectedRows === 0) {
                sendJSON(res, 404, {
                    message: "Notification not found."
                });

                return true;
            }

            sendJSON(res, 200, {
                message: "Notification marked as read."
            });

            return true;
        }

        sendJSON(res, 404, {
            message: "Notification route not found."
        });

        return true;

    } catch (error) {
        console.error("Admin notification route error:", error);

        sendJSON(res, 500, {
            message: "An error occurred while processing notifications."
        });

        return true;
    }
}