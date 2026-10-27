const APPOINTMENTS_API =
    "http://127.0.0.1:3000/api/nurse/appointments";

const appointmentsTableBody = document.getElementById(
    "appointmentsTableBody"
);

const appointmentMessage = document.getElementById(
    "appointmentMessage"
);

function showAppointmentMessage(message) {
    appointmentMessage.textContent = message;
}

function addAppointmentCell(row, value) {
    const cell = row.insertCell();

    cell.textContent =
        value === null || value === undefined
            ? ""
            : String(value);

    return cell;
}

function showEmptyAppointments(message) {
    appointmentsTableBody.replaceChildren();

    const row = appointmentsTableBody.insertRow();
    const cell = row.insertCell();

    cell.colSpan = 7;
    cell.textContent = message;
}

function formatAppointmentTime(value) {
    if (!value) {
        return "N/A";
    }

    const parts = String(value).split(":");

    let hour = Number(parts[0]);
    const minute = parts[1] || "00";

    const period = hour >= 12 ? "PM" : "AM";

    hour = hour % 12 || 12;

    return `${String(hour).padStart(2, "0")}:${minute} ${period}`;
}

function normalizeStatus(value) {
    return String(value || "Scheduled")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function getStatusColor(status) {
    switch (normalizeStatus(status)) {
        case "checked in":
            return "green";

        case "waiting":
            return "orange";

        case "in triage":
            return "#2563eb";

        case "ready for doctor":
            return "green";

        case "cancelled":
        case "canceled":
            return "red";

        default:
            return "gray";
    }
}

async function appointmentRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "include",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        throw new Error(
            data.error || "Appointment request failed."
        );
    }

    return data;
}

function createActionButton(label, onClick) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;

    // Use the dashboard button colors without the logout class.
    button.style.backgroundColor = "rgb(2, 2, 85)";
    button.style.color = "white";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    button.style.padding = "10px 14px";
    button.style.cursor = "pointer";
    button.style.fontWeight = "bold";

    button.addEventListener("click", async () => {
        button.disabled = true;

        try {
            await onClick();
        } finally {
            button.disabled = false;
        }
    });

    return button;
}

function openPatientIntake(patientId, appointmentId) {
    const params = new URLSearchParams({
        patientId: String(patientId),
        appointmentId: String(appointmentId)
    });

    window.location.href =
        `NursePatients.html?${params.toString()}`;
}

async function startTriage(appointment) {
    showAppointmentMessage("Starting patient triage...");

    try {
        await appointmentRequest(
            `${APPOINTMENTS_API}/${appointment.Appointment_ID}/start-triage`,
            {
                method: "PATCH"
            }
        );

        openPatientIntake(
            appointment.PATIENT_Patient_ID,
            appointment.Appointment_ID
        );

    } catch (error) {
        console.error("Start triage error:", error);
        showAppointmentMessage(error.message);
        await loadAppointments(false);
    }
}

async function markReadyForDoctor(appointment) {
    showAppointmentMessage("Updating appointment status...");

    try {
        await appointmentRequest(
            `${APPOINTMENTS_API}/${appointment.Appointment_ID}/ready-for-doctor`,
            {
                method: "PATCH"
            }
        );

        await loadAppointments();

        showAppointmentMessage(
            "Patient marked Ready for Doctor."
        );

    } catch (error) {
        console.error("Ready for doctor error:", error);
        showAppointmentMessage(error.message);
        await loadAppointments(false);
    }
}

function displayAppointments(appointments) {
    appointmentsTableBody.replaceChildren();

    if (!appointments.length) {
        showEmptyAppointments(
            "No appointments scheduled for today at your office."
        );
        return;
    }

    appointments.forEach(appointment => {
        const row = appointmentsTableBody.insertRow();

        const patientName = [
            appointment.First_Name,
            appointment.Middle_Name,
            appointment.Last_Name
        ]
            .filter(Boolean)
            .join(" ");

        addAppointmentCell(
            row,
            appointment.Appointment_ID
        );

        addAppointmentCell(
            row,
            patientName || "Unknown Patient"
        );

        addAppointmentCell(
            row,
            formatAppointmentTime(
                appointment.Appointment_Time
            )
        );

        addAppointmentCell(
            row,
            appointment.Appointment_Description || "N/A"
        );

        addAppointmentCell(
            row,
            appointment.Booking_Method || "N/A"
        );

        const statusCell = row.insertCell();

        const status = appointment.Appointment_Status ||
            "Scheduled";

        const statusText = document.createElement("span");

        statusText.textContent = status;
        statusText.style.color = getStatusColor(status);
        statusText.style.fontWeight = "bold";

        statusCell.appendChild(statusText);

        const actionCell = row.insertCell();

        const normalized = normalizeStatus(status);

        if (normalized === "checked in") {
            actionCell.appendChild(
                createActionButton(
                    "Start Triage",
                    () => startTriage(appointment)
                )
            );

        } else if (normalized === "in triage") {
            const buttons = document.createElement("div");

            buttons.style.display = "flex";
            buttons.style.flexWrap = "wrap";
            buttons.style.gap = "8px";

            buttons.appendChild(
                createActionButton(
                    "Continue Triage",
                    () => openPatientIntake(
                        appointment.PATIENT_Patient_ID,
                        appointment.Appointment_ID
                    )
                )
            );

            buttons.appendChild(
                createActionButton(
                    "Ready for Doctor",
                    () => markReadyForDoctor(appointment)
                )
            );

            actionCell.appendChild(buttons);

        } else if (normalized === "ready for doctor") {
            actionCell.textContent = "Ready";

        } else {
            actionCell.textContent =
                "Waiting for check-in";
        }
    });
}

async function loadAppointments(clearMessage = true) {
    if (clearMessage) {
        showAppointmentMessage("Loading today's appointments...");
    }

    try {
        const data = await appointmentRequest(
            APPOINTMENTS_API
        );

        displayAppointments(data.appointments || []);

        if (clearMessage) {
            showAppointmentMessage("");
        }

    } catch (error) {
        console.error("Appointments loading error:", error);

        showEmptyAppointments(
            "Unable to load appointments."
        );

        showAppointmentMessage(error.message);
    }
}

loadAppointments();