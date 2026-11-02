
const DASHBOARD_API = "/api/nurse/dashboard";

const greetingElement = document.getElementById("nurseGreeting");
const appointmentsElement = document.getElementById("todayAppointments");
const intakeElement = document.getElementById("intakeSummary");
const shiftElement = document.getElementById("shiftSummary");
const profileElement = document.getElementById("profileSummary");
const notificationsElement = document.getElementById("notificationList");
const messageElement = document.getElementById("dashboardMessage");

// DISPLAY DASHBOARD MESSAGE
function setDashboardMessage(message) {
    messageElement.textContent = message;
}

// ADD NOTIFICATION
function addNotification(message) {
    const item = document.createElement("li");

    item.textContent = message;
    notificationsElement.appendChild(item);
}

// DISPLAY NOTIFICATIONS
function displayNotifications(notifications) {
    notificationsElement.replaceChildren();

    if (!notifications.length) {
        addNotification("No appointment updates for today.");
        return;
    }

    notifications.forEach((notification) => {
        addNotification(notification.message);
    });
}

// LOAD DASHBOARD
async function loadDashboard() {
    setDashboardMessage("Loading dashboard...");

    try {
        const response = await fetch(DASHBOARD_API, {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json"
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Unable to load dashboard."
            );
        }

        const nurse = data.nurse;
        const summary = data.summary;

        // DISPLAY NURSE NAME
        greetingElement.textContent =
            `Hello Nurse ${nurse.firstName || ""}`.trim();

        // DISPLAY TODAY'S APPOINTMENTS
        appointmentsElement.textContent =
            `${summary.totalAppointments} Appointments Today`;

        // DISPLAY PATIENT INTAKE SUMMARY
        intakeElement.textContent =
            `${summary.checkedIn} Checked In | ` +
            `${summary.inTriage} In Triage | ` +
            `${summary.readyForDoctor} Ready`;

        // DISPLAY TODAY'S SHIFT
        if (data.todayShift) {
            shiftElement.textContent =
                `${data.todayShift.Start_Time} - ` +
                `${data.todayShift.End_Time} ` +
                `(Office #${data.todayShift.OFFICE_Office_ID})`;
        } else {
            shiftElement.textContent = "No shift scheduled today";
        }

        // DISPLAY PROFILE NAME
        profileElement.textContent =
            [nurse.firstName, nurse.lastName]
                .filter(Boolean)
                .join(" ") || "View My Profile";

        // DISPLAY NOTIFICATIONS
        displayNotifications(data.notifications || []);

        setDashboardMessage("");

    } catch (error) {
        console.error("Dashboard loading error:", error);

        greetingElement.textContent = "Hello Nurse";
        appointmentsElement.textContent = "Unavailable";
        intakeElement.textContent = "Unavailable";
        shiftElement.textContent = "View My Schedule";
        profileElement.textContent = "View My Profile";

        notificationsElement.replaceChildren();

        addNotification("Unable to load appointment updates.");

        setDashboardMessage(error.message);
    }
}

// INITIAL LOAD
loadDashboard();
