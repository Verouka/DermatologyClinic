

document.addEventListener("DOMContentLoaded", async () => {
    const API_URL = "/api/admin/billing";

    const totalPaidElement = document.getElementById("totalPaid");
    const outstandingElement = document.getElementById("outstandingBalances");
    const totalBillsElement = document.getElementById("totalBills");

    const billsBody = document.getElementById("billsTableBody");
    const paymentsBody = document.getElementById("paymentsTableBody");

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    });

    function setText(element, value) {
        if (element) {
            element.textContent = String(value);
        }
    }

    function formatCurrency(value) {
        if (value === null || value === undefined || value === "") {
            return "—";
        }

        const amount = Number(value);

        return Number.isFinite(amount)
            ? currencyFormatter.format(amount)
            : "—";
    }

    function formatDate(value) {
        if (!value) return "—";

        const dateString = String(value).slice(0, 10);
        const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        return match
            ? `${match[2]}/${match[3]}/${match[1]}`
            : dateString;
    }

    function displayMessage(tbody, message, columnCount = 5) {
        if (!tbody) return;

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = columnCount;
        cell.textContent = message;

        row.appendChild(cell);
        tbody.replaceChildren(row);
    }

    function addCell(row, value) {
        const cell = document.createElement("td");

        cell.textContent =
            value === null || value === undefined || value === ""
                ? "—"
                : String(value);

        row.appendChild(cell);
    }

    function populateBills(bills) {
        if (!billsBody) return;

        billsBody.replaceChildren();

        if (!Array.isArray(bills) || bills.length === 0) {
            displayMessage(billsBody, "No bills to display.");
            return;
        }

        bills.forEach((bill) => {
            const row = document.createElement("tr");

            addCell(row, bill.billId);
            addCell(row, bill.patientName);
            addCell(row, formatDate(bill.billDate));
            addCell(row, formatCurrency(bill.amountDue));
            addCell(row, bill.status);

            billsBody.appendChild(row);
        });
    }

    function populatePayments(payments) {
        if (!paymentsBody) return;

        paymentsBody.replaceChildren();

        if (!Array.isArray(payments) || payments.length === 0) {
            displayMessage(paymentsBody, "No payments to display.");
            return;
        }

        payments.forEach((payment) => {
            const row = document.createElement("tr");

            let paymentMethod = String(payment.paymentType || "—");

            if (
                paymentMethod.toLowerCase().includes("card") &&
                payment.cardLast4
            ) {
                paymentMethod += ` (**** ${payment.cardLast4})`;
            }

            addCell(row, payment.billId);
            addCell(row, payment.patientName);
            addCell(row, formatDate(payment.paymentDate));
            addCell(row, formatCurrency(payment.paymentAmount));
            addCell(row, paymentMethod);

            paymentsBody.appendChild(row);
        });
    }

    setText(totalPaidElement, "Loading...");
    setText(outstandingElement, "Loading...");
    setText(totalBillsElement, "Loading...");

    try {
        const response = await fetch(API_URL, {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            let errorMessage = `Failed to load billing data (HTTP ${response.status}).`;

            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                // Keep the HTTP error message.
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        const summary = result.summary || {};

        console.log("Administrator billing data:", result);

        setText(
            totalPaidElement,
            formatCurrency(summary.totalPaid)
        );

        setText(
            outstandingElement,
            formatCurrency(summary.outstandingBalances)
        );

        setText(
            totalBillsElement,
            summary.totalActiveBills ?? "—"
        );

        populateBills(result.bills || []);
        populatePayments(result.payments || []);

    } catch (error) {
        console.error("Error loading billing information:", error);

        setText(totalPaidElement, "Unavailable");
        setText(outstandingElement, "Unavailable");
        setText(totalBillsElement, "Unavailable");

        displayMessage(billsBody, "Unable to load bills.");
        displayMessage(paymentsBody, "Unable to load payments.");
    }
});
