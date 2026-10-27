import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

const PROFILE_QUERY = `
    SELECT
        d.Doctor_ID,
        d.First_Name,
        d.Middle_Name,
        d.Last_Name,
        d.Street,
        d.City,
        d.State,
        d.Zip_Code,
        d.Birth_Date,
        d.Phone,
        d.Email,
        d.Gender,
        d.Salary,
        d.Start_Date,
        d.License_Number,
        d.SPECIALTY_Specialty_ID,
        d.NURSE_Nurse_ID,
        s.Specialty_Name,
        s.Specialty_Description,
        n.First_Name AS Nurse_First_Name,
        n.Middle_Name AS Nurse_Middle_Name,
        n.Last_Name AS Nurse_Last_Name,
        n.Email AS Nurse_Email,
        n.Phone AS Nurse_Phone,
        n.OFFICE_Office_ID AS Nurse_Office_ID,
        n.License_Number AS Nurse_License_Number,
        (
            SELECT GROUP_CONCAT(
                od.OFFICE_Office_ID
                ORDER BY od.OFFICE_Office_ID
                SEPARATOR ', '
            )
            FROM office_has_doctor AS od
            WHERE od.DOCTOR_Doctor_ID = d.Doctor_ID
        ) AS Office_ID
    FROM doctor AS d
    LEFT JOIN specialty AS s
        ON s.Specialty_ID = d.SPECIALTY_Specialty_ID
    LEFT JOIN nurse AS n
        ON n.Nurse_ID = d.NURSE_Nurse_ID
    WHERE d.Doctor_ID = ?
    LIMIT 1
`;

const EDITABLE_FIELDS = {
    First_Name: 45,
    Middle_Name: 45,
    Last_Name: 45,
    Email: 45,
    Phone: 20,
    Street: 45,
    City: 45,
    State: 45,
    Zip_Code: 10
};

export const handleDoctorRoutes = async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;

    if (path !== "/api/doctor/me" || !["GET", "PATCH"].includes(req.method)) {
        return false;
    }

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json; charset=utf-8",
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

    if (req.method === "GET") {
        try {
            const [rows] = await pool.execute(PROFILE_QUERY, [doctorId]);

            if (rows.length === 0) {
                sendJSON(404, { error: "Doctor not found" });
                return true;
            }

            sendJSON(200, rows[0]);
        } catch (error) {
            console.error("Doctor profile error:", error);
            sendJSON(500, { error: "Could not load doctor profile" });
        }

        return true;
    }

    let body = "";
    try {
        for await (const chunk of req) {
            body += chunk;

            if (Buffer.byteLength(body, "utf8") > 10000) {
                sendJSON(413, { error: "Request too large" });
                return true;
            }
        }
    } catch {
        sendJSON(400, { error: "Could not read request" });
        return true;
    }

    let data;
    try {
        data = JSON.parse(body);
    } catch {
        sendJSON(400, { error: "Invalid JSON" });
        return true;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        sendJSON(400, { error: "Invalid profile data" });
        return true;
    }

    const fields = Object.keys(data);

    if (
        fields.length === 0 ||
        fields.some(field => !Object.prototype.hasOwnProperty.call(EDITABLE_FIELDS, field))
    ) {
        sendJSON(400, { error: "Invalid profile fields" });
        return true;
    }

    const values = [];

    for (const field of fields) {
        const value = data[field];
        if (typeof value !== "string" || value.trim().length > EDITABLE_FIELDS[field]) {
            sendJSON(400, { error: `Invalid ${field}` });
            return true;
        }

        const text = value.trim();

        if (["First_Name", "Last_Name", "Email"].includes(field) && !text) {
            sendJSON(400, { error: `${field} cannot be empty` });
            return true;
        }

        if (field === "Email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
            sendJSON(400, { error: "Invalid email address" });
            return true;
        }

        if (field === "Phone" && text && !/^\d{3}-\d{3}-\d{4}$/.test(text)) {
            sendJSON(400, { error: "Phone must use 123-456-7890" });
            return true;
        }

        values.push(text);
    }

    try {
        const setClause = fields.map(field => `\`${field}\` = ?`).join(", ");
        const [result] = await pool.execute(
            `UPDATE doctor SET ${setClause} WHERE Doctor_ID = ?`,
            [...values, doctorId]
        );

        if (result.affectedRows === 0) {
            sendJSON(404, { error: "Doctor not found" });
            return true;
        }

        const [rows] = await pool.execute(PROFILE_QUERY, [doctorId]);
        sendJSON(200, {
            message: "Profile updated successfully",
            doctor: rows[0]
        });
    } catch (error) {
        console.error("Doctor profile update error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            sendJSON(409, { error: "Email address is already in use" });
        } else {
            sendJSON(500, { error: "Could not update doctor profile" });
        }
    }

    return true;
};
