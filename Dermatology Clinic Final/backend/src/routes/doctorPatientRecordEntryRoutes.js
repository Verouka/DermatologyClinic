import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

const recordTypes = {
    medicalHistory: {
        table: "medical_history",
        fields: {
            Family_Member_Name: { type: "text", max: 45 },
            Relationship: { type: "text", max: 45 },
            Condition: { type: "text", max: 100, required: true },
            Date: { type: "date" },
            Notes: { type: "text", max: 250 }
        }
    },
    allergies: {
        table: "allergy",
        fields: {
            Allergy_Name: { type: "text", max: 100, required: true },
            Time_Occurred: { type: "datetime" },
            Notes: { type: "text", max: 250 }
        }
    },
    diagnoses: {
        table: "diagnosis",
        doctorId: true,
        appointmentId: true,
        fields: {
            Diagnosis_Name: { type: "text", max: 100, required: true },
            Diagnosis_Description: { type: "text", max: 250 },
            Diagnosis_Date: { type: "date", required: true },
            APPOINTMENT_Appointment_ID: { type: "positiveId", required: true }
        }
    },
    treatments: {
        table: "treatment",
        doctorId: true,
        fields: {
            Treatment_Name: { type: "text", max: 100, required: true },
            Treatment_Description: { type: "text", max: 250 },
            Treatment_Status: { type: "text", max: 45, required: true }
        }
    },
    previousTreatments: {
        table: "previous_treatment",
        fields: {
            Condition: { type: "text", max: 100 },
            Treatment_Name: { type: "text", max: 100, required: true },
            Treatment_Date: { type: "date", required: true },
            Notes: { type: "text", max: 250 }
        }
    },
    prescriptions: {
        table: "prescription",
        doctorId: true,
        fields: {
            Medication_Name: { type: "text", max: 45, required: true },
            Dosage_Value: { type: "decimal", required: true },
            Dosage_Measurement: { type: "text", max: 45, required: true },
            Description: { type: "text", max: 250 }
        }
    }
};

function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validField(input, rule) {
    if (input === null || input === undefined || input === "") {
        return rule.required ? { valid: false } : { valid: true, value: null };
    }
    if (rule.type === "positiveId") {
        return Number.isSafeInteger(input) && input > 0
            ? { valid: true, value: input } : { valid: false };
    }
    if (typeof input !== "string") return { valid: false };
    const value = input.trim();
    if (!value) return rule.required ? { valid: false } : { valid: true, value: null };
    if (rule.type === "text") {
        return value.length <= rule.max ? { valid: true, value } : { valid: false };
    }
    if (rule.type === "date") {
        return validDate(value) ? { valid: true, value } : { valid: false };
    }
    if (rule.type === "datetime") {
        const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
        return match && validDate(match[1])
            ? { valid: true, value: `${match[1]} ${match[2]}:${match[3]}:00` }
            : { valid: false };
    }
    if (rule.type === "decimal") {
        return /^\d{1,8}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0
            ? { valid: true, value } : { valid: false };
    }
    return { valid: false };
}

export const handleDoctorPatientRecordEntryRoutes = async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    const match = path.match(/^\/api\/doctor\/patients\/([1-9]\d*)\/(records|appointments)$/);
    if (!match || (req.method !== "POST" && req.method !== "GET")) return false;
    if ((match[2] === "records" && req.method !== "POST") ||
        (match[2] === "appointments" && req.method !== "GET")) return false;

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        });
        res.end(JSON.stringify(data));
    };

    const session = getSession(req);
    const doctorId = Number(session?.doctorId);
    const patientId = Number(match[1]);
    if (!session || session.role !== "doctor" ||
        !Number.isSafeInteger(doctorId) || doctorId <= 0) {
        sendJSON(401, { error: "Unauthorized" });
        return true;
    }
    if (!Number.isSafeInteger(patientId) || patientId <= 0) {
        sendJSON(400, { error: "Invalid patient ID" });
        return true;
    }

    try {
        const [assigned] = await pool.execute(
            `SELECT 1 FROM doctor_has_patient
             WHERE DOCTOR_Doctor_ID = ? AND PATIENT_Patient_ID = ? LIMIT 1`,
            [doctorId, patientId]
        );
        if (assigned.length === 0) {
            sendJSON(403, { error: "This patient is not assigned to your account" });
            return true;
        }

        if (req.method === "GET") {
            const [rows] = await pool.execute(
                `SELECT Appointment_ID, Appointment_Date, Appointment_Time
                 FROM appointment
                 WHERE PATIENT_Patient_ID = ? AND DOCTOR_Doctor_ID = ?
                 ORDER BY Appointment_Date DESC, Appointment_Time DESC`,
                [patientId, doctorId]
            );
            sendJSON(200, rows);
            return true;
        }

        let body = "";
        for await (const chunk of req) {
            body += chunk;
            if (Buffer.byteLength(body, "utf8") > 10000) {
                sendJSON(413, { error: "Request too large" });
                return true;
            }
        }
        let data;
        try {
            data = JSON.parse(body);
        } catch {
            sendJSON(400, { error: "Invalid JSON" });
            return true;
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            sendJSON(400, { error: "Invalid record" });
            return true;
        }
        const definition = Object.prototype.hasOwnProperty.call(recordTypes, data.type)
            ? recordTypes[data.type] : null;
        if (!definition || !data.fields || typeof data.fields !== "object" ||
            Array.isArray(data.fields)) {
            sendJSON(400, { error: "Invalid record type or fields" });
            return true;
        }
        const allowed = definition.fields;
        if (Object.keys(data.fields).some(field => !Object.hasOwn(allowed, field))) {
            sendJSON(400, { error: "Unrecognized record field" });
            return true;
        }

        const columns = [];
        const values = [];
        for (const [name, rule] of Object.entries(allowed)) {
            const checked = validField(data.fields[name], rule);
            if (!checked.valid) {
                sendJSON(400, { error: `Invalid ${name}` });
                return true;
            }
            columns.push(name);
            values.push(checked.value);
        }

        if (definition.appointmentId) {
            const id = data.fields.APPOINTMENT_Appointment_ID;
            const [validAppointment] = await pool.execute(
                `SELECT 1 FROM appointment
                 WHERE Appointment_ID = ? AND DOCTOR_Doctor_ID = ?
                   AND PATIENT_Patient_ID = ? LIMIT 1`,
                [id, doctorId, patientId]
            );
            if (validAppointment.length === 0) {
                sendJSON(400, { error: "Choose an appointment for this patient and doctor" });
                return true;
            }
        }

        columns.push("PATIENT_Patient_ID");
        values.push(patientId);
        if (definition.doctorId) {
            columns.push("DOCTOR_Doctor_ID");
            values.push(doctorId);
        }

        // The table and column names come exclusively from the server's allowlist.
        const quotedColumns = columns.map(name => `\`${name}\``).join(", ");
        const placeholders = columns.map(() => "?").join(", ");
        const [result] = await pool.execute(
            `INSERT INTO \`${definition.table}\` (${quotedColumns}) VALUES (${placeholders})`,
            values
        );
        sendJSON(201, { message: "Medical record added", recordId: result.insertId, type: data.type });
    } catch (error) {
        console.error("Doctor patient record entry error:", error);
        sendJSON(500, { error: "Could not save medical record" });
    }
    return true;
};
