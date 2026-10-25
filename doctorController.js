import pool from "../database.js";

// All Doctor queries use the existing MySQL connection from database.js.
// The doctor ID must come from the team's authenticated login, not the URL.
export function createDoctorController(db = pool) {

    // DASHBOARD OVERVIEW
    async function getDashboard(doctorId) {
        const [[patients], [appointments], [referrals]] = await Promise.all([
            db.execute(`
                SELECT COUNT(*) AS total
                FROM doctor_has_patient
                WHERE DOCTOR_Doctor_ID = ?
            `, [doctorId]),
            db.execute(`
                SELECT COUNT(*) AS total
                FROM appointment
                WHERE DOCTOR_Doctor_ID = ?
                  AND Appointment_Date >= CURRENT_DATE()
            `, [doctorId]),
            db.execute(`
                SELECT COUNT(*) AS total
                FROM referral
                WHERE Primary_Doctor_ID = ?
                  AND LOWER(Status) = 'pending'
            `, [doctorId])
        ]);

        return {
            assignedPatients: patients[0].total,
            upcomingAppointments: appointments[0].total,
            pendingReferrals: referrals[0].total
        };
    }

    // DOCTOR PROFILE + ASSIGNED NURSE
    async function getProfile(doctorId) {
        const [rows] = await db.execute(`
            SELECT
                d.Doctor_ID,
                d.First_Name, d.Middle_Name, d.Last_Name,
                d.Street, d.City, d.State, d.Zip_Code,
                d.Birth_Date, d.Phone, d.Email, d.Gender,
                d.Salary, d.Start_Date, d.License_Number,
                d.SPECIALTY_Specialty_ID,
                s.Specialty_Name, s.Specialty_Description,
                n.Nurse_ID AS Assigned_Nurse_ID,
                n.First_Name AS Nurse_First_Name,
                n.Middle_Name AS Nurse_Middle_Name,
                n.Last_Name AS Nurse_Last_Name,
                n.Email AS Nurse_Email,
                n.Phone AS Nurse_Phone,
                n.License_Number AS Nurse_License_Number,
                n.OFFICE_Office_ID AS Nurse_Office_ID
            FROM doctor AS d
            JOIN specialty AS s
              ON d.SPECIALTY_Specialty_ID = s.Specialty_ID
            JOIN nurse AS n
              ON d.NURSE_Nurse_ID = n.Nurse_ID
            WHERE d.Doctor_ID = ?
        `, [doctorId]);

        return rows[0] || null;
    }

    // ASSIGNED PATIENTS + LATEST VISIT, DIAGNOSIS, AND TREATMENT
    async function getPatients(doctorId) {
        const [rows] = await db.execute(`
            SELECT
                p.Patient_ID,
                p.First_Name, p.Middle_Name, p.Last_Name,
                p.BirthDate, p.Phone, p.Email,
                (
                    SELECT a.Appointment_Description
                    FROM appointment AS a
                    WHERE a.PATIENT_Patient_ID = p.Patient_ID
                      AND a.DOCTOR_Doctor_ID = ?
                    ORDER BY a.Appointment_Date DESC, a.Appointment_Time DESC
                    LIMIT 1
                ) AS Reason_For_Visit,
                (
                    SELECT d.Diagnosis_Name
                    FROM diagnosis AS d
                    WHERE d.PATIENT_Patient_ID = p.Patient_ID
                      AND d.DOCTOR_Doctor_ID = ?
                    ORDER BY d.Diagnosis_Date DESC, d.Diagnosis_ID DESC
                    LIMIT 1
                ) AS Latest_Diagnosis,
                (
                    SELECT t.Treatment_Name
                    FROM treatment AS t
                    WHERE t.PATIENT_Patient_ID = p.Patient_ID
                      AND t.DOCTOR_Doctor_ID = ?
                    ORDER BY t.Treatment_ID DESC
                    LIMIT 1
                ) AS Latest_Treatment
            FROM doctor_has_patient AS dp
            JOIN patient AS p
              ON dp.PATIENT_Patient_ID = p.Patient_ID
            WHERE dp.DOCTOR_Doctor_ID = ?
            ORDER BY p.Last_Name, p.First_Name
        `, [doctorId, doctorId, doctorId, doctorId]);

        return rows;
    }

    // MEDICAL HISTORY, ALLERGIES, DIAGNOSES, TREATMENTS, PRESCRIPTIONS
    async function getPatientRecords(doctorId, patientId) {
        // Make sure this patient is assigned to this doctor first.
        const [assigned] = await db.execute(`
            SELECT 1 FROM doctor_has_patient
            WHERE DOCTOR_Doctor_ID = ? AND PATIENT_Patient_ID = ?
            LIMIT 1
        `, [doctorId, patientId]);

        if (!assigned.length) return null;

        const [patients] = await db.execute(`
            SELECT Patient_ID, First_Name, Middle_Name, Last_Name,
                   BirthDate, Phone, Email
            FROM patient WHERE Patient_ID = ?
        `, [patientId]);
        if (!patients.length) return null;

        const queries = [
            `SELECT Medical_History_ID, Family_Member_Name, Relationship,
                    \`Condition\`, \`Date\`, Notes
             FROM medical_history WHERE PATIENT_Patient_ID = ?`,
            `SELECT Allergy_ID, Allergy_Name, Time_Occurred, Notes
             FROM allergy WHERE PATIENT_Patient_ID = ?`,
            `SELECT Previous_Treatment_ID, \`Condition\`, Treatment_Name,
                    Treatment_Date, Notes
             FROM previous_treatment WHERE PATIENT_Patient_ID = ?`,
            `SELECT Diagnosis_ID, Diagnosis_Name, Diagnosis_Description,
                    Diagnosis_Date, DOCTOR_Doctor_ID, APPOINTMENT_Appointment_ID
             FROM diagnosis WHERE PATIENT_Patient_ID = ?`,
            `SELECT Treatment_ID, Treatment_Name, Treatment_Description,
                    Treatment_Status, DOCTOR_Doctor_ID
             FROM treatment WHERE PATIENT_Patient_ID = ?`,
            `SELECT Prescription_ID, Medication_Name, Dosage_Value,
                    Dosage_Measurement, Description, DOCTOR_Doctor_ID
             FROM prescription WHERE PATIENT_Patient_ID = ?`
        ];

        const results = await Promise.all(
            queries.map(sql => db.execute(sql, [patientId]))
        );
        const [history, allergies, previousTreatments, diagnoses,
               treatments, prescriptions] = results.map(result => result[0]);

        return {
            patient: patients[0],
            medicalHistory: history,
            allergies,
            previousTreatments,
            diagnoses,
            treatments,
            prescriptions
        };
    }

    // UPCOMING OR PAST APPOINTMENTS
    async function getAppointments(doctorId, scope = "upcoming") {
        let dateFilter = "AND a.Appointment_Date >= CURRENT_DATE()";
        if (scope === "past") dateFilter = "AND a.Appointment_Date < CURRENT_DATE()";
        if (scope === "all") dateFilter = "";

        const [rows] = await db.execute(`
            SELECT
                a.Appointment_ID, a.Appointment_Date, a.Appointment_Time,
                a.Appointment_Status, a.Appointment_Description,
                a.Booking_Method, a.OFFICE_Office_ID,
                o.City AS Office_City, o.State AS Office_State,
                p.Patient_ID, p.First_Name AS Patient_First_Name,
                p.Last_Name AS Patient_Last_Name
            FROM appointment AS a
            JOIN patient AS p ON a.PATIENT_Patient_ID = p.Patient_ID
            JOIN office AS o ON a.OFFICE_Office_ID = o.Office_ID
            WHERE a.DOCTOR_Doctor_ID = ?
            ${dateFilter}
            ORDER BY a.Appointment_Date, a.Appointment_Time
        `, [doctorId]);

        return rows;
    }

    // WORK SCHEDULE AND THE WEEK'S ASSIGNED APPOINTMENTS
    async function getSchedule(doctorId) {
        const [[workHours], [appointments]] = await Promise.all([
            db.execute(`
                SELECT s.Schedule_ID, s.Day_of_Week,
                       s.Start_Time, s.End_Time,
                       o.Office_ID, o.City AS Office_City,
                       o.State AS Office_State
                FROM schedule AS s
                JOIN office AS o ON s.OFFICE_Office_ID = o.Office_ID
                WHERE s.DOCTOR_Doctor_ID = ?
                ORDER BY FIELD(s.Day_of_Week,
                    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
                    'Friday', 'Saturday', 'Sunday'), s.Start_Time
            `, [doctorId]),
            db.execute(`
                SELECT a.Appointment_ID, a.Appointment_Date,
                       a.Appointment_Time, a.Appointment_Status,
                       a.Appointment_Description,
                       p.Patient_ID, p.First_Name, p.Last_Name,
                       o.Office_ID, o.City AS Office_City
                FROM appointment AS a
                JOIN patient AS p ON a.PATIENT_Patient_ID = p.Patient_ID
                JOIN office AS o ON a.OFFICE_Office_ID = o.Office_ID
                WHERE a.DOCTOR_Doctor_ID = ?
                  AND a.Appointment_Date >= DATE_SUB(CURRENT_DATE(),
                      INTERVAL WEEKDAY(CURRENT_DATE()) DAY)
                  AND a.Appointment_Date < DATE_ADD(
                      DATE_SUB(CURRENT_DATE(), INTERVAL WEEKDAY(CURRENT_DATE()) DAY),
                      INTERVAL 7 DAY)
                ORDER BY a.Appointment_Date, a.Appointment_Time
            `, [doctorId])
        ]);

        return { workHours, weeklyAppointments: appointments };
    }

    // REFERRALS (DOCTOR MAY BE THE PRIMARY DOCTOR OR THE SPECIALIST)
    async function getReferrals(doctorId, status = "all") {
        const useFilter = status !== "all";
        const sql = `
            SELECT r.Referral_ID, r.Primary_Doctor_ID,
                   r.Specialist_Doctor_ID, r.Reason,
                   r.Referral_Date, r.Approval_Date, r.Status,
                   p.Patient_ID, p.First_Name AS Patient_First_Name,
                   p.Last_Name AS Patient_Last_Name,
                   d.First_Name AS Specialist_First_Name,
                   d.Last_Name AS Specialist_Last_Name,
                   CASE WHEN r.Primary_Doctor_ID = ?
                        THEN 'Primary Doctor' ELSE 'Specialist' END AS Doctor_Role
            FROM referral AS r
            JOIN patient AS p ON r.PATIENT_Patient_ID = p.Patient_ID
            LEFT JOIN doctor AS d ON r.Specialist_Doctor_ID = d.Doctor_ID
            WHERE (r.Primary_Doctor_ID = ? OR r.Specialist_Doctor_ID = ?)
            ${useFilter ? "AND LOWER(r.Status) = LOWER(?)" : ""}
            ORDER BY r.Referral_Date DESC, r.Referral_ID DESC
        `;
        const params = [doctorId, doctorId, doctorId];
        if (useFilter) params.push(status);
        const [rows] = await db.execute(sql, params);
        return rows;
    }

    // SETTINGS: READ-ONLY CONTACT DETAILS FOR THE LOGGED-IN DOCTOR
    async function getSettings(doctorId) {
        const [rows] = await db.execute(`
            SELECT Doctor_ID, First_Name, Last_Name, Email, Phone
            FROM doctor WHERE Doctor_ID = ?
        `, [doctorId]);
        return rows[0] || null;
    }

    return {
        getDashboard, getProfile, getPatients, getPatientRecords,
        getAppointments, getSchedule, getReferrals, getSettings
    };
}

export default createDoctorController();
