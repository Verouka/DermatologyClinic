
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

export const handlePatientBillingRoutes = async (req, res) => {

    const path = new URL(req.url, "http://localhost").pathname;

    const isBillingList =
        req.method === "GET" &&
        path === "/api/patient/billing";

    const isPaymentRequest =
        req.method === "POST" &&
        path === "/api/patient/billing/payments";

    if (!isBillingList && !isPaymentRequest) {
        return false;
    }

    const sendJSON = (status, data) => {
        res.writeHead(status, {
            "Content-Type": "application/json"
        });
        res.end(JSON.stringify(data));
    };

    const session = getSession(req);

    if (
        !session ||
        session.role !== "patient" ||
        !session.patientId
    ) {
        sendJSON(401, {
            error: "Unauthorized"
        });
        return true;
    }

    // Retrieve bills and payment history.
    if (isBillingList) {
        try {
            const patientId = session.patientId;

            const [bills] = await pool.execute(
                `SELECT
                    b.Bill_ID,
                    b.Bill_Date,
                    b.Item_Name,
                    b.Item_Cost,
                    b.Amount_Due,
                    b.APPOINTMENT_Appointment_ID,
                    COALESCE(SUM(p.Payment_Amount), 0) AS Total_Paid
                 FROM bill AS b
                 LEFT JOIN payment AS p
                    ON p.BILL_Bill_ID = b.Bill_ID
                 WHERE b.PATIENT_Patient_ID = ?
                 GROUP BY
                    b.Bill_ID,
                    b.Bill_Date,
                    b.Item_Name,
                    b.Item_Cost,
                    b.Amount_Due,
                    b.APPOINTMENT_Appointment_ID
                 ORDER BY b.Bill_Date DESC, b.Bill_ID DESC`,
                [patientId]
            );

            const [payments] = await pool.execute(
                `SELECT
                    p.Payment_ID,
                    p.Payment_Date,
                    p.Payment_Amount,
                    p.Payment_Type,
                    p.Card_Last_4_Digits,
                    p.BILL_Bill_ID
                 FROM payment AS p
                 INNER JOIN bill AS b
                    ON p.BILL_Bill_ID = b.Bill_ID
                 WHERE b.PATIENT_Patient_ID = ?
                 ORDER BY p.Payment_Date DESC, p.Payment_ID DESC`,
                [patientId]
            );

            let totalBills = 0;
            let outstandingBalance = 0;
            let totalPaid = 0;

            for (const bill of bills) {
                const amountDue = Number(bill.Amount_Due || 0);
                const paid = Number(bill.Total_Paid || 0);

                totalBills += amountDue;
                totalPaid += paid;
                outstandingBalance += Math.max(0, amountDue - paid);
            }

            sendJSON(200, {
                summary: {
                    totalBills,
                    outstandingBalance,
                    totalPaid
                },
                bills,
                payments
            });

        } catch (error) {
            console.error("Patient billing error:", error);

            sendJSON(500, {
                error: "Could not load billing information"
            });
        }

        return true;
    }

    // Record a simulated payment.
    if (isPaymentRequest) {

        let body = "";

        try {
            for await (const chunk of req) {
                body += chunk;

                if (body.length > 10000) {
                    sendJSON(413, {
                        error: "Request too large"
                    });
                    return true;
                }
            }

            const data = JSON.parse(body);

            const billId = Number(data.billId);
            const amount = Number(data.amount);
            const paymentMethod = data.paymentMethod;

            if (
                !Number.isSafeInteger(billId) ||
                billId <= 0 ||
                !Number.isFinite(amount) ||
                amount <= 0 ||
                !Number.isSafeInteger(Math.round(amount * 100)) ||
                Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 ||
                !["Card", "Cash"].includes(paymentMethod)
            ) {
                sendJSON(400, {
                    error: "Invalid payment information"
                });
                return true;
            }

            const connection = await pool.getConnection();

            try {
                await connection.beginTransaction();

                // Lock the bill to prevent simultaneous overpayments.
                const [billRows] = await connection.execute(
                    `SELECT Bill_ID, Amount_Due
                     FROM bill
                     WHERE Bill_ID = ?
                       AND PATIENT_Patient_ID = ?
                     FOR UPDATE`,
                    [billId, session.patientId]
                );

                if (billRows.length === 0) {
                    await connection.rollback();

                    sendJSON(404, {
                        error: "Bill not found"
                    });
                    return true;
                }

                const [paymentRows] = await connection.execute(
                    `SELECT COALESCE(SUM(Payment_Amount), 0) AS Total_Paid
                     FROM payment
                     WHERE BILL_Bill_ID = ?`,
                    [billId]
                );

                const amountDue = Number(billRows[0].Amount_Due || 0);
                const alreadyPaid = Number(paymentRows[0].Total_Paid || 0);

                const remainingCents =
                    Math.round(amountDue * 100) -
                    Math.round(alreadyPaid * 100);

                const paymentCents = Math.round(amount * 100);

                if (remainingCents <= 0) {
                    await connection.rollback();

                    sendJSON(409, {
                        error: "This bill is already paid"
                    });
                    return true;
                }

                if (paymentCents > remainingCents) {
                    await connection.rollback();

                    sendJSON(400, {
                        error: "Payment exceeds the remaining balance"
                    });
                    return true;
                }

                const [result] = await connection.execute(
                    `INSERT INTO payment (
                        Payment_Date,
                        Payment_Amount,
                        Payment_Type,
                        Card_Last_4_Digits,
                        BILL_Bill_ID
                     )
                     VALUES (CURDATE(), ?, ?, NULL, ?)`,
                    [
                        paymentCents / 100,
                        paymentMethod,
                        billId
                    ]
                );

                await connection.commit();

                sendJSON(201, {
                    message: "Test payment recorded successfully",
                    paymentId: result.insertId
                });

            } catch (error) {
                await connection.rollback();

                console.error("Payment creation error:", error);

                sendJSON(500, {
                    error: "Could not record payment"
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            if (error instanceof SyntaxError) {
                sendJSON(400, {
                    error: "Invalid JSON"
                });
            } else {
                console.error("Payment request error:", error);

                sendJSON(500, {
                    error: "Could not process payment request"
                });
            }
        }

        return true;
    }

    return false;
};

