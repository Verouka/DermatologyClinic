

const APPOINTMENTS_API_ORIGIN = "http://127.0.0.1:3000";
const DOCTOR_LOGIN_PAGE = "../LoginPage.html";

function appointmentsApi(path) {
    return `${APPOINTMENTS_API_ORIGIN}${path}`;
}

async function appointmentsGET(path) {
    const response = await fetch(appointmentsApi(path), {
        method: "GET",
        credentials: "include"
    });

    if (response.status === 401 || response.status === 403) {
        window.location.replace(DOCTOR_LOGIN_PAGE);
        return null;
    }

    if (!response.ok) {
        throw new Error(`${path} returned HTTP ${response.status}`);
    }

    return response.json();
}

function appointmentDate(value) {
    if (!value) return "";
    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function displayDate(value) {
    const date = appointmentDate(value);
    if (!date) return "—";
    const [year, month, day] = date.split("-");
    return `${month}/${day}/${year}`;
}

function displayTime(value) {
    if (!value) return "—";
    const time = String(value);
    const match = /^(\d{1,2}):(\d{2})/.exec(time);
    if (!match) return time;
    const hour = Number(match[1]);
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function appendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value == null || value === "" ? "—" : String(value);
    row.appendChild(cell);
    return cell;
}

function showTableMessage(tbody, columns, message) {
    tbody.replaceChildren();
    const row = document.createElement("tr");
    const cell = appendCell(row, message);
    cell.colSpan = columns;
    cell.className = "empty";
    tbody.appendChild(row);
}

function displayAppointments(tbody, appointments, upcoming) {
    const columns = upcoming ? 8 : 7;
    if (!Array.isArray(appointments)) {
        showTableMessage(tbody, columns, "The server returned an unexpected appointment response.");
        return;
    }
    if (appointments.length === 0) {
        showTableMessage(tbody, columns, upcoming ? "No upcoming appointments found." : "No past appointments found.");
        return;
    }

    tbody.replaceChildren();
    for (const item of appointments) {
        const row = document.createElement("tr");
        appendCell(row, item.Appointment_ID);
        appendCell(row, displayDate(item.Appointment_Date));
        appendCell(row, displayTime(item.Appointment_Time));
        appendCell(row, [item.Patient_First_Name, item.Patient_Last_Name].filter(Boolean).join(" "));
        appendCell(row, item.Appointment_Description);
        appendCell(row, [item.Office_City, item.Office_State].filter(Boolean).join(", ") || (item.OFFICE_Office_ID ? `Office ${item.OFFICE_Office_ID}` : ""));
        appendCell(row, item.Appointment_Status);

        if (upcoming) {
            const cell = document.createElement("td");
            const link = document.createElement("a");
            link.href = "doctorSchedule.html";
            link.textContent = "View Schedule";
            link.className = "requestBtn";
            link.style.display = "inline-block";
            link.style.padding = "7px 10px";
            cell.appendChild(link);
            row.appendChild(cell);
        }
        tbody.appendChild(row);
    }
}

function selectedAppointmentDate() {
    const date = new URLSearchParams(window.location.search).get("date");
    // Ignore malformed query parameters instead of using them to construct requests.
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const parsed = new Date(`${date}T12:00:00Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}

async function loadDoctorAppointments() {
    const upcomingRows = document.getElementById("upcomingAppointmentRows");
    const pastRows = document.getElementById("pastAppointmentRows");
    if (!upcomingRows || !pastRows) return;

    try {
        // Same authentication check used in your teammate's Patient Dashboard.
        const user = await appointmentsGET("/api/auth/me");
        if (!user) return;
        if (user.role !== "doctor" || !user.doctorId) {
            window.location.replace(DOCTOR_LOGIN_PAGE);
            return;
        }

        // Existing Doctor backend accepts scope=upcoming and scope=past.
        const results = await Promise.allSettled([
            appointmentsGET("/api/doctor/appointments?scope=upcoming"),
            appointmentsGET("/api/doctor/appointments?scope=past")
        ]);

        const date = selectedAppointmentDate();
        if (date) {
            const heading = document.querySelector(".appointments .upcomingAppointments h3");
            if (heading) heading.textContent = `Upcoming Appointments — ${displayDate(date)}`;
        }

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const tbody = i === 0 ? upcomingRows : pastRows;
            const upcoming = i === 0;
            if (result.status === "rejected") {
                console.error("Could not load doctor appointments:", result.reason);
                showTableMessage(tbody, upcoming ? 8 : 7, "Could not load appointments. Check the server connection.");
                continue;
            }
            if (result.value === null) return; // Already redirected for invalid session.
            const rows = date && Array.isArray(result.value)
                ? result.value.filter(item => appointmentDate(item.Appointment_Date) === date)
                : result.value;
            displayAppointments(tbody, rows, upcoming);
        }
    } catch (error) {
        console.error("Doctor appointment authentication error:", error);
        showTableMessage(upcomingRows, 8, "Could not connect to the login service.");
        showTableMessage(pastRows, 7, "Could not connect to the login service.");
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadDoctorAppointments);
} else {
    loadDoctorAppointments();
}
