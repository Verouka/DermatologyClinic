import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json"
    });
    res.end(JSON.stringify(data));
}

async function readBody(req) {
    let raw = "";

    for await (const chunk of req) {
        raw += chunk;

        if (raw.length > 10000) {
            throw new Error("Request too large.");
        }
    }

    try {
        return JSON.parse(raw || "{}");
    } catch {
        throw new Error("Invalid JSON.");
    }
}

function textField(value, maxLength, required = false) {
    const text = value == null ? "" : String(value).trim();

    if (required && !text) {
        throw new Error("A required field is missing.");
    }

    if (text.length > maxLength) {
        throw new Error(`A field exceeds ${maxLength} characters.`);
    }

    return text || null;
}

function validDate(value, withTime = false) {
    if (value == null || value === "") {
        return null;
    }

    const text = String(value);
    const pattern = withTime
        ? /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?$/
        : /^\d{4}-\d{2}-\d{2}$/;

    if (!pattern.test(text) || Number.isNaN(new Date(text).getTime())) {
        throw new Error("Invalid date format.");
    }

    return text.replace("T", " ");
}

async function patientExists(patientId) {
    const [rows] = await pool.execute(
        "SELECT Patient_ID FROM patient WHERE Patient_ID = ? LIMIT 1",
        [patientId]
    );

    return rows.length > 0;
}

export async function handleNursePatientRoutes(req, res) {
    const pathname = new URL(req.url, "http://localhost").pathname;

    if (!pathname.startsWith("/api/nurse/patients")) {
        return false;
    }

    const listRoute = pathname === "/api/nurse/patients";

    const intakeRoute = pathname.match(
        /^\/api\/nurse\/patients\/(\d+)\/intake$/
    );

    const addRoute = pathname.match(
        /^\/api\/nurse\/patients\/(\d+)\/(allergies|history|treatments)$/

    );

    const editRoute = pathname.match(
        /^\/api\/nurse\/patients\/(\d+)\/allergies\/(\d+)$/
    );

    if (!listRoute && !intakeRoute && !addRoute && !editRoute) {
        sendJSON(res, 404, {
            error: "Unknown nurse patient route."
        });
        return true;
    }

    const session = getSession(req);

    if (!session) {
        sendJSON(res, 401, {
            error: "Please log in first."
        });
        return true;
    }

    if (
        String(session.role).toLowerCase() !== "nurse" ||
        !Number.isInteger(Number(session.nurseId)) ||
        Number(session.nurseId) <= 0
    ) {
        sendJSON(res, 403, {
            error: "Nurse access only."
        });
        return true;
    }

    try {
        if (listRoute && req.method === "GET") {
            const [patients] = await pool.execute(`
                SELECT Patient_ID, First_Name, Middle_Name,
                       Last_Name, BirthDate
                FROM patient
                ORDER BY Last_Name, First_Name, Patient_ID
            `);

            sendJSON(res, 200, patients);
            return true;
        }

        if (listRoute) {
            sendJSON(res, 405, {
                error: "Method not allowed."
            });
            return true;
        }

        const match = intakeRoute || addRoute || editRoute;
        const patientId = Number(match[1]);

        if (!(await patientExists(patientId))) {
            sendJSON(res, 404, {
                error: "Patient not found."
            });
            return true;
        }

        if (intakeRoute && req.method === "GET") {
            const [allergies] = await pool.execute(
                `SELECT Allergy_ID, Allergy_Name,
                        Time_Occurred, Notes
                 FROM allergy
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Allergy_ID DESC`,
                [patientId]
            );

            const [history] = await pool.execute(
                `SELECT Medical_History_ID, Family_Member_Name,
                        Relationship, \`Condition\`, \`Date\`, Notes
                 FROM medical_history
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Medical_History_ID DESC`,
                [patientId]
            );

            const [treatments] = await pool.execute(
                `SELECT Previous_Treatment_ID, \`Condition\`,
                        Treatment_Name, Treatment_Date, Notes
                 FROM previous_treatment
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Treatment_Date DESC,
                          Previous_Treatment_ID DESC`,
                [patientId]
            );

            const [diagnoses] = await pool.execute(
                `SELECT Diagnosis_ID, Diagnosis_Name,
                        Diagnosis_Description, Diagnosis_Date,
                        DOCTOR_Doctor_ID,
                        APPOINTMENT_Appointment_ID
                 FROM diagnosis
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Diagnosis_Date DESC, Diagnosis_ID DESC`,
                [patientId]
            );

            const [prescriptions] = await pool.execute(
                `SELECT Prescription_ID, Medication_Name,
                        Dosage_Value, Dosage_Measurement,
                        Description, DOCTOR_Doctor_ID
                 FROM prescription
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Prescription_ID DESC`,
                [patientId]
            );

            sendJSON(res, 200, {
                allergies,
                history,
                treatments,
                diagnoses,
                prescriptions
            });

            return true;
        }

        if (addRoute && req.method === "POST") {
            const data = await readBody(req);
            let result;

            if (addRoute[2] === "allergies") {
                const name = textField(
                    data.Allergy_Name, 100, true
                );
                const occurred = validDate(
                    data.Time_Occurred, true
                );
                const notes = textField(data.Notes, 250);

                [result] = await pool.execute(
                    `INSERT INTO allergy
                     (Allergy_Name, Time_Occurred, Notes,
                      PATIENT_Patient_ID)
                     VALUES (?, ?, ?, ?)`,
                    [name, occurred, notes, patientId]
                );

            } else if (addRoute[2] === "history") {
                const familyMember = textField(
                    data.Family_Member_Name, 45, true
                );
                const relationship = textField(
                    data.Relationship, 45, true
                );
                const condition = textField(
                    data.Condition, 100, true
                );
                const date = validDate(data.Date);
                const notes = textField(data.Notes, 250);

                [result] = await pool.execute(
                    `INSERT INTO medical_history
                     (Family_Member_Name, Relationship,
                      \`Condition\`, \`Date\`, Notes,
                      PATIENT_Patient_ID)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        familyMember,
                        relationship,
                        condition,
                        date,
                        notes,
                        patientId
                    ]
                );

            } else {
                const condition = textField(
                    data.Condition, 100, true
                );
                const treatmentName = textField(
                    data.Treatment_Name, 100, true
                );
                const treatmentDate = validDate(
                    data.Treatment_Date
                );
                const notes = textField(data.Notes, 250);

                [result] = await pool.execute(
                    `INSERT INTO previous_treatment
                     (\`Condition\`, Treatment_Name,
                      Treatment_Date, Notes,
                      PATIENT_Patient_ID)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        condition,
                        treatmentName,
                        treatmentDate,

                        notes,
                        patientId
                    ]
                );
            }

            sendJSON(res, 201, {
                id: result.insertId
            });
            return true;
        }

        if (editRoute && req.method === "PATCH") {
            const data = await readBody(req);
            const name = textField(
                data.Allergy_Name, 100, true
            );
            const occurred = validDate(
                data.Time_Occurred, true
            );
            const notes = textField(data.Notes, 250);
            const allergyId = Number(editRoute[2]);

            const [result] = await pool.execute(
                `UPDATE allergy
                 SET Allergy_Name = ?,
                     Time_Occurred = ?,
                     Notes = ?
                 WHERE Allergy_ID = ?
                   AND PATIENT_Patient_ID = ?`,
                [
                    name,
                    occurred,
                    notes,
                    allergyId,
                    patientId
                ]
            );

            if (!result.affectedRows) {
                sendJSON(res, 404, {
                    error: "Allergy not found for this patient."
                });
            } else {
                sendJSON(res, 200, {
                    success: true
                });
            }

            return true;
        }

        sendJSON(res, 405, {
            error: "Method not allowed."
        });

    } catch (error) {
        if (/Invalid|missing|exceeds|large/i.test(error.message)) {
            sendJSON(res, 400, {
                error: error.message
            });
        } else {
            console.error("Nurse patient intake error:", error);

            sendJSON(res, 500, {
                error: "Could not process patient intake request."
            });
        }
    }

    return true;
}