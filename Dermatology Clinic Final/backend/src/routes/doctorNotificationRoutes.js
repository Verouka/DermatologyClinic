import pool from "../database.js";
import { getSession } from "../services/sessionService.js";
import { getDoctorNotificationPreferences } from "../services/doctorNotificationPreferences.js";

function shownByPreferences(notification, settings) {
    const title = String(notification.Title || "");
    if (/appointment reminder/i.test(title) && !settings.appointmentReminders) return false;
    if (/medical (record|update)|diagnosis update|treatment update/i.test(title) && !settings.medicalUpdates) return false;
    return true;
}

export const handleDoctorNotificationRoutes = async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    const readMatch = path.match(/^\/api\/doctor\/notifications\/([1-9]\d*)\/read$/);
    const isList = path === "/api/doctor/notifications" && req.method === "GET";
    const isRead = readMatch !== null && req.method === "PATCH";
    if (!isList && !isRead) return false;

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        });
        res.end(JSON.stringify(data));
    };

    const session = getSession(req);
    if (!session || session.role !== "doctor" || !session.userId || !session.doctorId) {
        sendJSON(401, { error: "Unauthorized" });
        return true;
    }

    try {
        if (isList) {
            const [rows] = await pool.execute(
                `SELECT n.Notification_ID, n.Title, n.Message, n.Created_At, n.Is_Read
                 FROM notification AS n
                 INNER JOIN usercredential AS u ON n.UserID = u.UserID
                 WHERE u.UserID = ? AND u.DOCTOR_Doctor_ID = ?
                 ORDER BY n.Created_At DESC
                 LIMIT 100`,
                [session.userId, session.doctorId]
            );
            const settings = getDoctorNotificationPreferences(session.userId);
            const notifications = rows.filter(item => shownByPreferences(item, settings));
            const unreadCount = notifications.filter(item => !item.Is_Read).length;
            sendJSON(200, { notifications, unreadCount });
            return true;
        }

        const notificationId = Number(readMatch[1]);
        if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
            sendJSON(400, { error: "Invalid notification ID" });
            return true;
        }

        const [result] = await pool.execute(
            `UPDATE notification AS n
             INNER JOIN usercredential AS u ON n.UserID = u.UserID
             SET n.Is_Read = 1
             WHERE n.Notification_ID = ? AND u.UserID = ? AND u.DOCTOR_Doctor_ID = ?`,
            [notificationId, session.userId, session.doctorId]
        );
        if (result.affectedRows === 0) {
            sendJSON(404, { error: "Notification not found" });
        } else {
            sendJSON(200, { message: "Notification marked as read" });
        }
    } catch (error) {
        console.error("Doctor notifications error:", error);
        if (error.code === "ER_NO_SUCH_TABLE") {
            sendJSON(503, {
                error: "The existing database has no notification table. Ask your team whether notifications are supported."
            });
        } else {
            sendJSON(500, { error: "Could not load or update notifications" });
        }
    }
    return true;
};
