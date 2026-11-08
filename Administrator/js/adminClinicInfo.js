document.addEventListener("DOMContentLoaded", async () => {
    const officesTableBody = document.getElementById("officesTableBody");

    const officeHoursSection = document.getElementById("officeHoursSection");
    const officeHoursForm = document.getElementById("officeHoursForm");
    const officeHoursTitle = document.getElementById("officeHoursTitle");
    const editOfficeId = document.getElementById("editOfficeId");
    const openTimeInput = document.getElementById("openTime");
    const closeTimeInput = document.getElementById("closeTime");
    const officeHoursMessage = document.getElementById("officeHoursMessage");
    const clinicInfoMessage = document.getElementById("clinicInfoMessage");
    const cancelOfficeHoursBtn = document.getElementById("cancelOfficeHoursBtn");

    const API_URL = "http://127.0.0.1:3000/api/admin/clinic-info";

    let offices = [];

    function displayTableMessage(message) {
        officesTableBody.innerHTML = "";

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;
        cell.textContent = message;

        row.appendChild(cell);
        officesTableBody.appendChild(row);
    }

    function displayClinicMessage(message, isError = false) {
        if (!clinicInfoMessage) return;

        clinicInfoMessage.textContent = message;
        clinicInfoMessage.style.color = isError ? "#dc2626" : "#16a34a";
    }

    function displayHoursMessage(message, isError = false) {
        if (!officeHoursMessage) return;

        officeHoursMessage.textContent = message;
        officeHoursMessage.style.color = isError ? "#dc2626" : "#16a34a";
    }

    function normalizeTime(time) {
        if (!time) return "";

        // MySQL TIME values may be returned as HH:MM:SS.
        return String(time).substring(0, 5);
    }

    function getClosedDays(daysClosed) {
        if (!daysClosed) return [];

        if (Array.isArray(daysClosed)) {
            return daysClosed;
        }

        return String(daysClosed)
            .split(/[,;|]/)
            .map(day => day.trim())
            .filter(Boolean);
    }

    function getOfficeValue(office, camelCaseName, databaseName) {
        return office[camelCaseName] ?? office[databaseName] ?? "";
    }

    function closeHoursEditor() {
        officeHoursSection.hidden = true;
        officeHoursForm.reset();
        editOfficeId.value = "";
        displayHoursMessage("");
    }

    function openHoursEditor(office) {
        const officeId = getOfficeValue(office, "officeId", "Office_ID");
        const openTime = getOfficeValue(office, "openTime", "Open_Time");
        const closeTime = getOfficeValue(office, "closeTime", "Close_Time");
        const daysClosed = getOfficeValue(office, "daysClosed", "Days_Closed");

        editOfficeId.value = officeId;
        officeHoursTitle.textContent = `Edit Office ${officeId} Hours`;

        openTimeInput.value = normalizeTime(openTime);
        closeTimeInput.value = normalizeTime(closeTime);

        const closedDays = getClosedDays(daysClosed);

        document.querySelectorAll('input[name="closedDays"]').forEach(checkbox => {
            checkbox.checked = closedDays.some(
                day => day.toLowerCase() === checkbox.value.toLowerCase()
            );
        });

        displayHoursMessage("");
        officeHoursSection.hidden = false;

        officeHoursSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function renderOffices() {
        officesTableBody.innerHTML = "";

        offices.forEach(office => {
            const row = document.createElement("tr");

            const values = [
                getOfficeValue(office, "officeId", "Office_ID"),
                getOfficeValue(office, "phone", "Phone"),
                getOfficeValue(office, "street", "Street"),
                getOfficeValue(office, "city", "City"),
                getOfficeValue(office, "state", "State"),
                getOfficeValue(office, "zipCode", "Zip_Code")
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value || "—";
                row.appendChild(cell);
            });

            const actionCell = document.createElement("td");
            const editButton = document.createElement("button");

            editButton.type = "button";
            editButton.textContent = "Edit Hours";
            editButton.className = "edit-hours-btn";

            editButton.addEventListener("click", () => {
                openHoursEditor(office);
            });

            actionCell.appendChild(editButton);
            row.appendChild(actionCell);

            officesTableBody.appendChild(row);
        });
    }

    async function loadOffices() {
        try {
            displayClinicMessage("");

            const response = await fetch(API_URL, {
                method: "GET",
                credentials: "include",
                headers: {
                    Accept: "application/json"
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Failed to load clinic information."
                );
            }

            offices = result.offices;

            if (!Array.isArray(offices) || offices.length === 0) {
                displayTableMessage("No clinic offices found.");
                return;
            }

            renderOffices();

        } catch (error) {
            console.error("Error loading clinic information:", error);
            displayTableMessage("Unable to load clinic offices.");
        }
    }

    officeHoursForm.addEventListener("submit", async event => {
        event.preventDefault();

        const officeId = editOfficeId.value;
        const openTime = openTimeInput.value;
        const closeTime = closeTimeInput.value;

        const closedDays = Array.from(
            document.querySelectorAll('input[name="closedDays"]:checked')
        ).map(checkbox => checkbox.value);

        if (!officeId) {
            displayHoursMessage("No office selected.", true);
            return;
        }

        if (!openTime || !closeTime) {
            displayHoursMessage("Please enter both opening and closing times.", true);
            return;
        }

        if (openTime >= closeTime) {
            displayHoursMessage(
                "Closing time must be later than opening time.",
                true
            );
            return;
        }

        try {
            displayHoursMessage("Saving changes...");

            const response = await fetch(
                `${API_URL}/${encodeURIComponent(officeId)}`,
                {
                    method: "PATCH",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify({
                        openTime,
                        closeTime,
                        closedDays
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Failed to update office hours."
                );
            }

            closeHoursEditor();
            displayClinicMessage("Office hours updated successfully.");

            await loadOffices();

        } catch (error) {
            console.error("Error updating office hours:", error);
            displayHoursMessage(
                error.message || "Unable to update office hours.",
                true
            );
        }
    });

    cancelOfficeHoursBtn.addEventListener("click", closeHoursEditor);

    await loadOffices();
});