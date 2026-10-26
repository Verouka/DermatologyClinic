import pool from "./database.js";

export async function getDashboardSummary(req, res) {
    try {
        // Get Nurse Profile info for greeting
        const [nurseRows] = await pool.query("SELECT First_Name, Last_Name FROM nurse WHERE Nurse_ID = 501");
        const nurse = nurseRows[0] || {};

        // Get today's appointments count for nurse's office
        const [apptRows] = await pool.query(`
            SELECT COUNT(*) AS total 
            FROM appointment 
            WHERE OFFICE_Office_ID = (SELECT OFFICE_Office_ID FROM nurse WHERE Nurse_ID = 501)
        `);
        const appointmentCount = apptRows[0]?.total || 0;

        // Get active shift details
        const [schedRows] = await pool.query(`
            SELECT Start_Time, End_Time 
            FROM schedule 
            WHERE NURSE_Nurse_ID = 501 
            LIMIT 1
        `);
        const shift = schedRows[0] || { Start_Time: '08:00:00', End_Time: '04:00:00' };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            nurseName: `${nurse.First_Name || ''} ${nurse.Last_Name || ''}`.trim(),
            appointmentCount,
            shiftStart: shift.Start_Time,
            shiftEnd: shift.End_Time
        }));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}