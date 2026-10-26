import pool from "./database.js";

// Helper to parse JSON body
const parseBody = (req) => new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
});

export async function getPatientsList(req, res) {
    try {
        const [rows] = await pool.query("SELECT Patient_ID, First_Name, Last_Name, BirthDate FROM patient");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(rows));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}

export async function getPatientIntakeRecords(req, res, patientId) {
    try {
        const [allergies] = await pool.query("SELECT * FROM allergy WHERE PATIENT_Patient_ID = ?", [patientId]);
        const [history] = await pool.query("SELECT * FROM medical_history WHERE PATIENT_Patient_ID = ?", [patientId]);
        const [treatments] = await pool.query("SELECT * FROM previous_treatment WHERE PATIENT_Patient_ID = ?", [patientId]);
        
        const [diagnoses] = await pool.query(`
            SELECT Diagnosis_Name AS Name, Diagnosis_Description AS Details, Diagnosis_Date AS Date, 'Diagnosis' AS Type 
            FROM diagnosis WHERE PATIENT_Patient_ID = ?
        `, [patientId]);

        const [prescriptions] = await pool.query(`
            SELECT Medication_Name AS Name, CONCAT('Dosage: ', Dosage_Value, ' ', Dosage_Measurement, ' - ', Description) AS Details, '' AS Date, 'Prescription' AS Type 
            FROM prescription WHERE PATIENT_Patient_ID = ?
        `, [patientId]);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            allergies,
            history,
            treatments,
            doctorRecords: [...diagnoses, ...prescriptions]
        }));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}

export async function addAllergyRecord(req, res, patientId) {
    try {
        const data = await parseBody(req);
        await pool.query(
            "INSERT INTO allergy (Allergy_Name, Time_Occurred, Notes, PATIENT_Patient_ID) VALUES (?, ?, ?, ?)",
            [data.Allergy_Name, data.Time_Occurred, data.Notes, patientId]
        );
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}

export async function addMedicalHistoryRecord(req, res, patientId) {
    try {
        const data = await parseBody(req);
        await pool.query(
            "INSERT INTO medical_history (Family_Member_Name, Relationship, Condition, Date, Notes, PATIENT_Patient_ID) VALUES (?, ?, ?, ?, ?, ?)",
            [data.Family_Member_Name, data.Relationship, data.Condition, data.Date, data.Notes || "", patientId]
        );
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}

export async function addPreviousTreatmentRecord(req, res, patientId) {
    try {
        const data = await parseBody(req);
        await pool.query(
            "INSERT INTO previous_treatment (Condition, Treatment_Name, Treatment_Date, Notes, PATIENT_Patient_ID) VALUES (?, ?, ?, ?, ?)",
            [data.Condition, data.Treatment_Name, data.Treatment_Date, data.Notes, patientId]
        );
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}