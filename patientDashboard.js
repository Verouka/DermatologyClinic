
const API_BASE = "http://127.0.0.1:3000";

async function getPatientData(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error(`Failed to load ${endpoint}`);
    }

    return response.json();
}

function formatMoney(amount) {
    return Number(amount || 0).toLocaleString("en-US", {
        style: "currency",
        currency: "USD"
    });
}

function formatDate(value) {
    if (!value) return "Date unavailable";

    const datePart = String(value).slice(0, 10);
    const parts = datePart.split("-");

    if (parts.length !== 3) return datePart;

    return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

// Load the patient's next appointment.
async function loadAppointments() {
    const element = document.getElementById("nextAppointment");

    if (!element) return;

    try {
        const appointments = await getPatientData(
            "/api/patient/appointments"
        );

        const now = new Date();

        const upcoming = appointments
            .filter(appointment => {
                const status = String(
                    appointment.Appointment_Status || ""
                ).toLowerCase();

                const date = String(
                    appointment.Appointment_Date
                ).slice(0, 10);

                const time = String(
                    appointment.Appointment_Time
                ).slice(0, 8);

                const appointmentDate = new Date(
                    `${date}T${time}`
                );

                return (
                    !["cancelled", "canceled", "completed"].includes(status) &&
                    appointmentDate > now
                );
            })
            .sort((a, b) => {
                const first = new Date(
                    `${String(a.Appointment_Date).slice(0, 10)}T${a.Appointment_Time}`
                );

                const second = new Date(
                    `${String(b.Appointment_Date).slice(0, 10)}T${b.Appointment_Time}`
                );

                return first - second;
            });

        if (upcoming.length === 0) {
            element.textContent = "No upcoming appointments.";
            return;
        }

        const next = upcoming[0];

        element.textContent =
            `${formatDate(next.Appointment_Date)} with Dr. ` +
            `${next.Doctor_First_Name} ${next.Doctor_Last_Name}`;

    } catch (error) {
        console.error("Appointment dashboard error:", error);
        element.textContent = "Unable to load appointments.";
    }
}

// Load medical records summary.
async function loadMedicalRecords() {
    const element = document.getElementById(
        "medicalRecordsSummary"
    );

    if (!element) return;

    try {
        const records = await getPatientData(
            "/api/patient/medical-records"
        );

        const total =
            (records.medicalHistory?.length || 0) +
            (records.allergies?.length || 0) +
            (records.diagnoses?.length || 0) +
            (records.treatments?.length || 0) +
            (records.prescriptions?.length || 0) +
            (records.referrals?.length || 0);

        element.textContent =
            total === 0
                ? "No medical records available."
                : `${total} medical record entries available.`;

    } catch (error) {
        console.error("Medical records dashboard error:", error);
        element.textContent = "Unable to load medical records.";
    }
}

// Load outstanding billing balance.
async function loadBillingSummary() {
    const element = document.getElementById("billingSummary");

    if (!element) return;

    try {
        const billing = await getPatientData(
            "/api/patient/billing"
        );

        element.textContent =
            `Outstanding Balance: ` +
            formatMoney(billing.summary.outstandingBalance);

    } catch (error) {
        console.error("Billing dashboard error:", error);
        element.textContent = "Unable to load billing information.";
    }
}

// Display the patient's email.
function displayProfileSummary(patient) {
    const element = document.getElementById("profileSummary");

    if (!element) return;

    element.textContent =
        patient.Email || "View your contact information.";
}

// Load assigned doctors from the database.
async function loadAssignedDoctors() {
    const element = document.getElementById("assignedDoctors");

    if (!element) return;

    try {
        const doctors = await getPatientData(
            "/api/patient/doctors"
        );

        if (doctors.length === 0) {
            element.textContent = "No doctors assigned yet.";
            return;
        }

        element.replaceChildren();

        for (const doctor of doctors) {
            const paragraph = document.createElement("p");

            paragraph.textContent =
                `Dr. ${doctor.First_Name} ${doctor.Last_Name}`;

            paragraph.style.marginBottom = "8px";

            element.appendChild(paragraph);
        }

    } catch (error) {
        console.error("Assigned doctors error:", error);
        element.textContent = "Unable to load assigned doctors.";
    }
}

// Verify the patient session and load dashboard data.
async function checkPatientSession() {
    try {
        const response = await fetch(
            `${API_BASE}/api/auth/me`,
            {
                credentials: "include"
            }
        );

        if (!response.ok) {
            window.location.replace("LoginPage.html");
            return;
        }

        const user = await response.json();

        if (user.role !== "patient") {
            window.location.replace("LoginPage.html");
            return;
        }

        console.log("Patient authenticated:", user.patientId);

        const patient = await getPatientData("/api/patient/me");

        document.getElementById("patientGreeting").textContent =
            `Hello, ${patient.First_Name}!`;

        displayProfileSummary(patient);

        document.body.hidden = false;

        await Promise.all([
            loadAppointments(),
            loadMedicalRecords(),
            loadBillingSummary(),
            loadAssignedDoctors()
        ]);

    } catch (error) {
        console.error("Dashboard authentication error:", error);
        window.location.replace("LoginPage.html");
    }
}

checkPatientSession();
