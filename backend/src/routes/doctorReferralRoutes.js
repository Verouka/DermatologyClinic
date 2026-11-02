 
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";
 
export const handleDoctorReferralRoutes = async (req, res) => {
 
    const path = new URL(req.url, "http://localhost").pathname;
 
    const decisionMatch = path.match(
        /^\/api\/doctor\/referrals\/([1-9]\d*)\/decision$/
    );
 
    const listRoute =
        path === "/api/doctor/referrals" &&
        req.method === "GET";
 
    const decisionRoute =
        decisionMatch !== null &&
        req.method === "PATCH";
 
    if (!listRoute && !decisionRoute) {
        return false;
    }
 
    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        });
 
        res.end(JSON.stringify(data));
    };
 
    const session = getSession(req);
 
    const doctorId = Number(session?.doctorId);
 
    if (
        !session ||
        session.role !== "doctor" ||
        !Number.isSafeInteger(doctorId) ||
        doctorId <= 0
    ) {
        sendJSON(401, { error: "Unauthorized" });
        return true;
    }
 
    if (listRoute) {
        try {
            const [rows] = await pool.execute(
                `SELECT
                    r.Referral_ID,
                    r.PATIENT_Patient_ID,
                    r.Primary_Doctor_ID,
                    r.Specialist_Doctor_ID,
                    r.Reason,
                    r.Referral_Date,
                    r.Approval_Date,
                    r.Status,
 
                    p.First_Name AS Patient_First_Name,
                    p.Last_Name AS Patient_Last_Name,
 
                    d.First_Name AS Specialist_First_Name,
                    d.Last_Name AS Specialist_Last_Name,
                    CASE
                        WHEN r.Primary_Doctor_ID = ? THEN 1
                        ELSE 0
                    END AS Can_Decide
 
                 FROM referral AS r
 
                 INNER JOIN patient AS p
                    ON r.PATIENT_Patient_ID = p.Patient_ID
 
                 LEFT JOIN doctor AS d
                    ON r.Specialist_Doctor_ID = d.Doctor_ID
 
                 WHERE r.Primary_Doctor_ID = ?
                    OR r.Specialist_Doctor_ID = ?
                    OR EXISTS (
                        SELECT 1
                        FROM doctor_has_patient AS dhp
                        WHERE dhp.DOCTOR_Doctor_ID = ?
                          AND dhp.PATIENT_Patient_ID = r.PATIENT_Patient_ID
                    )
 
                 ORDER BY
                    r.Referral_Date DESC,
                    r.Referral_ID DESC`,
                [
                    doctorId,
                    doctorId,
                    doctorId,
                    doctorId
                ]
            );
 
            sendJSON(200, rows);
 
        } catch (error) {
            console.error("Referral loading error:", error);
 
            sendJSON(500, {
                error: "Could not load referrals"
            });
        }
 
        return true;
    }
 
    const referralId = Number(decisionMatch[1]);
 
    if (!Number.isSafeInteger(referralId)) {
        sendJSON(400, { error: "Invalid referral ID" });
        return true;
    }
 
    let body = "";
 
    try {
        for await (const chunk of req) {
            body += chunk;
 
            if (Buffer.byteLength(body, "utf8") > 10000) {
                sendJSON(413, {
                    error: "Request too large"
                });
                return true;
            }
        }
    } catch {
        sendJSON(400, {
            error: "Could not read request"
        });
        return true;
    }
 
    let data;
 
    try {
        data = JSON.parse(body);
    } catch {
        sendJSON(400, {
            error: "Invalid JSON"
        });
        return true;
    }
 
    const allowedStatuses = [
        "Approved",
        "Denied",
        "Canceled"
    ];
 
    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        !allowedStatuses.includes(data.status)
    ) {
        sendJSON(400, {
            error: "Status must be Approved, Denied, or Canceled"
        });
        return true;
    }
 
    try {
        const [result] = await pool.execute(
            `UPDATE referral
             SET
                Status = ?,
                Approval_Date = CASE
                    WHEN ? = 'Approved' THEN CURDATE()
                    ELSE NULL
                END
             WHERE Referral_ID = ?
               AND Primary_Doctor_ID = ?
               AND LOWER(TRIM(Status)) = 'pending'`,
            [
                data.status,
                data.status,
                referralId,
                doctorId
            ]
        );
 
        if (result.affectedRows === 0) {
            const [matches] = await pool.execute(
                `SELECT Status
                 FROM referral
                 WHERE Referral_ID = ?
                   AND Primary_Doctor_ID = ?
                 LIMIT 1`,
                [
                    referralId,
                    doctorId
                ]
            );
 
            if (matches.length === 0) {
                sendJSON(404, {
                    error: "Referral not found or you are not its primary doctor"
                });
            } else {
                sendJSON(409, {
                    error: "Only pending referrals can be updated"
                });
            }
 
            return true;
        }
 
        sendJSON(200, {
            message: `Referral ${data.status.toLowerCase()} successfully`,
            referralId: referralId,
            status: data.status
        });
 
    } catch (error) {
        console.error("Referral update error:", error);
 
        sendJSON(500, {
            error: "Could not update referral"
        });
    }
 
    return true;
};
 