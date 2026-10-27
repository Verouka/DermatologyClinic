

const addStaffBtn = document.getElementById("addStaffBtn");
const staffForm = document.getElementById("staffForm");
const staffRole = document.getElementById("staffRole");
const doctorSection = document.getElementById("doctorSection");
const singleOfficeSection = document.getElementById("singleOfficeSection");
const staffMessage = document.getElementById("staffMessage");

addStaffBtn.addEventListener("click", () => {
    staffForm.hidden = !staffForm.hidden;
});

staffRole.addEventListener("change", () => {
    const isDoctor = staffRole.value === "doctor";

    doctorSection.hidden = !isDoctor;
    singleOfficeSection.hidden = isDoctor;
});

staffForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const role = staffRole.value;

    const data = {
        role,
        firstName: document.getElementById("staffFirstName").value.trim(),
        lastName: document.getElementById("staffLastName").value.trim(),
        email: document.getElementById("staffEmail").value.trim(),
        password: document.getElementById("staffPassword").value
    };

    if (role === "doctor") {
        data.specialtyId = Number(
            document.getElementById("staffSpecialty").value
        );

        data.nurseId = Number(
            document.getElementById("staffNurse").value
        );

        data.officeIds = document.getElementById("doctorOffices")
            .value.split(",")
            .map(id => Number(id.trim()));

    } else {
        data.officeId = Number(
            document.getElementById("staffOffice").value
        );
    }

    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/admin/staff",
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            }
        );

        const result = await response.json();

        staffMessage.textContent = response.ok
            ? "Staff account created successfully!"
            : result.error || "Could not create staff account.";

        if (response.ok) {
            staffForm.reset();
            doctorSection.hidden = true;
            singleOfficeSection.hidden = false;
        }

    } catch (error) {
        console.error(error);
        staffMessage.textContent = "Cannot connect to server.";
    }
});

//#region FILL TABLES


async function loadDoctors() {
    const tableBody = document.getElementById("doctorsTable");

    // Stop if this page does not contain the doctors table
    if (!tableBody) return;

    try {
        const response = await fetch(
            "http://localhost:3000/api/admin/loadDoctors",
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch doctors: ${response.status}`);
        }

        const doctors = await response.json();

        tableBody.replaceChildren();

        if (doctors.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();

            cell.colSpan = 4;
            cell.textContent = "No entries";
            return;
        }

        doctors.forEach(doctor => {
            const row = tableBody.insertRow();

            row.insertCell().textContent =
                `${doctor.firstName} ${doctor.lastName}`;
            row.insertCell().textContent = doctor.id;
            row.insertCell().textContent = doctor.specialtyId;
            row.insertCell().textContent = "N/A";
        });

    } catch (error) {
        console.error("Error loading doctors:", error);
    }
}


async function loadNurses() {
    const tableBody = document.getElementById("nursesTable");
    if (!tableBody) return;

    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/admin/loadNurses",
            { credentials: "include" }
        );

        if (!response.ok) {
            throw new Error(`Failed to load nurses: ${response.status}`);
        }

        const nurses = await response.json();
        tableBody.replaceChildren();

        if (nurses.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 3;
            cell.textContent = "No entries";
            return;
        }

        nurses.forEach(nurse => {
            const row = tableBody.insertRow();
            row.insertCell().textContent =
                `${nurse.firstName} ${nurse.lastName}`;
            row.insertCell().textContent = nurse.id;
            row.insertCell().textContent = "None";
            row.insertCell().textContent = nurse.officeId;
            row.insertCell().textContent = "N/A";
        });
    } catch (error) {
        console.error("Error loading nurses:", error);
    }
}


async function loadReceptionists() {
    const tableBody = document.getElementById("receptionistsTable");
    if (!tableBody) return;

    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/admin/loadReceptionists",
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch receptionists: ${response.status}`);
        }

        const receptionists = await response.json();

        tableBody.replaceChildren();

        if (receptionists.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.textContent = "No receptionists found";
            return;
        }

        receptionists.forEach(receptionist => {
            const row = tableBody.insertRow();

            row.insertCell().textContent =
                `${receptionist.firstName} ${receptionist.lastName}`;

            row.insertCell().textContent = receptionist.id;
            row.insertCell().textContent = receptionist.officeId;
            row.insertCell().textContent = "N/A"; // Start date
        });

    } catch (error) {
        console.error("Error loading receptionists:", error);

        tableBody.replaceChildren();
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent = "Could not load receptionists";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadDoctors();
    loadNurses();
    loadReceptionists();
});

//#endregion