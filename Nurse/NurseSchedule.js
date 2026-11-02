
const scheduleBody = document.getElementById("nurseScheduleBody");

function showScheduleMessage(message) {
    scheduleBody.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 5;
    cell.textContent = message;

    row.appendChild(cell);
    scheduleBody.appendChild(row);
}

function formatTime(value) {
    if (!value) return "Not assigned";

    const match = String(value).match(/^(\d{1,2}):(\d{2})/);

    if (!match) return String(value);

    const hour = Number(match[1]);
    const minute = match[2];

    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${String(displayHour).padStart(2, "0")}:${minute} ${period}`;
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "Not assigned";
    row.appendChild(cell);
}

async function loadNurseSchedule() {
    showScheduleMessage("Loading your schedule...");

    try {
        const response = await fetch(
            "/api/nurse/schedule",
            {
                method: "GET",
                credentials: "include"
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Could not load your schedule."
            );
        }

        if (!Array.isArray(result) || result.length === 0) {
            showScheduleMessage("No schedule assigned.");
            return;
        }

        scheduleBody.replaceChildren();

        result.forEach(item => {
            const row = document.createElement("tr");

            addCell(row, item.dayOfWeek || "Not assigned");
            addCell(row, formatTime(item.startTime));
            addCell(row, formatTime(item.endTime));
            addCell(row, item.office || "Not assigned");
            addCell(row, item.doctor || "Not assigned");

            scheduleBody.appendChild(row);
        });

    } catch (error) {
        console.error("Nurse schedule error:", error);
        showScheduleMessage(error.message);
    }
}

loadNurseSchedule();
