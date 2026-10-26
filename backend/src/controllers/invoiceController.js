
import pool from "../database.js";

export async function getInvoices(req, res, sendJSON) {
    const [rows] = await pool.query(`
        SELECT
            b.Bill_ID AS id,
            b.PATIENT_Patient_ID AS patientId,
            DATE_FORMAT(b.Bill_Date, '%Y-%m-%d') AS date,
            b.Amount_Due AS amount,
            CASE
                WHEN COALESCE(SUM(p.Payment_Amount), 0)
                     >= COALESCE(b.Amount_Due, 0)
                THEN 'Paid'
                ELSE 'Unpaid'
            END AS status
        FROM bill b
        LEFT JOIN payment p
            ON p.BILL_Bill_ID = b.Bill_ID
        GROUP BY
            b.Bill_ID,
            b.PATIENT_Patient_ID,
            b.Bill_Date,
            b.Amount_Due
        ORDER BY b.Bill_Date DESC, b.Bill_ID DESC
    `);

    return sendJSON(res, 200, rows);
}

export async function updateInvoice(req, res, sendJSON, readBody, id) {
    const body = await readBody(req);

    if (!["Paid", "Unpaid"].includes(body.status)) {
        return sendJSON(res, 400, {
            error: "Status must be Paid or Unpaid."
        });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [bills] = await connection.execute(`
            SELECT Amount_Due AS amount
            FROM bill
            WHERE Bill_ID = ?
            FOR UPDATE
        `, [id]);

        if (bills.length === 0) {
            await connection.rollback();

            return sendJSON(res, 404, {
                error: "Invoice not found."
            });
        }

        const [payments] = await connection.execute(`
            SELECT COALESCE(SUM(Payment_Amount), 0) AS paid
            FROM payment
            WHERE BILL_Bill_ID = ?
        `, [id]);

        const amountDue = Number(bills[0].amount || 0);
        const amountPaid = Number(payments[0].paid || 0);

        if (body.status === "Unpaid" && amountPaid > 0) {
            await connection.rollback();

            return sendJSON(res, 409, {
                error: "This invoice already has payments. A payment reversal or refund is needed before marking it unpaid."
            });
        }

        if (body.status === "Paid" && amountPaid < amountDue) {
            await connection.execute(`
                INSERT INTO payment (
                    Payment_Date,
                    Payment_Amount,
                    Payment_Type,
                    BILL_Bill_ID
                )
                VALUES (CURDATE(), ?, 'Receptionist status update', ?)
            `, [amountDue - amountPaid, id]);
        }

        await connection.commit();

        return sendJSON(res, 200, {
            id: Number(id),
            status: body.status
        });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
