

document.addEventListener("DOMContentLoaded", async () => {
    const upcomingBody = document.getElementById("upcomingAppointmentsBody");
    const pastBody = document.getElementById("pastAppointmentsBody");

    function displayMessage(tbody, message) {
        if (!tbody) return;

        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.textContent = message;
        row.appendChild(cell);
        tbody.replaceChildren(row);
    }

    function formatDate(value) {
        if (!value) return "—";

        const dateString = String(value).slice(0, 10);
        const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        return match
            ? `${match[2]}/${match[3]}/${match[1]}`
            : dateString;
    }

    function formatTime(value) {
        if (!value) return "—";

        const match = String(value).match(/^(\d{1,2}):(\d{2})/);

        if (!match) return String(value);

        const hours = Number(match[1]);

        return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
    }

    function populateTable(tbody, appointments) {
        if (!tbody) return;

        tbody.replaceChildren();

        if (!appointments.length) {
            displayMessage(tbody, "No appointments to display");
            return;
        }

        appointments.forEach(appointment => {
            const row = document.createElement("tr");

            [
                formatDate(appointment.appointmentDate),
                formatTime(appointment.appointmentTime),
                appointment.doctorName || "—",
                appointment.officeId ?? "—",
                appointment.status || "—"
            ].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = String(value);
                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });
    }

    if (!upcomingBody || !pastBody) {
        console.error(
            "Missing appointment table IDs in adminAppointments.html"
        );
        return;
    }

    try {
        const response = await fetch(
            "/api/admin/appointments",
            {
                credentials: "include",
                headers: {
                    Accept: "application/json"
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || `HTTP ${response.status}`
            );
        }

        populateTable(
            upcomingBody,
            result.upcomingAppointments || []
        );

        populateTable(
            pastBody,
            result.pastAppointments || []
        );

    } catch (error) {
        console.error("Admin appointments error:", error);

        displayMessage(upcomingBody, "Unable to load appointments");
        displayMessage(pastBody, "Unable to load appointments");
    }
});
