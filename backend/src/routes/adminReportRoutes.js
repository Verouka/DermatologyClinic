import pool from "../database.js";
import { getSession } from "../services/sessionService.js";


// ----------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}


function isValidDate(date) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00`);

    return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date;
}


function getOptionalId(value) {
    if (value === null || value === undefined || value.trim() === "") {
        return null;
    }

    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return false;
    }

    return id;
}


function getFullName(first, middle, last) {
    return [first, middle, last]
        .filter(name => name && name.trim() !== "")
        .join(" ");
}


// ----------------------------------------
// ADMIN REPORT ROUTES
// ----------------------------------------

export async function handleAdminReportRoutes(req, res) {
    const url = new URL(req.url, "http://localhost");

    if (
        req.method !== "GET" ||
        !url.pathname.startsWith("/api/admin/reports")
    ) {
        return false;
    }

    // ----------------------------------------
    // AUTHENTICATION
    // ----------------------------------------

    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 401, {
            success: false,
            message: "Unauthorized. Administrator access required."
        });

        return true;
    }

    if (!session.administratorId) {
        sendJSON(res, 401, {
            success: false,
            message: "Administrator session is invalid."
        });

        return true;
    }

    try {

        // ----------------------------------------
        // LOAD OFFICE OPTIONS
        // GET /api/admin/reports/options
        // ----------------------------------------

        if (url.pathname === "/api/admin/reports/options") {
            const [offices] = await pool.execute(`
                SELECT
                    Office_ID,
                    City,
                    State
                FROM office
                ORDER BY Office_ID ASC
            `);

            sendJSON(res, 200, {
                success: true,
                offices
            });

            return true;
        }


        // ----------------------------------------
        // GENERATE REPORT
        // GET /api/admin/reports
        // ----------------------------------------

        if (url.pathname !== "/api/admin/reports") {
            sendJSON(res, 404, {
                success: false,
                message: "Report endpoint not found."
            });

            return true;
        }


        // ----------------------------------------
        // READ FILTERS
        // ----------------------------------------

        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");

        const officeId = getOptionalId(
            url.searchParams.get("officeId")
        );

        const patientId = getOptionalId(
            url.searchParams.get("patientId")
        );

        const doctorId = getOptionalId(
            url.searchParams.get("doctorId")
        );

        const nurseId = getOptionalId(
            url.searchParams.get("nurseId")
        );


        // ----------------------------------------
        // VALIDATE FILTERS
        // ----------------------------------------

        if (startDate && !isValidDate(startDate)) {
            sendJSON(res, 400, {
                success: false,
                message: "Invalid start date."
            });

            return true;
        }

        if (endDate && !isValidDate(endDate)) {
            sendJSON(res, 400, {
                success: false,
                message: "Invalid end date."
            });

            return true;
        }

        if (startDate && endDate && startDate > endDate) {
            sendJSON(res, 400, {
                success: false,
                message: "The start date cannot be after the end date."
            });

            return true;
        }

        if (
            officeId === false ||
            patientId === false ||
            doctorId === false ||
            nurseId === false
        ) {
            sendJSON(res, 400, {
                success: false,
                message: "One or more ID filters are invalid."
            });

            return true;
        }


        // ----------------------------------------
        // BUILD SHARED FILTER CONDITIONS
        // ----------------------------------------

        const conditions = [];
        const params = [];

        if (startDate) {
            conditions.push("a.Appointment_Date >= ?");
            params.push(startDate);
        }

        if (endDate) {
            conditions.push("a.Appointment_Date <= ?");
            params.push(endDate);
        }

        if (officeId !== null) {
            conditions.push("a.OFFICE_Office_ID = ?");
            params.push(officeId);
        }

        if (patientId !== null) {
            conditions.push("a.PATIENT_Patient_ID = ?");
            params.push(patientId);
        }

        if (doctorId !== null) {
            conditions.push("a.DOCTOR_Doctor_ID = ?");
            params.push(doctorId);
        }

        if (nurseId !== null) {
            conditions.push("d.NURSE_Nurse_ID = ?");
            params.push(nurseId);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(" AND ")}`
            : "";


        // ----------------------------------------
        // APPOINTMENTS
        // ----------------------------------------

        const [appointments] = await pool.execute(`
            SELECT
                a.Appointment_ID,
                a.Appointment_Date,
                a.Appointment_Time,
                a.Appointment_Status,
                a.Appointment_Description,
                a.Booking_Method,

                p.Patient_ID AS PATIENT_Patient_ID,
                p.First_Name AS Patient_First_Name,
                p.Middle_Name AS Patient_Middle_Name,
                p.Last_Name AS Patient_Last_Name,

                d.Doctor_ID AS DOCTOR_Doctor_ID,
                d.First_Name AS Doctor_First_Name,
                d.Middle_Name AS Doctor_Middle_Name,
                d.Last_Name AS Doctor_Last_Name,

                n.Nurse_ID,
                n.First_Name AS Nurse_First_Name,
                n.Middle_Name AS Nurse_Middle_Name,
                n.Last_Name AS Nurse_Last_Name,

                o.Office_ID,
                o.City AS Office_City,
                o.State AS Office_State

            FROM appointment a

            LEFT JOIN patient p
                ON a.PATIENT_Patient_ID = p.Patient_ID

            LEFT JOIN doctor d
                ON a.DOCTOR_Doctor_ID = d.Doctor_ID

            LEFT JOIN nurse n
                ON d.NURSE_Nurse_ID = n.Nurse_ID

            LEFT JOIN office o
                ON a.OFFICE_Office_ID = o.Office_ID

            ${whereClause}

            ORDER BY
                a.Appointment_Date DESC,
                a.Appointment_Time DESC
        `, params);


        // Add display names for the frontend.
        const formattedAppointments = appointments.map(appointment => ({
            ...appointment,

            Patient_Name: getFullName(
                appointment.Patient_First_Name,
                appointment.Patient_Middle_Name,
                appointment.Patient_Last_Name
            ),

            Doctor_Name: getFullName(
                appointment.Doctor_First_Name,
                appointment.Doctor_Middle_Name,
                appointment.Doctor_Last_Name
            ),

            Nurse_Name: getFullName(
                appointment.Nurse_First_Name,
                appointment.Nurse_Middle_Name,
                appointment.Nurse_Last_Name
            )
        }));


        // ----------------------------------------
        // APPOINTMENT SUMMARY
        // ----------------------------------------

        const [summaryRows] = await pool.execute(`
            SELECT
                COUNT(*) AS totalAppointments,

                SUM(
                    CASE
                        WHEN LOWER(a.Appointment_Status) = 'completed'
                        THEN 1
                        ELSE 0
                    END
                ) AS completedAppointments,

                SUM(
                    CASE
                        WHEN LOWER(a.Appointment_Status) = 'cancelled'
                        THEN 1
                        ELSE 0
                    END
                ) AS cancelledAppointments

            FROM appointment a

            LEFT JOIN doctor d
                ON a.DOCTOR_Doctor_ID = d.Doctor_ID

            ${whereClause}
        `, params);

        const appointmentSummary = summaryRows[0] || {};


        // ----------------------------------------
        // BILLS
        // ----------------------------------------

        const [bills] = await pool.execute(`
            SELECT
                b.Bill_ID,
                b.Bill_Date,
                b.Amount_Due,
                b.Item_Name,
                b.Item_Cost,

                p.Patient_ID AS PATIENT_Patient_ID,
                p.First_Name AS Patient_First_Name,
                p.Middle_Name AS Patient_Middle_Name,
                p.Last_Name AS Patient_Last_Name,

                a.Appointment_ID AS APPOINTMENT_Appointment_ID

            FROM bill b

            INNER JOIN appointment a
                ON b.APPOINTMENT_Appointment_ID = a.Appointment_ID

            LEFT JOIN patient p
                ON b.PATIENT_Patient_ID = p.Patient_ID

            LEFT JOIN doctor d
                ON a.DOCTOR_Doctor_ID = d.Doctor_ID

            ${whereClause}

            ORDER BY b.Bill_Date DESC, b.Bill_ID DESC
        `, params);

        const formattedBills = bills.map(bill => ({
            ...bill,

            Patient_Name: getFullName(
                bill.Patient_First_Name,
                bill.Patient_Middle_Name,
                bill.Patient_Last_Name
            )
        }));


        // ----------------------------------------
        // PAYMENTS
        // ----------------------------------------

        const [payments] = await pool.execute(`
            SELECT
                pay.Payment_ID,
                pay.Payment_Date,
                pay.Payment_Amount,
                pay.Payment_Type,
                pay.Card_Last_4_Digits,

                b.Bill_ID AS BILL_Bill_ID,

                a.Appointment_ID AS APPOINTMENT_Appointment_ID,

                p.Patient_ID AS PATIENT_Patient_ID,
                p.First_Name AS Patient_First_Name,
                p.Middle_Name AS Patient_Middle_Name,
                p.Last_Name AS Patient_Last_Name

            FROM payment pay

            INNER JOIN bill b
                ON pay.BILL_Bill_ID = b.Bill_ID

            INNER JOIN appointment a
                ON b.APPOINTMENT_Appointment_ID = a.Appointment_ID

            LEFT JOIN patient p
                ON a.PATIENT_Patient_ID = p.Patient_ID

            LEFT JOIN doctor d
                ON a.DOCTOR_Doctor_ID = d.Doctor_ID

            ${whereClause}

            ORDER BY pay.Payment_Date DESC, pay.Payment_ID DESC
        `, params);

        const formattedPayments = payments.map(payment => ({
            ...payment,

            Patient_Name: getFullName(
                payment.Patient_First_Name,
                payment.Patient_Middle_Name,
                payment.Patient_Last_Name
            )
        }));


        // ----------------------------------------
        // CALCULATE REVENUE
        // ----------------------------------------

        const totalRevenue = formattedPayments.reduce(
            (total, payment) => {
                return total + Number(payment.Payment_Amount || 0);
            },
            0
        );


        // ----------------------------------------
        // SEND REPORT
        // ----------------------------------------

        sendJSON(res, 200, {
            success: true,

            filters: {
                startDate: startDate || null,
                endDate: endDate || null,
                officeId,
                patientId,
                doctorId,
                nurseId
            },

            summary: {
                totalAppointments: Number(
                    appointmentSummary.totalAppointments || 0
                ),

                completedAppointments: Number(
                    appointmentSummary.completedAppointments || 0
                ),

                cancelledAppointments: Number(
                    appointmentSummary.cancelledAppointments || 0
                ),

                totalRevenue
            },

            appointments: formattedAppointments,
            bills: formattedBills,
            payments: formattedPayments
        });

        return true;

    } catch (error) {
        console.error("Admin report error:", error);

        sendJSON(res, 500, {
            success: false,
            message: "An error occurred while generating the report.",
            error: error.message
        });

        return true;
    }
}