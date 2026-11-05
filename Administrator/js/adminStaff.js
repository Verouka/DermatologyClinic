
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // ADD STAFF ELEMENTS
    // ==========================================

    const addStaffBtn = document.getElementById("addStaffBtn");
    const staffForm = document.getElementById("staffForm");
    const staffRole = document.getElementById("staffRole");
    const doctorSection = document.getElementById("doctorSection");
    const singleOfficeSection = document.getElementById("singleOfficeSection");
    const staffMessage = document.getElementById("staffMessage");


    // ==========================================
    // SHOW / HIDE ADD STAFF FORM
    // ==========================================

    addStaffBtn.addEventListener("click", () => {
        staffForm.hidden = !staffForm.hidden;
    });


    // ==========================================
    // STAFF ROLE SELECTION
    // ==========================================

    staffRole.addEventListener("change", () => {
        const isDoctor = staffRole.value === "doctor";

        doctorSection.hidden = !isDoctor;
        singleOfficeSection.hidden = isDoctor;
    });


    // ==========================================
    // CREATE STAFF ACCOUNT
    // ==========================================

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

                // Refresh all staff tables.
                await loadDoctors();
                await loadNurses();
                await loadReceptionists();
            }

        } catch (error) {
            console.error("Error creating staff account:", error);
            staffMessage.textContent = "Cannot connect to server.";
        }
    });


    // ==========================================
    // HELPER: DISPLAY TABLE MESSAGE
    // ==========================================

    function displayTableMessage(tableBody, message, columnCount) {
        tableBody.replaceChildren();

        const row = tableBody.insertRow();
        const cell = row.insertCell();

        cell.colSpan = columnCount;
        cell.textContent = message;
    }


    // ==========================================
    // HELPER: CREATE DELETE BUTTON
    // ==========================================

    function createDeleteButton(role, id) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "deleteStaffBtn";
        button.textContent = "Delete";

        button.addEventListener("click", () => {
            deleteStaff(role, id);
        });

        return button;
    }


    // ==========================================
    // DELETE STAFF ACCOUNT
    // ==========================================

    async function deleteStaff(role, id) {

        const roleName =
            role.charAt(0).toUpperCase() + role.slice(1);

        const confirmed = confirm(
            `Are you sure you want to delete this ${roleName} (ID: ${id})?\n\nThis action cannot be undone.`
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                "http://127.0.0.1:3000/api/admin/staff",
                {
                    method: "DELETE",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify({
                        role,
                        id
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || `Could not delete ${roleName}.`
                );
            }

            staffMessage.textContent =
                result.message || `${roleName} deleted successfully!`;

            // Refresh the appropriate table.
            if (role === "doctor") {
                await loadDoctors();
            } else if (role === "nurse") {
                await loadNurses();
            } else if (role === "receptionist") {
                await loadReceptionists();
            }

        } catch (error) {
            console.error(`Error deleting ${roleName}:`, error);

            staffMessage.textContent =
                error.message || "Could not connect to server.";
        }
    }


    // ==========================================
    // LOAD DOCTORS
    // ==========================================

    async function loadDoctors() {
        const tableBody = document.getElementById("doctorsTable");

        if (!tableBody) return;

        try {
            const response = await fetch(
                "http://127.0.0.1:3000/api/admin/loadDoctors",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch doctors: ${response.status}`
                );
            }

            const doctors = await response.json();

            tableBody.replaceChildren();

            if (doctors.length === 0) {
                displayTableMessage(
                    tableBody,
                    "No doctors found.",
                    5
                );
                return;
            }

            doctors.forEach(doctor => {
                const row = tableBody.insertRow();

                row.insertCell().textContent =
                    `${doctor.firstName} ${doctor.lastName}`;

                row.insertCell().textContent = doctor.id;

                row.insertCell().textContent =
                    doctor.specialtyId ?? "—";

                row.insertCell().textContent =
                    doctor.startDate ?? "N/A";

                const actionsCell = row.insertCell();

                actionsCell.appendChild(
                    createDeleteButton("doctor", doctor.id)
                );
            });

        } catch (error) {
            console.error("Error loading doctors:", error);

            displayTableMessage(
                tableBody,
                "Could not load doctors.",
                5
            );
        }
    }


    // ==========================================
    // LOAD NURSES
    // ==========================================

    async function loadNurses() {
        const tableBody = document.getElementById("nursesTable");

        if (!tableBody) return;

        try {
            const response = await fetch(
                "http://127.0.0.1:3000/api/admin/loadNurses",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to load nurses: ${response.status}`
                );
            }

            const nurses = await response.json();

            tableBody.replaceChildren();

            if (nurses.length === 0) {
                displayTableMessage(
                    tableBody,
                    "No nurses found.",
                    6
                );
                return;
            }

            nurses.forEach(nurse => {
                const row = tableBody.insertRow();

                row.insertCell().textContent =
                    `${nurse.firstName} ${nurse.lastName}`;

                row.insertCell().textContent = nurse.id;

                row.insertCell().textContent = "None";

                row.insertCell().textContent =
                    nurse.officeId ?? "—";

                row.insertCell().textContent =
                    nurse.startDate ?? "N/A";

                const actionsCell = row.insertCell();

                actionsCell.appendChild(
                    createDeleteButton("nurse", nurse.id)
                );
            });

        } catch (error) {
            console.error("Error loading nurses:", error);

            displayTableMessage(
                tableBody,
                "Could not load nurses.",
                6
            );
        }
    }


    // ==========================================
    // LOAD RECEPTIONISTS
    // ==========================================

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
                throw new Error(
                    `Failed to fetch receptionists: ${response.status}`
                );
            }

            const receptionists = await response.json();

            tableBody.replaceChildren();

            if (receptionists.length === 0) {
                displayTableMessage(
                    tableBody,
                    "No receptionists found.",
                    5
                );
                return;
            }

            receptionists.forEach(receptionist => {
                const row = tableBody.insertRow();

                row.insertCell().textContent =
                    `${receptionist.firstName} ${receptionist.lastName}`;

                row.insertCell().textContent = receptionist.id;

                row.insertCell().textContent =
                    receptionist.officeId ?? "—";

                row.insertCell().textContent =
                    receptionist.startDate ?? "N/A";

                const actionsCell = row.insertCell();

                actionsCell.appendChild(
                    createDeleteButton(
                        "receptionist",
                        receptionist.id
                    )
                );
            });

        } catch (error) {
            console.error("Error loading receptionists:", error);

            displayTableMessage(
                tableBody,
                "Could not load receptionists.",
                5
            );
        }
    }


    // ==========================================
    // INITIAL TABLE LOADING
    // ==========================================

    loadDoctors();
    loadNurses();
    loadReceptionists();

});
