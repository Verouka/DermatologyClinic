
document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "/api/admin";

    const addStaffBtn = document.getElementById("addStaffBtn");
    const staffForm = document.getElementById("staffForm");
    const staffRole = document.getElementById("staffRole");
    const doctorSection = document.getElementById("doctorSection");
    const singleOfficeSection = document.getElementById("singleOfficeSection");
    const staffMessage = document.getElementById("staffMessage");
    const createStaffBtn = document.getElementById("createStaffBtn");

    const doctorsTable = document.getElementById("doctorsTable");
    const nursesTable = document.getElementById("nursesTable");
    const receptionistsTable = document.getElementById("receptionistsTable");

    function formatDate(value) {
        if (!value) return "—";

        const dateString = String(value).slice(0, 10);
        const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        return match
            ? `${match[2]}/${match[3]}/${match[1]}`
            : dateString;
    }

    function displayMessage(tbody, message, columnCount) {
        if (!tbody) return;

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = columnCount;
        cell.textContent = message;

        row.appendChild(cell);
        tbody.replaceChildren(row);
    }

    function addCell(row, value) {
        const cell = document.createElement("td");

        cell.textContent =
            value === null || value === undefined || value === ""
                ? "—"
                : String(value);

        row.appendChild(cell);
    }

    function getName(person) {
        if (person.name) return String(person.name);

        const parts = [
            person.firstName ?? person.First_Name,
            person.middleName ?? person.Middle_Name,
            person.lastName ?? person.Last_Name
        ].filter(Boolean);

        return parts.join(" ") || "—";
    }

    async function fetchStaff(path) {
        const response = await fetch(`${API_BASE}/${path}`, {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json"
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || `HTTP ${response.status}`
            );
        }

        if (!Array.isArray(result)) {
            throw new Error(`Unexpected response from ${path}`);
        }

        return result;
    }

    // LOAD DOCTORS
    async function loadDoctors() {
        if (!doctorsTable) return;

        displayMessage(doctorsTable, "Loading doctors...", 4);

        try {
            const doctors = await fetchStaff("loadDoctors");

            doctorsTable.replaceChildren();

            if (doctors.length === 0) {
                displayMessage(doctorsTable, "No doctors found.", 4);
                return;
            }

            doctors.forEach((doctor) => {
                const row = document.createElement("tr");

                addCell(row, getName(doctor));
                addCell(row, doctor.id ?? doctor.doctorId ?? doctor.Doctor_ID);

                addCell(
                    row,
                    doctor.specialtyName ??
                    doctor.specialty ??
                    doctor.specialtyId ??
                    doctor.Specialty_ID
                );

                addCell(
                    row,
                    formatDate(
                        doctor.startDate ??
                        doctor.hireDate ??
                        doctor.Hire_Date
                    )
                );

                doctorsTable.appendChild(row);
            });

        } catch (error) {
            console.error("Error loading doctors:", error);

            displayMessage(
                doctorsTable,
                "Unable to load doctors.",
                4
            );
        }
    }

    // LOAD NURSES
    async function loadNurses() {
        if (!nursesTable) return;

        displayMessage(nursesTable, "Loading nurses...", 4);

        try {
            const nurses = await fetchStaff("loadNurses");

            nursesTable.replaceChildren();

            if (nurses.length === 0) {
                displayMessage(nursesTable, "No nurses found.", 4);
                return;
            }

            nurses.forEach((nurse) => {
                const row = document.createElement("tr");

                addCell(row, getName(nurse));
                addCell(row, nurse.id ?? nurse.nurseId ?? nurse.Nurse_ID);

                addCell(
                    row,
                    nurse.doctorId ??
                    nurse.assignedDoctorId ??
                    nurse.DOCTOR_Doctor_ID ??
                    "—"
                );

                addCell(
                    row,
                    formatDate(
                        nurse.startDate ??
                        nurse.hireDate ??
                        nurse.Hire_Date
                    )
                );

                nursesTable.appendChild(row);
            });

        } catch (error) {
            console.error("Error loading nurses:", error);

            displayMessage(
                nursesTable,
                "Unable to load nurses.",
                4
            );
        }
    }

    // LOAD RECEPTIONISTS
    async function loadReceptionists() {
        if (!receptionistsTable) return;

        displayMessage(
            receptionistsTable,
            "Loading receptionists...",
            3
        );

        try {
            const receptionists = await fetchStaff("loadReceptionists");

            receptionistsTable.replaceChildren();

            if (receptionists.length === 0) {
                displayMessage(
                    receptionistsTable,
                    "No receptionists found.",
                    3
                );
                return;
            }

            receptionists.forEach((receptionist) => {
                const row = document.createElement("tr");

                addCell(row, getName(receptionist));

                addCell(
                    row,
                    receptionist.id ??
                    receptionist.receptionistId ??
                    receptionist.Receptionist_ID
                );

                addCell(
                    row,
                    formatDate(
                        receptionist.startDate ??
                        receptionist.hireDate ??
                        receptionist.Hire_Date
                    )
                );

                receptionistsTable.appendChild(row);
            });

        } catch (error) {
            console.error("Error loading receptionists:", error);

            displayMessage(
                receptionistsTable,
                "Unable to load receptionists.",
                3
            );
        }
    }

    // REFRESH ALL TABLES
    async function loadAllStaff() {
        await Promise.all([
            loadDoctors(),
            loadNurses(),
            loadReceptionists()
        ]);
    }

    // SHOW/HIDE STAFF FORM
    addStaffBtn.addEventListener("click", () => {
        staffForm.hidden = !staffForm.hidden;
        staffMessage.textContent = "";
    });

    // CHANGE FORM BASED ON ROLE
    staffRole.addEventListener("change", () => {
        const isDoctor = staffRole.value === "doctor";

        doctorSection.hidden = !isDoctor;
        singleOfficeSection.hidden = isDoctor;
    });

    // CREATE STAFF ACCOUNT
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

            const nurseValue = document.getElementById("staffNurse").value;

            if (nurseValue.trim()) {
                data.nurseId = Number(nurseValue);
            }

            data.officeIds = document.getElementById("doctorOffices")
                .value
                .split(",")
                .map((id) => Number(id.trim()))
                .filter((id) => Number.isInteger(id) && id > 0);

        } else {
            data.officeId = Number(
                document.getElementById("staffOffice").value
            );
        }

        createStaffBtn.disabled = true;
        staffMessage.textContent = "Creating staff account...";

        try {
            const response = await fetch(`${API_BASE}/staff`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Could not create staff account."
                );
            }

            staffMessage.textContent =
                "Staff account created successfully!";

            staffForm.reset();
            staffForm.hidden = true;
            doctorSection.hidden = true;
            singleOfficeSection.hidden = false;

            // Reload staff from database after successful creation.
            await loadAllStaff();

        } catch (error) {
            console.error("Error creating staff:", error);
            staffMessage.textContent = error.message;

        } finally {
            createStaffBtn.disabled = false;
        }
    });

    // LOAD DATABASE RECORDS WHEN PAGE OPENS
    loadAllStaff();
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