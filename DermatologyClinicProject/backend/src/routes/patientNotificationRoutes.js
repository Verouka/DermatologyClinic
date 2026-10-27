

import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

export const handlePatientNotificationRoutes = async (req, res) => {
    const path = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    const isListRequest =
        req.method === "GET" &&
        path === "/api/patient/notifications";

    const readMatch = path.match(
        /^\/api\/patient\/notifications\/(\d+)\/read$/
    );

    const isReadRequest =
        req.method === "PATCH" && readMatch;

    if (!isListRequest && !isReadRequest) {
        return false;
    }

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json"
        });
        res.end(JSON.stringify(data));
    };

    const session = getSession(req);

    if (
        !session ||
        session.role !== "patient" ||
        !session.userId ||
        !session.patientId
    ) {
        sendJSON(401, {
            error: "Unauthorized"
        });
        return true;
    }

    try {
        if (isListRequest) {
            const [notifications] = await pool.execute(
                `SELECT
                    Notification_ID,
                    Title,
                    Message,
                    Is_Read,
                    Created_At
                 FROM notification
                 WHERE UserID = ?
                 ORDER BY Created_At DESC, Notification_ID DESC
                 LIMIT 50`,
                [session.userId]
            );

            const [countRows] = await pool.execute(
                `SELECT COUNT(*) AS unreadCount
                 FROM notification
                 WHERE UserID = ? AND Is_Read = 0`,
                [session.userId]
            );

            sendJSON(200, {
                notifications,
                unreadCount: countRows[0].unreadCount
            });

            return true;
        }

        if (isReadRequest) {
            const notificationId = Number(readMatch[1]);

            if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
                sendJSON(400, {
                    error: "Invalid notification ID"
                });
                return true;
            }

            const [result] = await pool.execute(
                `UPDATE notification
                 SET Is_Read = 1
                 WHERE Notification_ID = ?
                 AND UserID = ?`,
                [notificationId, session.userId]
            );

            if (result.affectedRows === 0) {
                sendJSON(404, {
                    error: "Notification not found"
                });
                return true;
            }

            sendJSON(200, {
                message: "Notification marked as read"
            });

            return true;
        }
    } catch (error) {
        console.error("Notification error:", error);

        sendJSON(500, {
            error: "Could not process notifications"
        });

        return true;
    }
};
