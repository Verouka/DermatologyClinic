
const BILLING_API = "http://127.0.0.1:3000/api/patient/billing";

let selectedBillId = null;
let selectedRemainingBalance = 0;

document.addEventListener("DOMContentLoaded", () => {
    loadBilling();

    const paymentForm = document.getElementById("paymentForm");
    const cancelButton = document.getElementById("cancelPaymentBtn");

    if (paymentForm) {
        paymentForm.addEventListener("submit", submitPayment);
    }

    if (cancelButton) {
        cancelButton.addEventListener("click", closePaymentForm);
    }
});

function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-US", {
        style: "currency",
        currency: "USD"
    });
}

function formatBillingDate(value) {
    if (!value) return "Not provided";

    const datePart = String(value).slice(0, 10);
    const parts = datePart.split("-");

    if (parts.length !== 3) return datePart;

    return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = String(value);
    row.appendChild(cell);
    return cell;
}

function showTableMessage(tbody, message, columns = 5) {
    if (!tbody) return;

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = columns;
    cell.textContent = message;

    row.appendChild(cell);
    tbody.replaceChildren(row);
}

function showPaymentMessage(message, color = "red") {
    const element = document.getElementById("paymentMessage");

    if (element) {
        element.textContent = message;
        element.style.color = color;
    }
}

function closePaymentForm() {
    const container = document.getElementById("paymentFormContainer");
    const form = document.getElementById("paymentForm");

    if (container) {
        container.hidden = true;
    }

    if (form) {
        form.reset();
    }

    selectedBillId = null;
    selectedRemainingBalance = 0;

    showPaymentMessage("");
}

function openPaymentForm(billId, remainingBalance) {
    const container = document.getElementById("paymentFormContainer");
    const info = document.getElementById("selectedBillInfo");
    const amountInput = document.getElementById("paymentAmount");
    const successMessage = document.getElementById("billingSuccessMessage");

    if (!container || !info || !amountInput) {
        console.error("Payment form elements are missing.");
        return;
    }

    selectedBillId = Number(billId);
    selectedRemainingBalance = Number(remainingBalance);

    if (successMessage) {
        successMessage.textContent = "";
    }

    info.textContent =
        `Bill #${selectedBillId} — Remaining Balance: ${formatMoney(selectedRemainingBalance)}`;

    amountInput.value = selectedRemainingBalance.toFixed(2);
    amountInput.min = "0.01";
    amountInput.max = selectedRemainingBalance.toFixed(2);
    amountInput.step = "0.01";

    showPaymentMessage("");

    container.hidden = false;

    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

async function loadBilling() {
    const billsBody = document.getElementById("billsTableBody");
    const paymentsBody = document.getElementById("paymentsTableBody");

    try {
        const response = await fetch(BILLING_API, {
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("Could not load billing information");
        }

        const data = await response.json();

        document.getElementById("totalBills").textContent =
            formatMoney(data.summary.totalBills);

        document.getElementById("outstandingBalance").textContent =
            formatMoney(data.summary.outstandingBalance);

        document.getElementById("totalPaid").textContent =
            formatMoney(data.summary.totalPaid);

        // Display patient bills.
        billsBody.replaceChildren();

        if (data.bills.length === 0) {
            showTableMessage(billsBody, "No bills to display yet.");
        } else {
            for (const bill of data.bills) {
                const row = document.createElement("tr");

                const amount = Number(bill.Amount_Due || 0);
                const paid = Number(bill.Total_Paid || 0);
                const remaining = Math.max(0, amount - paid);

                let status = "Unpaid";

                if (remaining <= 0) {
                    status = "Paid";
                } else if (paid > 0) {
                    status = "Partially Paid";
                }

                addCell(row, bill.Bill_ID);
                addCell(row, formatBillingDate(bill.Bill_Date));
                addCell(row, formatMoney(amount));
                addCell(row, status);

                const actionCell = document.createElement("td");

                if (remaining > 0) {
                    const button = document.createElement("button");

                    button.type = "button";
                    button.className = "payNowBtn";
                    button.textContent = "Pay Now";

                    button.addEventListener("click", () => {
                        openPaymentForm(bill.Bill_ID, remaining);
                    });

                    actionCell.appendChild(button);
                } else {
                    actionCell.textContent = "Paid";
                }

                row.appendChild(actionCell);
                billsBody.appendChild(row);
            }
        }

        // Display payment history.
        paymentsBody.replaceChildren();

        if (data.payments.length === 0) {
            showTableMessage(
                paymentsBody,
                "No payment records to display yet.",
                4
            );
        } else {
            for (const payment of data.payments) {
                const row = document.createElement("tr");

                let method = payment.Payment_Type || "Not provided";

                if (payment.Card_Last_4_Digits) {
                    method += ` (****${payment.Card_Last_4_Digits})`;
                }

                addCell(row, payment.Payment_ID);
                addCell(row, formatBillingDate(payment.Payment_Date));
                addCell(row, formatMoney(payment.Payment_Amount));
                addCell(row, method);

                paymentsBody.appendChild(row);
            }
        }

    } catch (error) {
        console.error("Billing loading error:", error);

        showTableMessage(
            billsBody,
            "Unable to load bills."
        );

        showTableMessage(
            paymentsBody,
            "Unable to load payments.",
            4
        );
    }
}

async function submitPayment(event) {
    event.preventDefault();

    if (!selectedBillId) {
        showPaymentMessage("Please select a bill first.");
        return;
    }

    const amountInput = document.getElementById("paymentAmount");
    const methodInput = document.getElementById("paymentMethod");
    const submitButton = document.getElementById("submitPaymentBtn");

    const amount = Number(amountInput.value);
    const paymentMethod = methodInput.value;

    const amountInCents = Math.round(amount * 100);
    const remainingInCents =
        Math.round(selectedRemainingBalance * 100);

    if (
        !Number.isFinite(amount) ||
        amountInCents <= 0 ||
        amountInCents > remainingInCents
    ) {
        showPaymentMessage(
            "Enter a valid amount that does not exceed the remaining balance."
        );
        return;
    }

    if (!["Card", "Cash"].includes(paymentMethod)) {
        showPaymentMessage("Please select a valid payment method.");
        return;
    }

    submitButton.disabled = true;
    showPaymentMessage("");

    try {
        const response = await fetch(
            `${BILLING_API}/payments`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    billId: selectedBillId,
                    amount: amountInCents / 100,
                    paymentMethod: paymentMethod
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Payment could not be recorded."
            );
        }

        closePaymentForm();

        await loadBilling();

        const successMessage =
            document.getElementById("billingSuccessMessage");

        if (successMessage) {
            successMessage.textContent =
                "Test payment recorded successfully!";
            successMessage.style.color = "green";
        }

    } catch (error) {
        console.error("Payment error:", error);
        showPaymentMessage(error.message);
    } finally {
        submitButton.disabled = false;
    }
}

