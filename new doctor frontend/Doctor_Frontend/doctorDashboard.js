

const DOCTOR_API_ORIGIN = "http://127.0.0.1:3000";
const LOGIN_PAGE = "../LoginPage.html"; 

function doctorApi(path) {
    return `${DOCTOR_API_ORIGIN}${path}`;
}

function setDashboardText(selector, message) {
    const element = document.querySelector(selector);
    if (element) element.textContent = message;
}


function enableDashboardCards() {
    const destinations = [
        [".cards .card1", "doctorAppointments.html", "View upcoming appointments"],
        [".cards .card2", "doctorPatients.html#assigned-patients", "View assigned patients"],
        [".cards .card3", "doctorReferrals.html#pending-referrals", "View referrals"],
        [".cards .card4", "doctorSchedule.html", "View my schedule"]
    ];

    for (const [selector, destination, label] of destinations) {
        const card = document.querySelector(selector);
        if (!card) continue;

        card.setAttribute("role", "link");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-label", label);
        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
            window.location.href = destination;
        });
        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                window.location.href = destination;
            }
        });
    }
}

async function getDoctorJSON(path) {
    const response = await fetch(doctorApi(path), {
        method: "GET",
        credentials: "include"
    });

    if (response.status === 401 || response.status === 403) {
        // A session is no longer valid or this user cannot access Doctor data.
        window.location.replace(LOGIN_PAGE);
        return null;
    }
    if (!response.ok) {
        throw new Error(`${path} returned HTTP ${response.status}`);
    }
    return response.json();
}

async function loadDoctorOverview() {
    const data = await getDoctorJSON("/api/doctor/dashboard");
    if (!data) return;

    
    if (data.upcomingAppointments != null) {
        setDashboardText(".cards .card1 h4", `${data.upcomingAppointments} upcoming appointment(s)`);
    }
    if (data.assignedPatients != null) {
        setDashboardText(".cards .card2 h4", `${data.assignedPatients} assigned patient(s)`);
    }
    if (data.pendingReferrals != null) {
        setDashboardText(".cards .card3 h4", `${data.pendingReferrals} pending referral(s)`);
    }
}

async function loadDoctorScheduleSummary() {
    const data = await getDoctorJSON("/api/doctor/schedule");
    if (!data) return;
    if (Array.isArray(data.workHours)) {
        setDashboardText(".cards .card4 h4", `${data.workHours.length} scheduled shift(s) — view schedule`);
    }
}

async function loadDoctorDashboard() {
    enableDashboardCards();

    const greeting = document.querySelector(".mainContent .maintitle");
    const status = document.createElement("p");
    status.id = "doctorDashboardStatus";
    status.setAttribute("role", "status");
    status.style.marginTop = "8px";
    status.style.fontSize = "0.9rem";
    if (greeting?.parentElement) greeting.parentElement.appendChild(status);

    try {
        
        const session = await getDoctorJSON("/api/auth/me");
        if (!session) return;

        if (session.role !== "doctor" || !session.doctorId) {
            window.location.replace(LOGIN_PAGE);
            return;
        }

        const profile = await getDoctorJSON("/api/doctor/me");
        if (!profile) return;

        const fullName = [profile.First_Name, profile.Last_Name]
            .filter(Boolean)
            .join(" ");
        if (greeting && fullName) greeting.textContent = `Hello, Dr. ${fullName}!`;

        
        const results = await Promise.allSettled([
            loadDoctorOverview(),
            loadDoctorScheduleSummary()
        ]);
        if (results.some(result => result.status === "rejected")) {
            status.textContent = "Some dashboard information is unavailable right now.";
            for (const result of results) {
                if (result.status === "rejected") console.error("Doctor dashboard API error:", result.reason);
            }
        }
    } catch (error) {
        console.error("Doctor Dashboard could not load:", error);
        status.textContent = "Could not connect to the clinic backend. Check that the server is running.";
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadDoctorDashboard);
} else {
    loadDoctorDashboard();
}
