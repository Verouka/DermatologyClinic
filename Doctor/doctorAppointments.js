 

const API_BASE = "";

async function loadDoctorAppointments() {
    const upcomingBody = document.getElementById(
        "upcomingAppointmentRows"
    );

    const pastBody = document.getElementById(
        "pastAppointmentRows"
    );

    if (!upcomingBody || !pastBody) {
        console.error("Appointment tables not found.");
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/api/doctor/appointments?scope=all`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Could not load appointments (HTTP ${response.status})`
            );
        }

        const appointments = await response.json();

        if (!Array.isArray(appointments)) {
            throw new Error("Invalid appointment data");
        }

        upcomingBody.replaceChildren();
        pastBody.replaceChildren();

        const now = new Date();

        function isCancelled(appointment) {
            const status = String(
                appointment.Appointment_Status || ""
            ).toLowerCase();

            return (
                status === "cancelled" ||
                status === "canceled"
            );
        }

        function isCompleted(appointment) {
            return String(
                appointment.Appointment_Status || ""
            ).toLowerCase() === "completed";
        }

        function getAppointmentDateTime(appointment) {
            const date = String(
                appointment.Appointment_Date || ""
            ).slice(0, 10);

            const time = String(
                appointment.Appointment_Time || "00:00:00"
            ).slice(0, 8);

            return new Date(`${date}T${time}`);
        }

        const selectedDate = new URLSearchParams(
            window.location.search
        ).get("date");

        const filteredAppointments =
            selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
                ? appointments.filter(appointment =>
                    String(appointment.Appointment_Date || "")
                        .slice(0, 10) === selectedDate
                )
                : appointments;

        const upcoming = filteredAppointments.filter(appointment => {
            return (
                !isCancelled(appointment) &&
                !isCompleted(appointment) &&
                getAppointmentDateTime(appointment) >= now
            );
        });

        const past = filteredAppointments.filter(appointment => {
            return (
                isCancelled(appointment) ||
                isCompleted(appointment) ||
                getAppointmentDateTime(appointment) < now ||
                Number.isNaN(
                    getAppointmentDateTime(appointment).getTime()
                )
            );
        });

        upcoming.sort((a, b) =>
            getAppointmentDateTime(a) - getAppointmentDateTime(b)
        );

        past.sort((a, b) =>
            getAppointmentDateTime(b) - getAppointmentDateTime(a)
        );

        function addRows(items, tbody, isUpcoming) {

            if (items.length === 0) {
                const row = tbody.insertRow();
                const cell = row.insertCell();

                cell.colSpan = isUpcoming ? 8 : 7;

                cell.textContent = isUpcoming
                    ? "No upcoming appointments found."
                    : "No appointment history found.";

                return;
            }

            items.forEach(appointment => {
                const row = tbody.insertRow();

                const patientName = [
                    appointment.Patient_First_Name,
                    appointment.Patient_Last_Name
                ].filter(Boolean).join(" ") || "Unknown Patient";

                const officeLocation = [
                    appointment.Office_Street,
                    appointment.Office_City,
                    appointment.Office_State
                ].filter(Boolean).join(", ");

                const values = [
                    appointment.Appointment_ID,

                    appointment.Appointment_Date
                        ? String(appointment.Appointment_Date).slice(0, 10)
                        : "",

                    appointment.Appointment_Time || "",

                    patientName,

                    appointment.Appointment_Description || "",

                    officeLocation ||
                        `Office ${appointment.OFFICE_Office_ID || ""}`,

                    appointment.Appointment_Status || "Pending"
                ];

                values.forEach(value => {
                    const cell = row.insertCell();
                    cell.textContent = value ?? "";
                });

                if (isUpcoming) {
                    const actionCell = row.insertCell();

                    const scheduleLink = document.createElement("a");

                    scheduleLink.textContent = "View Schedule";
                    scheduleLink.href = "doctorSchedule.html";
                    scheduleLink.className = "requestBtn";

                    actionCell.appendChild(scheduleLink);
                }
            });
        }

        addRows(upcoming, upcomingBody, true);
        addRows(past, pastBody, false);

    } catch (error) {
        console.error(
            "Doctor appointment loading error:",
            error
        );

        upcomingBody.replaceChildren();
        pastBody.replaceChildren();

        const upcomingRow = upcomingBody.insertRow();
        const upcomingCell = upcomingRow.insertCell();

        upcomingCell.colSpan = 8;
        upcomingCell.textContent =
            "Could not load upcoming appointments.";

        const pastRow = pastBody.insertRow();
        const pastCell = pastRow.insertCell();

        pastCell.colSpan = 7;
        pastCell.textContent =
            "Could not load appointment history.";
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        loadDoctorAppointments
    );
} else {
    loadDoctorAppointments();
}
