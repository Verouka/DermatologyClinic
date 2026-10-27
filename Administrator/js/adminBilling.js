document.addEventListener("DOMContentLoaded", async () => {
    const totalPaidElement = document.getElementById("totalPaid");
    const outstandingElement = document.getElementById("outstandingBalances");
    const totalBillsElement = document.getElementById("totalBills");
    const billsBody = document.getElementById("billsTableBody");
    const paymentsBody = document.getElementById("paymentsTableBody");

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    });

    function formatCurrency(value) {
        return currencyFormatter.format(Number(value) || 0);
    }

    function formatDate(value) {
        if (!value) return "—";

        const dateString = String(value).slice(0, 10);
        const match = dateString.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );

        return match
            ? `${match[2]}/${match[3]}/${match[1]}`
            : dateString;
    }

    function displayMessage(tbody, message, columnCount) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = columnCount;
        cell.textContent = message;

        row.appendChild(cell);
        tbody.replaceChildren(row);
    }

    function addCell(row, value) {
        const cell = document.createElement("td");
        cell.textContent = value ?? "—";
        row.appendChild(cell);
    }

    function populateBills(bills) {
        billsBody.replaceChildren();

        if (bills.length === 0) {
            displayMessage(
                billsBody,
                "No bills to display.",
                5
            );
            return;
        }

        bills.forEach((bill) => {
            const row = document.createElement("tr");

            addCell(row, bill.billId);
            addCell(row, bill.patientName || "—");
            addCell(row, formatDate(bill.billDate));
            addCell(row, formatCurrency(bill.amountDue));
            addCell(row, bill.status);

            billsBody.appendChild(row);
        });
    }

    function populatePayments(payments) {
        paymentsBody.replaceChildren();

        if (payments.length === 0) {
            displayMessage(
                paymentsBody,
                "No payments to display.",
                5
            );
            return;
        }

        payments.forEach((payment) => {
            const row = document.createElement("tr");

            let paymentMethod = payment.paymentType || "—";

            if (
                paymentMethod.toLowerCase().includes("card") &&
                payment.cardLast4
            ) {
                paymentMethod += ` (**** ${payment.cardLast4})`;
            }

            addCell(row, payment.billId);
            addCell(row, payment.patientName || "—");
            addCell(row, formatDate(payment.paymentDate));
            addCell(row, formatCurrency(payment.paymentAmount));
            addCell(row, paymentMethod);

            paymentsBody.appendChild(row);
        });
    }

    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/admin/billing",
            {
                method: "GET",
                credentials: "include",
                headers: {
                    Accept: "application/json"
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                `Failed to load billing data (HTTP ${response.status}).`
            );
        }

        totalPaidElement.textContent = formatCurrency(
            result.summary.totalPaid
        );

        outstandingElement.textContent = formatCurrency(
            result.summary.outstandingBalances
        );

        totalBillsElement.textContent =
            result.summary.totalActiveBills;

        populateBills(result.bills || []);
        populatePayments(result.payments || []);

    } catch (error) {
        console.error("Error loading billing information:", error);

        totalPaidElement.textContent = "Unavailable";
        outstandingElement.textContent = "Unavailable";
        totalBillsElement.textContent = "Unavailable";

        displayMessage(
            billsBody,
            "Unable to load bills.",
            5
        );

        displayMessage(
            paymentsBody,
            "Unable to load payments.",
            5
        );
    }
});