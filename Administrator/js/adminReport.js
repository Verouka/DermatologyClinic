
const API_BASE = "http://127.0.0.1:3000/api/admin/reports";

let reportData = null;

// ----------------------------------------
// INITIALIZATION
// ----------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    loadOffices();

    document.getElementById("reportForm")
        ?.addEventListener("submit", generateReport);

    document.getElementById("showAppointments")
        ?.addEventListener("change", toggleSections);

    document.getElementById("showBills")
        ?.addEventListener("change", toggleSections);

    document.getElementById("showPayments")
        ?.addEventListener("change", toggleSections);

    document.getElementById("downloadReportBtn")
        ?.addEventListener("click", downloadReport);

    toggleSections();
});


// ----------------------------------------
// LOAD OFFICE OPTIONS
// ----------------------------------------

async function loadOffices() {
    const officeSelect = document.getElementById("officeId");

    if (!officeSelect) return;

    try {
        const response = await fetch(`${API_BASE}/options`, {
            method: "GET",
            credentials: "include"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to load offices.");
        }

        officeSelect.innerHTML = '<option value="">All Offices</option>';

        result.offices.forEach(office => {
            const option = document.createElement("option");

            option.value = office.Office_ID;
            option.textContent =
                `Office ${office.Office_ID} - ${office.City}, ${office.State}`;

            officeSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading offices:", error);
        showMessage("Unable to load office options.");
    }
}


// ----------------------------------------
// GENERATE REPORT
// ----------------------------------------

async function generateReport(event) {
    event.preventDefault();

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    const officeId = document.getElementById("officeId").value;
    const patientId = document.getElementById("patientId").value.trim();
    const doctorId = document.getElementById("doctorId").value.trim();
    const nurseId = document.getElementById("nurseId").value.trim();

    if (startDate && endDate && startDate > endDate) {
        showMessage("The start date cannot be after the end date.");
        return;
    }

    const params = new URLSearchParams();

    // Dates are optional.
    // If both are blank, all dates are included.
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    if (officeId) params.set("officeId", officeId);
    if (patientId) params.set("patientId", patientId);
    if (doctorId) params.set("doctorId", doctorId);
    if (nurseId) params.set("nurseId", nurseId);

    const message = document.getElementById("reportMessage");

    reportData = null;
    clearReport();

    if (message) {
        message.textContent = "Generating report...";
        message.style.color = "";
    }

    try {
        const response = await fetch(`${API_BASE}?${params.toString()}`, {
            method: "GET",
            credentials: "include"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to generate report.");
        }

        reportData = result;

        displaySummary(result.summary);
        displayAppointments(result.appointments || []);
        displayBills(result.bills || []);
        displayPayments(result.payments || []);

        toggleSections();

        showMessage("Report generated successfully.", true);

    } catch (error) {
        console.error("Error generating report:", error);
        reportData = null;
        clearReport();
        showMessage(error.message || "An error occurred while generating the report.");
    }
}


// ----------------------------------------
// DISPLAY SUMMARY
// ----------------------------------------

function displaySummary(summary = {}) {
    document.getElementById("totalAppointments").textContent =
        summary.totalAppointments ?? 0;

    document.getElementById("completedAppointments").textContent =
        summary.completedAppointments ?? 0;

    document.getElementById("cancelledAppointments").textContent =
        summary.cancelledAppointments ?? 0;

    document.getElementById("totalRevenue").textContent =
        formatCurrency(summary.totalRevenue ?? 0);
}


// ----------------------------------------
// DISPLAY APPOINTMENTS
// ----------------------------------------

function displayAppointments(appointments) {
    const table = document.getElementById("appointmentsTable");

    if (!table) return;

    table.innerHTML = "";

    if (appointments.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="12" class="empty-message">
                    No appointments found.
                </td>
            </tr>
        `;
        return;
    }

    appointments.forEach(appointment => {
        const row = document.createElement("tr");

        const values = [
            appointment.Appointment_ID,
            formatDate(appointment.Appointment_Date),
            formatTime(appointment.Appointment_Time),
            appointment.Appointment_Status,
            appointment.Patient_Name,
            appointment.PATIENT_Patient_ID,
            appointment.Doctor_Name,
            appointment.DOCTOR_Doctor_ID,
            appointment.Nurse_Name,
            appointment.Office_ID,
            appointment.Appointment_Description,
            appointment.Booking_Method
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value ?? "N/A";
            row.appendChild(cell);
        });

        table.appendChild(row);
    });
}


// ----------------------------------------
// DISPLAY BILLS
// ----------------------------------------

function displayBills(bills) {
    const table = document.getElementById("billsTable");

    if (!table) return;

    table.innerHTML = "";

    if (bills.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="8" class="empty-message">
                    No bills found.
                </td>
            </tr>
        `;
        return;
    }

    bills.forEach(bill => {
        const row = document.createElement("tr");

        const values = [
            bill.Bill_ID,
            formatDate(bill.Bill_Date),
            bill.Patient_Name,
            bill.PATIENT_Patient_ID,
            bill.APPOINTMENT_Appointment_ID,
            bill.Item_Name,
            formatCurrency(bill.Item_Cost),
            formatCurrency(bill.Amount_Due)
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value ?? "N/A";
            row.appendChild(cell);
        });

        table.appendChild(row);
    });
}


// ----------------------------------------
// DISPLAY PAYMENTS
// ----------------------------------------

function displayPayments(payments) {
    const table = document.getElementById("paymentsTable");

    if (!table) return;

    table.innerHTML = "";

    if (payments.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="8" class="empty-message">
                    No payments found.
                </td>
            </tr>
        `;
        return;
    }

    payments.forEach(payment => {
        const row = document.createElement("tr");

        const values = [
            payment.Payment_ID,
            formatDate(payment.Payment_Date),
            payment.BILL_Bill_ID,
            payment.APPOINTMENT_Appointment_ID,
            payment.Patient_Name,
            formatCurrency(payment.Payment_Amount),
            payment.Payment_Type,
            payment.Card_Last_4_Digits
                ? `**** ${payment.Card_Last_4_Digits}`
                : "N/A"
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value ?? "N/A";
            row.appendChild(cell);
        });

        table.appendChild(row);
    });
}


// ----------------------------------------
// SHOW / HIDE REPORT SECTIONS
// ----------------------------------------

function toggleSections() {
    const appointmentsCheckbox =
        document.getElementById("showAppointments");

    const billsCheckbox =
        document.getElementById("showBills");

    const paymentsCheckbox =
        document.getElementById("showPayments");

    const appointmentsSection =
        document.getElementById("appointmentsSection");

    const billsSection =
        document.getElementById("billsSection");

    const paymentsSection =
        document.getElementById("paymentsSection");

    if (appointmentsSection && appointmentsCheckbox) {
        appointmentsSection.style.display =
            appointmentsCheckbox.checked ? "" : "none";
    }

    if (billsSection && billsCheckbox) {
        billsSection.style.display =
            billsCheckbox.checked ? "" : "none";
    }

    if (paymentsSection && paymentsCheckbox) {
        paymentsSection.style.display =
            paymentsCheckbox.checked ? "" : "none";
    }
}


// ----------------------------------------
// DOWNLOAD SELECTED SECTIONS AS CSV
// ----------------------------------------

function downloadReport() {
    if (!reportData) {
        showMessage("Generate a report before downloading it.");
        return;
    }

    const includeAppointments =
        document.getElementById("showAppointments").checked;

    const includeBills =
        document.getElementById("showBills").checked;

    const includePayments =
        document.getElementById("showPayments").checked;

    if (!includeAppointments && !includeBills && !includePayments) {
        showMessage("Select at least one report section to download.");
        return;
    }

    const rows = [];

    const summary = reportData.summary || {};
    const filters = reportData.filters || {};

    rows.push(["Dermatology Clinic Report"]);
    rows.push([]);

    rows.push(["Start Date", filters.startDate || "All Dates"]);
    rows.push(["End Date", filters.endDate || "All Dates"]);
    rows.push(["Office ID", filters.officeId || "All Offices"]);
    rows.push(["Patient ID", filters.patientId || "All Patients"]);
    rows.push(["Doctor ID", filters.doctorId || "All Doctors"]);
    rows.push(["Nurse ID", filters.nurseId || "All Nurses"]);

    rows.push([]);

    rows.push(["SUMMARY"]);
    rows.push(["Total Appointments", summary.totalAppointments ?? 0]);
    rows.push(["Completed Appointments", summary.completedAppointments ?? 0]);
    rows.push(["Cancelled Appointments", summary.cancelledAppointments ?? 0]);
    rows.push(["Total Revenue", summary.totalRevenue ?? 0]);

    rows.push([]);

    if (includeAppointments) {
        rows.push(["APPOINTMENTS"]);

        rows.push([
            "Appointment ID",
            "Date",
            "Time",
            "Status",
            "Patient",
            "Patient ID",
            "Doctor",
            "Doctor ID",
            "Nurse",
            "Office",
            "Description",
            "Booking Method"
        ]);

        (reportData.appointments || []).forEach(appointment => {
            rows.push([
                appointment.Appointment_ID,
                formatDate(appointment.Appointment_Date),
                formatTime(appointment.Appointment_Time),
                appointment.Appointment_Status,
                appointment.Patient_Name,
                appointment.PATIENT_Patient_ID,
                appointment.Doctor_Name,
                appointment.DOCTOR_Doctor_ID,
                appointment.Nurse_Name,
                appointment.Office_ID,
                appointment.Appointment_Description,
                appointment.Booking_Method
            ]);
        });

        rows.push([]);
    }

    if (includeBills) {
        rows.push(["BILLS"]);

        rows.push([
            "Bill ID",
            "Bill Date",
            "Patient",
            "Patient ID",
            "Appointment ID",
            "Item",
            "Item Cost",
            "Amount Due"
        ]);

        (reportData.bills || []).forEach(bill => {
            rows.push([
                bill.Bill_ID,
                formatDate(bill.Bill_Date),
                bill.Patient_Name,
                bill.PATIENT_Patient_ID,
                bill.APPOINTMENT_Appointment_ID,
                bill.Item_Name,
                bill.Item_Cost,
                bill.Amount_Due
            ]);
        });

        rows.push([]);
    }

    if (includePayments) {
        rows.push(["PAYMENTS"]);

        rows.push([
            "Payment ID",
            "Payment Date",
            "Bill ID",
            "Appointment ID",
            "Patient",
            "Payment Amount",
            "Payment Type",
            "Card Last 4 Digits"
        ]);

        (reportData.payments || []).forEach(payment => {
            rows.push([
                payment.Payment_ID,
                formatDate(payment.Payment_Date),
                payment.BILL_Bill_ID,
                payment.APPOINTMENT_Appointment_ID,
                payment.Patient_Name,
                payment.Payment_Amount,
                payment.Payment_Type,
                payment.Card_Last_4_Digits
            ]);
        });
    }

    const csvContent = rows
        .map(row => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `clinic-report-${getCurrentDate()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showMessage("Report downloaded successfully.", true);
}


// ----------------------------------------
// CLEAR REPORT
// ----------------------------------------

function clearReport() {
    document.getElementById("totalAppointments").textContent = "0";
    document.getElementById("completedAppointments").textContent = "0";
    document.getElementById("cancelledAppointments").textContent = "0";
    document.getElementById("totalRevenue").textContent = formatCurrency(0);

    document.getElementById("appointmentsTable").innerHTML = "";
    document.getElementById("billsTable").innerHTML = "";
    document.getElementById("paymentsTable").innerHTML = "";
}


// ----------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------

function formatDate(date) {
    if (!date) return "N/A";

    const value = String(date).split("T")[0];
    const parts = value.split("-");

    if (parts.length !== 3) return value;

    return `${parts[1]}/${parts[2]}/${parts[0]}`;
}


function formatTime(time) {
    if (!time) return "N/A";

    const parts = String(time).split(":");

    if (parts.length < 2) return time;

    let hours = Number(parts[0]);
    const minutes = parts[1];

    const period = hours >= 12 ? "PM" : "AM";

    hours = hours % 12 || 12;

    return `${hours}:${minutes} ${period}`;
}


function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(amount) || 0);
}


function escapeCSV(value) {
    if (value === null || value === undefined) {
        return '""';
    }

    let text = String(value);

    // Prevent spreadsheet formula injection.
    if (/^[\s]*[=+\-@]/.test(text)) {
        text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
}


function getCurrentDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function showMessage(message, success = false) {
    const messageElement = document.getElementById("reportMessage");

    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.style.color = success ? "green" : "red";
}