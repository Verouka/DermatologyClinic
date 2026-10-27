import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

const PATIENT_FIELDS = {
    First_Name: 45,
    Middle_Name: 45,
    Last_Name: 45,
    Email: 45,
    BirthDate: 10,
    Gender: 45,
    Phone: 20,
    Street: 45,
    City: 45,
    State: 45,
    Zip_Code: 10
};

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    res.end(JSON.stringify(data));
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

function validatePatientData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { error: "Invalid patient information" };
    }

    const extraFields = Object.keys(data).filter(field => !(field in PATIENT_FIELDS));
    if (extraFields.length) {
        return { error: `Unexpected field: ${extraFields[0]}` };
    }

    const clean = {};
    for (const [field, maxLength] of Object.entries(PATIENT_FIELDS)) {
        const input = data[field];
        if (input !== undefined && input !== null && typeof input !== "string") {
            return { error: `Invalid ${field}` };
        }
        const value = (input || "").trim();
        if (value.length > maxLength) {
            return { error: `${field} must be ${maxLength} characters or fewer` };
        }
        clean[field] = value || null;
    }

    if (!clean.First_Name || !clean.Last_Name || !clean.Email) {
        return { error: "First name, last name, and email are required" };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.Email)) {
        return { error: "Enter a valid email address" };
    }
    clean.Email = clean.Email.toLowerCase();
    if (clean.BirthDate) {
        if (!validDate(clean.BirthDate) || clean.BirthDate > new Date().toISOString().slice(0, 10)) {
            return { error: "Enter a valid birth date in the past" };
        }
    }
    return { data: clean };
}

async function readJSON(req, res) {
    let body = "";
    try {
        for await (const chunk of req) {
            body += chunk;
            if (Buffer.byteLength(body, "utf8") > 10000) {
                sendJSON(res, 413, { error: "Request too large" });
                return null;
            }
        }
    } catch {
        sendJSON(res, 400, { error: "Could not read request" });
        return null;
    }
    try {
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            sendJSON(res, 400, { error: "Invalid patient information" });
            return null;
        }
        return parsed;
    } catch {
        sendJSON(res, 400, { error: "Invalid JSON" });
        return null;
    }
}

export const handleDoctorPatientManagementRoutes = async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    const patientMatch = path.match(/^\/api\/doctor\/patients\/([1-9]\d*)$/);
    const isCreate = path === "/api/doctor/patients" && req.method === "POST";
    const isView = patientMatch !== null && req.method === "GET";
    const isEdit = patientMatch !== null && req.method === "PATCH";

    if (!isCreate && !isView && !isEdit) return false;

    const session = getSession(req);
    const doctorId = Number(session?.doctorId);
    if (!session || session.role !== "doctor" || !Number.isSafeInteger(doctorId) || doctorId <= 0) {
        sendJSON(res, 401, { error: "Unauthorized" });
        return true;
    }

    let patientId;
    if (patientMatch) {
        patientId = Number(patientMatch[1]);
        if (!Number.isSafeInteger(patientId)) {
            sendJSON(res, 400, { error: "Invalid patient ID" });
            return true;
        }
    }

    if (isView) {
        try {
            const [rows] = await pool.execute(
                `SELECT p.Patient_ID, p.First_Name, p.Middle_Name, p.Last_Name,
                        p.Email, p.BirthDate, p.Gender, p.Phone,
                        p.Date_Admitted, p.Street, p.City, p.State, p.Zip_Code,
                        p.Primary_Care_Doctor_ID
                 FROM patient AS p
                 INNER JOIN doctor_has_patient AS dhp
                    ON dhp.PATIENT_Patient_ID = p.Patient_ID
                 WHERE p.Patient_ID = ? AND dhp.DOCTOR_Doctor_ID = ?
                 LIMIT 1`,
                [patientId, doctorId]
            );
            if (!rows.length) {
                sendJSON(res, 404, { error: "Assigned patient not found" });
            } else {
                sendJSON(res, 200, rows[0]);
            }
        } catch (error) {
            console.error("Doctor patient details error:", error);
            sendJSON(res, 500, { error: "Could not load patient information" });
        }
        return true;
    }

    const payload = await readJSON(req, res);
    if (payload === null) return true;
    const validated = validatePatientData(payload);
    if (validated.error) {
        sendJSON(res, 400, { error: validated.error });
        return true;
    }
    const patient = validated.data;
    const fields = Object.keys(PATIENT_FIELDS);
    const values = fields.map(field => patient[field]);

    if (isCreate) {
        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();
            const [result] = await connection.execute(
                `INSERT INTO patient
                    (${fields.map(field => `\`${field}\``).join(", ")}, Date_Admitted, Primary_Care_Doctor_ID)
                 VALUES (${fields.map(() => "?").join(", ")}, CURDATE(), ?)`,
                [...values, doctorId]
            );
            await connection.execute(
                `INSERT INTO doctor_has_patient (DOCTOR_Doctor_ID, PATIENT_Patient_ID)
                 VALUES (?, ?)`,
                [doctorId, result.insertId]
            );
            await connection.commit();
            sendJSON(res, 201, {
                message: "Patient created and assigned successfully",
                patientId: result.insertId
            });
        } catch (error) {
            if (connection) await connection.rollback();
            console.error("Create patient error:", error);
            sendJSON(res, error.code === "ER_DUP_ENTRY" ? 409 : 500, {
                error: error.code === "ER_DUP_ENTRY"
                    ? "A patient with this email already exists"
                    : "Could not create patient"
            });
        } finally {
            if (connection) connection.release();
        }
        return true;
    }

    try {
        // Only edit patients assigned to the authenticated doctor.
        // Patient_ID, Date_Admitted, Primary_Care_Doctor_ID and credentials are not editable here.
        const [result] = await pool.execute(
            `UPDATE patient AS p
             INNER JOIN doctor_has_patient AS dhp
                ON dhp.PATIENT_Patient_ID = p.Patient_ID
             SET ${fields.map(field => `p.\`${field}\` = ?`).join(", ")}
             WHERE p.Patient_ID = ? AND dhp.DOCTOR_Doctor_ID = ?`,
            [...values, patientId, doctorId]
        );
        if (result.affectedRows === 0) {
            const [existing] = await pool.execute(
                `SELECT 1 FROM doctor_has_patient
                 WHERE DOCTOR_Doctor_ID = ? AND PATIENT_Patient_ID = ? LIMIT 1`,
                [doctorId, patientId]
            );
            if (!existing.length) {
                sendJSON(res, 404, { error: "Assigned patient not found" });
                return true;
            }
        }
        sendJSON(res, 200, {
            message: "Patient information updated successfully",
            patientId
        });
    } catch (error) {
        console.error("Update patient error:", error);
        sendJSON(res, error.code === "ER_DUP_ENTRY" ? 409 : 500, {
            error: error.code === "ER_DUP_ENTRY"
                ? "A patient with this email already exists"
                : "Could not update patient"
        });
    }
    return true;
};
