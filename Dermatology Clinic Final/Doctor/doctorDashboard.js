const API_BASE = "http://127.0.0.1:3000";
const LOGIN_PAGE = "../LoginPage.html";

async function getDoctorData(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "GET",
        credentials: "include"
    });

    if (!response.ok) {
        const error = new Error(`${endpoint}: HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

function connectDashboardCards() {
    const links = [
        [".cards .card1", "doctorAppointments.html"],
        [".cards .card2", "doctorPatients.html#assigned-patients"],
        [".cards .card3", "doctorReferrals.html#pending-referrals"],
        [".cards .card4", "doctorSchedule.html"]
    ];

    for (const [selector, page] of links) {
        const card = document.querySelector(selector);
        if (!card) continue;
        card.style.cursor = "pointer";
        card.setAttribute("role", "link");
        card.setAttribute("tabindex", "0");
        card.addEventListener("click", () => {
            window.location.href = page;
        });
        card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                window.location.href = page;
            }
        });
    }
}

async function loadDoctorDashboard() {
    try {
        const user = await getDoctorData("/api/auth/me");
        if (user.role !== "doctor") {
            window.location.replace(LOGIN_PAGE);
            return;
        }

        const doctor = await getDoctorData("/api/doctor/me");
        const name = [doctor.First_Name, doctor.Last_Name]
            .filter(Boolean).join(" ");
        const greeting = document.querySelector(".mainContent .maintitle");
        if (greeting && name) {
            greeting.textContent = `Welcome, Dr. ${name}!`;
        }

        connectDashboardCards();
    } catch (error) {
        console.error("Doctor Dashboard:", error);
        if (error.status === 401 || error.status === 403) {
            window.location.replace(LOGIN_PAGE);
        }
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadDoctorDashboard);
} else {
    loadDoctorDashboard();
}
