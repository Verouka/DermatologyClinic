
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

export async function handleAdminBillingRoutes(req, res) {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    if (
        req.method !== "GET" ||
        pathname !== "/api/admin/billing"
    ) {
        return false;
    }

    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 403, {
            error: "Administrator access required"
        });

        return true;
    }

    try {
        // Get all bills and total payments received for each bill.
        const [bills] = await pool.execute(`
            SELECT
                b.Bill_ID AS billId,
                b.PATIENT_Patient_ID AS patientId,
                CONCAT_WS(
                    ' ',
                    p.First_Name,
                    p.Last_Name
                ) AS patientName,
                b.Bill_Date AS billDate,
                b.Amount_Due AS amountDue,
                COALESCE(pay.totalPaid, 0) AS amountPaid
            FROM bill b
            LEFT JOIN patient p
                ON p.Patient_ID = b.PATIENT_Patient_ID
            LEFT JOIN (
                SELECT
                    BILL_Bill_ID,
                    SUM(Payment_Amount) AS totalPaid
                FROM payment
                GROUP BY BILL_Bill_ID
            ) pay
                ON pay.BILL_Bill_ID = b.Bill_ID
            ORDER BY
                b.Bill_Date DESC,
                b.Bill_ID DESC
        `);

        // Calculate the status and remaining balance of each bill.
        const formattedBills = bills.map((bill) => {
            const amountDue = Number(bill.amountDue) || 0;
            const amountPaid = Number(bill.amountPaid) || 0;

            let status;

            if (amountPaid >= amountDue) {
                status = "Paid";
            } else if (amountPaid > 0) {
                status = "Partial";
            } else {
                status = "Unpaid";
            }

            return {
                ...bill,
                amountDue,
                amountPaid,
                remainingBalance: Math.max(
                    0,
                    amountDue - amountPaid
                ),
                status
            };
        });

        // Count bills that are not fully paid.
        const totalActiveBills = formattedBills.filter(
            (bill) => bill.status !== "Paid"
        ).length;

        // Get all individual payment records.
        const [payments] = await pool.execute(`
            SELECT
                pay.Payment_ID AS paymentId,
                b.Bill_ID AS billId,
                CONCAT_WS(
                    ' ',
                    p.First_Name,
                    p.Last_Name
                ) AS patientName,
                b.Bill_Date AS billDate,
                b.Amount_Due AS amountDue,
                pay.Payment_Amount AS paymentAmount,
                pay.Payment_Date AS paymentDate,
                pay.Payment_Type AS paymentType,
                pay.Card_Last_4_Digits AS cardLast4
            FROM payment pay
            INNER JOIN bill b
                ON b.Bill_ID = pay.BILL_Bill_ID
            LEFT JOIN patient p
                ON p.Patient_ID = b.PATIENT_Patient_ID
            ORDER BY
                pay.Payment_Date DESC,
                pay.Payment_ID DESC
        `);

        // Calculate total money received.
        const totalPaid = payments.reduce(
            (sum, payment) =>
                sum + (Number(payment.paymentAmount) || 0),
            0
        );

        // Calculate outstanding balances across all bills.
        const outstandingBalances = formattedBills.reduce(
            (sum, bill) =>
                sum + bill.remainingBalance,
            0
        );

        sendJSON(res, 200, {
            summary: {
                totalPaid,
                outstandingBalances,
                totalActiveBills
            },
            bills: formattedBills,
            payments
        });

    } catch (error) {
        console.error("Admin billing loading error:", error);

        sendJSON(res, 500, {
            error: "Could not load billing information"
        });
    }

    return true;
}
