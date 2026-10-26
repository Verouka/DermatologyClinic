import pool from "./database.js";

export async function getAppointments(req, res) {
    try {
        const [rows] = await pool.query(`
            SELECT a.Appointment_ID, a.PATIENT_Patient_ID, 
                   CONCAT(p.First_Name, ' ', p.Last_Name) AS Patient_Name,
                   a.Appointment_Date, a.Appointment_Time, 
                   a.Appointment_Description, a.Booking_Method, a.Appointment_Status
            FROM appointment a
            JOIN patient p ON a.PATIENT_Patient_ID = p.Patient_ID
            WHERE a.OFFICE_Office_ID = (SELECT OFFICE_Office_ID FROM nurse WHERE Nurse_ID = 501)
            ORDER BY a.Appointment_Time ASC
        `);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(rows));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}