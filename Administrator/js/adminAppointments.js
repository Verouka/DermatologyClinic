
document.addEventListener("DOMContentLoaded", async () => {
    const upcomingBody = document.getElementById(
        "upcomingAppointmentsBody"
    );

    const pastBody = document.getElementById(
        "pastAppointmentsBody"
    );

    function displayMessage(tbody, message) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = message;

        row.appendChild(cell);
        tbody.replaceChildren(row);
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

    function formatTime(value) {
        if (!value) return "—";

        const match = String(value).match(
            /^(\d{1,2}):(\d{2})/
        );

        if (!match) return String(value);

        let hours = Number(match[1]);
        const minutes = match[2];
        const period = hours >= 12 ? "PM" : "AM";

        hours = hours % 12 || 12;

        return `${hours}:${minutes} ${period}`;
    }

    // CREATE DELETE BUTTON
    function createDeleteButton(appointment) {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = "Delete";
        button.className = "deleteAppointmentBtn";

        button.addEventListener("click", () => {
            deleteAppointment(appointment);
        });

        return button;
    }

    // DELETE APPOINTMENT
    async function deleteAppointment(appointment) {
        const appointmentId = appointment.id;

        if (!appointmentId) {
            alert("Could not identify this appointment.");
            return;
        }

        const confirmed = confirm(
            "Are you sure you want to delete this appointment? This action cannot be undone."
        );

        if (!confirmed) return;

        try {
            const response = await fetch(
                "http://127.0.0.1:3000/api/admin/appointments",
                {
                    method: "DELETE",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify({
                        id: appointmentId
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Could not delete appointment."
                );
            }

            alert(
                result.message || "Appointment deleted successfully."
            );

            await loadAppointments();

        } catch (error) {
            console.error("Error deleting appointment:", error);
            alert(error.message || "Could not delete appointment.");
        }
    }

    // POPULATE APPOINTMENT TABLE
    function populateTable(tbody, appointments) {
        tbody.replaceChildren();

        if (appointments.length === 0) {
            displayMessage(tbody, "No appointments to display");
            return;
        }

        appointments.forEach((appointment) => {
            const row = document.createElement("tr");

            const values = [
                formatDate(appointment.appointmentDate),
                formatTime(appointment.appointmentTime),
                appointment.doctorName || "—",
                appointment.officeId ?? "—",
                appointment.status || "—"
            ];

            values.forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = String(value);
                row.appendChild(cell);
            });

            // ACTIONS COLUMN
            const actionsCell = document.createElement("td");

            actionsCell.appendChild(
                createDeleteButton(appointment)
            );

            row.appendChild(actionsCell);

            tbody.appendChild(row);
        });
    }

    // LOAD APPOINTMENTS
    async function loadAppointments() {
        try {
            const response = await fetch(
                "http://127.0.0.1:3000/api/admin/appointments",
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
                    `Failed to load appointments (HTTP ${response.status}).`
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
            console.error("Error loading appointments:", error);

            displayMessage(
                upcomingBody,
                "Unable to load appointments"
            );

            displayMessage(
                pastBody,
                "Unable to load appointments"
            );
        }
    }

    // INITIAL LOAD
    await loadAppointments();
});
