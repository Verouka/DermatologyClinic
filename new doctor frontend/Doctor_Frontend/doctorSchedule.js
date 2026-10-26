"use strict";


const DOCTOR_API = "http://127.0.0.1:3000";
const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const dateRangeLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
let weekMonday = getMonday(new Date());
let requestNumber = 0;

function getMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d;
}

function addDays(date, days) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + days);
    return d;
}

function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function mysqlDate(value) {
    // MySQL DATE values commonly arrive as YYYY-MM-DD or as ISO date strings.
    return value ? String(value).slice(0, 10) : "";
}

function formatTime(value) {
    const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return value ? String(value) : "—";
    const hour = Number(match[1]);
    return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

function setText(id, text) {
    document.getElementById(id).textContent = text;
}

function showHeader() {
    const sunday = addDays(weekMonday, 6);
    const firstMonth = monthLabel.format(weekMonday);
    const lastMonth = monthLabel.format(sunday);
    setText("calendarMonthTitle", firstMonth === lastMonth ? firstMonth : `${firstMonth} – ${lastMonth}`);
    setText("calendarRange", `${dateRangeLabel.format(weekMonday)} – ${dateRangeLabel.format(sunday)}`);

    const headings = document.getElementById("calendarDayHeaders");
    headings.replaceChildren();
    for (let i = 0; i < 7; i++) {
        const day = addDays(weekMonday, i);
        const th = document.createElement("th");
        if (dateKey(day) === dateKey(new Date())) th.classList.add("calendarIsToday");
        const name = document.createElement("span");
        name.className = "calendarWeekday";
        name.textContent = weekdayNames[i];
        const number = document.createElement("span");
        number.className = "calendarDate";
        number.textContent = String(day.getDate());
        th.append(name, number);
        headings.append(th);
    }
}

function showWorkHours(shifts) {
    if (!shifts.length) {
        for (const id of ["workingDayValue", "startTimeValue", "endTimeValue", "officeValue"]) setText(id, "No assigned shifts");
        return;
    }
    const days = [...new Set(shifts.map(s => s.Day_of_Week).filter(Boolean))];
    const startTimes = shifts.map(s => String(s.Start_Time ?? "")).filter(Boolean).sort();
    const endTimes = shifts.map(s => String(s.End_Time ?? "")).filter(Boolean).sort();
    const offices = [...new Set(shifts.map(s =>
        [s.Office_City, s.Office_State].filter(Boolean).join(", ") || `Office #${s.Office_ID ?? "?"}`))];
    setText("workingDayValue", days.join(", ") || "—");
    setText("startTimeValue", startTimes.length ? formatTime(startTimes[0]) : "—");
    setText("endTimeValue", endTimes.length ? formatTime(endTimes[endTimes.length - 1]) : "—");
    setText("officeValue", offices.join(" / "));
}

function appointmentPatient(a) {
    return [a.First_Name ?? a.Patient_First_Name, a.Last_Name ?? a.Patient_Last_Name]
        .filter(Boolean).join(" ") || "Patient appointment";
}

function drawCalendar(appointments, shifts) {
    const row = document.getElementById("calendarAppointmentCells");
    row.replaceChildren();
    for (let i = 0; i < 7; i++) {
        const day = addDays(weekMonday, i);
        const key = dateKey(day);
        const td = document.createElement("td");
        td.className = "calendarCell";
        for (const shift of shifts.filter(s => String(s.Day_of_Week).toLowerCase() === weekdayNames[i].toLowerCase())) {
            const block = document.createElement("div");
            block.className = "calendarShift";
            block.textContent = `Shift: ${formatTime(shift.Start_Time)} – ${formatTime(shift.End_Time)}`;
            td.append(block);
        }
        for (const appt of appointments.filter(a => mysqlDate(a.Appointment_Date) === key)) {
            const link = document.createElement("a");
            link.className = "calendarEvent";
            link.href = `doctorAppointments.html?date=${encodeURIComponent(key)}`;
            const time = document.createElement("strong");
            time.textContent = formatTime(appt.Appointment_Time);
            const patient = document.createElement("span");
            patient.textContent = appointmentPatient(appt);
            link.append(time, patient);
            td.append(link);
        }
        if (!td.childNodes.length) td.textContent = "—";
        row.append(td);
    }
}

function drawAppointmentTable(appointments) {
    const tbody = document.getElementById("weeklyAppointmentRows");
    tbody.replaceChildren();
    if (!appointments.length) {
        const tr = tbody.insertRow();
        const td = tr.insertCell();
        td.colSpan = 7;
        td.textContent = "No appointments scheduled for this week.";
        return;
    }
    for (const a of appointments) {
        const tr = tbody.insertRow();
        const values = [a.Appointment_ID, mysqlDate(a.Appointment_Date), formatTime(a.Appointment_Time),
            appointmentPatient(a), a.Appointment_Description || "—", a.OFFICE_Office_ID ?? "—", a.Appointment_Status || "—"];
        for (const value of values) tr.insertCell().textContent = String(value ?? "—");
    }
}

async function requestJSON(path) {
    const response = await fetch(`${DOCTOR_API}${path}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`Server returned HTTP ${response.status} for ${path}`);
    return response.json();
}

async function loadSchedule() {
    const myRequest = ++requestNumber;
    showHeader();
    setText("scheduleNotice", "Loading schedule...");
    try {
        const data = await requestJSON(`/api/doctor/schedule?weekStart=${encodeURIComponent(dateKey(weekMonday))}`);
        if (myRequest !== requestNumber) return;
        if (!Array.isArray(data.workHours) || !Array.isArray(data.weeklyAppointments)) {
            throw new Error("Schedule API must return workHours and weeklyAppointments arrays.");
        }
        showWorkHours(data.workHours);
        drawCalendar(data.weeklyAppointments, data.workHours);
        drawAppointmentTable(data.weeklyAppointments);
        setText("scheduleNotice", `${data.weeklyAppointments.length} appointment(s) for this week.`);
    } catch (error) {
        if (myRequest !== requestNumber) return;
        console.error("Unable to load doctor schedule:", error);
        drawCalendar([], []);
        drawAppointmentTable([]);
        setText("scheduleNotice", `Could not load schedule: ${error.message}`);
    }
}

async function startDoctorSchedule() {
    showHeader();
    try {
        const session = await requestJSON("/api/auth/me");
        if (session.role !== "doctor") {
            window.location.replace("../LoginPage.html");
            return;
        }
    } catch (error) {
        console.error("Doctor login check failed:", error);
        setText("scheduleNotice", "Could not verify your login. Please sign in and try again.");
        return;
    }
    document.getElementById("previousWeek").addEventListener("click", () => {
        weekMonday = addDays(weekMonday, -7);
        loadSchedule();
    });
    document.getElementById("todayWeek").addEventListener("click", () => {
        weekMonday = getMonday(new Date());
        loadSchedule();
    });
    document.getElementById("nextWeek").addEventListener("click", () => {
        weekMonday = addDays(weekMonday, 7);
        loadSchedule();
    });
    await loadSchedule();
}

startDoctorSchedule();
