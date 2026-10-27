

import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

export const handlePatientMedicalRecordsRoutes = async (req, res) => {

    if (
        req.method !== "GET" ||
        req.url !== "/api/patient/medical-records"
    ) {
        return false;
    }

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json"
        });
        res.end(JSON.stringify(data));
    };

    const session = getSession(req);

    if (!session || session.role !== "patient" || !session.patientId) {
        sendJSON(401, { error: "Unauthorized" });
        return true;
    }

    try {
        const patientId = session.patientId;

        const [
            [medicalHistory],
            [allergies],
            [diagnoses],
            [treatments],
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
            prescriptions,
            referrals
        });

    } catch (error) {
        console.error("Medical records loading error:", error);

        sendJSON(500, {
            error: "Could not load medical records"
        });
    }

    return true;
};
