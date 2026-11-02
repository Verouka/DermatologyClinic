 
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";
 
export const handleDoctorPatientRoutes = async (req, res) => {
 
    const path = new URL(req.url, "http://localhost").pathname;
 
    const patientMatch = path.match(
        /^\/api\/doctor\/patients\/([1-9]\d*)\/records$/
    );
 
    if (
        req.method !== "GET" ||
        (path !== "/api/doctor/patients" && !patientMatch)
    ) {
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
 
    if (!session || session.role !== "doctor" || !session.doctorId) {
        sendJSON(401, { error: "Unauthorized" });
        return true;
    }
 
    const doctorId = session.doctorId;
 
    if (path === "/api/doctor/patients") {
        try {
            const [rows] = await pool.execute(
                `SELECT
                    p.Patient_ID,
                    p.First_Name,
                    p.Middle_Name,
                    p.Last_Name,
                    p.Email,
                    p.Phone,
 
                    (
                        SELECT a.Appointment_Description
                        FROM appointment AS a
                        WHERE a.PATIENT_Patient_ID = p.Patient_ID
                          AND a.DOCTOR_Doctor_ID = dhp.DOCTOR_Doctor_ID
                        ORDER BY a.Appointment_Date DESC,
                                 a.Appointment_Time DESC
                        LIMIT 1
                    ) AS Reason_For_Visit,
 
                    (
                        SELECT d.Diagnosis_Name
                        FROM diagnosis AS d
                        WHERE d.PATIENT_Patient_ID = p.Patient_ID
                          AND d.DOCTOR_Doctor_ID = dhp.DOCTOR_Doctor_ID
                        ORDER BY d.Diagnosis_Date DESC,
                                 d.Diagnosis_ID DESC
                        LIMIT 1
                    ) AS Diagnosis,
 
                    (
                        SELECT t.Treatment_Name
                        FROM treatment AS t
                        WHERE t.PATIENT_Patient_ID = p.Patient_ID
                          AND t.DOCTOR_Doctor_ID = dhp.DOCTOR_Doctor_ID
                        ORDER BY t.Treatment_ID DESC
                        LIMIT 1
                    ) AS Recommended_Treatment
 
                 FROM doctor_has_patient AS dhp
                 INNER JOIN patient AS p
                    ON dhp.PATIENT_Patient_ID = p.Patient_ID
                 WHERE dhp.DOCTOR_Doctor_ID = ?
                 ORDER BY p.Last_Name, p.First_Name`,
                [doctorId]
            );
 
            sendJSON(200, rows);
 
        } catch (error) {
            console.error("Doctor patients loading error:", error);
            sendJSON(500, {
                error: "Could not load assigned patients"
            });
        }
 
        return true;
    }
 
    const patientId = Number(patientMatch[1]);
 
    if (!Number.isSafeInteger(patientId)) {
        sendJSON(400, { error: "Invalid patient ID" });
        return true;
    }
 
    try {
        const [assigned] = await pool.execute(
            `SELECT 1
             FROM doctor_has_patient
             WHERE DOCTOR_Doctor_ID = ?
               AND PATIENT_Patient_ID = ?
             LIMIT 1`,
            [doctorId, patientId]
        );
 
        if (assigned.length === 0) {
            sendJSON(404, { error: "Assigned patient not found" });
            return true;
        }
 
        const [
            [medicalHistory],
            [allergies],
            [diagnoses],
            [treatments],
            [previousTreatments],
            [prescriptions],
            [referrals]
        ] = await Promise.all([
 
            pool.execute(
                `SELECT
                    Medical_History_ID,
                    Family_Member_Name,
                    Relationship,
                    \`Condition\`,
                    Date,
                    Notes
                 FROM medical_history
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Date DESC`,
                [patientId]
            ),
 
            pool.execute(
                `SELECT
                    Allergy_ID,
                    Allergy_Name,
                    Time_Occurred,
                    Notes
                 FROM allergy
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Time_Occurred DESC`,
                [patientId]
            ),
 
            pool.execute(
                `SELECT
                    Diagnosis_ID,
                    Diagnosis_Name,
                    Diagnosis_Description,
                    Diagnosis_Date,
                    DOCTOR_Doctor_ID,
                    APPOINTMENT_Appointment_ID
                 FROM diagnosis
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Diagnosis_Date DESC`,
                [patientId]
            ),
 
            pool.execute(
                `SELECT
                    Treatment_ID,
                    Treatment_Name,
                    Treatment_Description,
                    Treatment_Status,
                    DOCTOR_Doctor_ID
                 FROM treatment
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Treatment_ID DESC`,
                [patientId]
            ),
 
            pool.execute(
                `SELECT
                    Previous_Treatment_ID,
                    \`Condition\`,
                    Treatment_Name,
                    Treatment_Date,
                    Notes
                 FROM previous_treatment
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Treatment_Date DESC`,
                [patientId]
            ),
 
            pool.execute(
                `SELECT
                    Prescription_ID,
                    Medication_Name,
                    Dosage_Value,
                    Dosage_Measurement,
                    Description,
                    DOCTOR_Doctor_ID
                 FROM prescription
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Prescription_ID DESC`,
                [patientId]
            ),
 
            pool.execute(
                `SELECT
                    Referral_ID,
                    Primary_Doctor_ID,
                    Specialist_Doctor_ID,
                    Reason,
                    Referral_Date,
                    Approval_Date,
                    Status
                 FROM referral
                 WHERE PATIENT_Patient_ID = ?
                 ORDER BY Referral_Date DESC`,
                [patientId]
            )
        ]);
 
        sendJSON(200, {
            medicalHistory,
            allergies,
            diagnoses,
            treatments,
            previousTreatments,
            prescriptions,
            referrals
        });
 
    } catch (error) {
        console.error("Doctor patient records error:", error);
 
        sendJSON(500, {
            error: "Could not load patient medical records"
        });
    }
 
    return true;
};
 