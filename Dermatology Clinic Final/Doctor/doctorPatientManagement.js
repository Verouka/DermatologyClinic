(function () {
const API_BASE = "http://127.0.0.1:3000";

function initializePatientManagement() {
    const newButton = document.getElementById("createPatientBtn");
    const editButton = document.getElementById("editPatientBtn");
    const section = document.getElementById("patientManagementSection");
    const form = document.getElementById("patientManagementForm");
    const heading = document.getElementById("patientManagementHeading");
    const message = document.getElementById("patientManagementMessage");
    const cancelButton = document.getElementById("cancelPatientManagementBtn");
    const assignedBody = document.getElementById("assignedPatientRows");

    if (!newButton || !editButton || !section || !form || !heading || !message ||
        !cancelButton || !assignedBody) {
        console.error("Patient management form elements are missing.");
        return;
    }

    const fields = [
        "First_Name", "Middle_Name", "Last_Name", "Email", "BirthDate",
        "Gender", "Phone", "Street", "City", "State", "Zip_Code"
    ];
    let selectedPatientId = null;
    let editingPatientId = null;
    let loadingVersion = 0;

    function status(text, isError = false) {
        message.textContent = text;
        message.style.color = isError ? "#a11" : "#246a50";
    }

    function fillForm(patient = {}) {
        for (const field of fields) {
            const input = form.elements.namedItem(field);
            if (!input) continue;
            let value = patient[field] ?? "";
            if (field === "BirthDate" && value) value = String(value).slice(0, 10);
            input.value = value;
        }
    }

    function selectPatient(event) {
        const row = event.target.closest("tr[data-patient-id], tr");
        if (!row || !assignedBody.contains(row)) return;
        const raw = row.dataset.patientId || row.cells[0]?.textContent.trim();
        const id = Number(raw);
        if (!Number.isSafeInteger(id) || id <= 0) return;
        selectedPatientId = id;
        editButton.disabled = false;
        editButton.textContent = `Edit Patient #${id}`;
    }

    assignedBody.addEventListener("click", selectPatient);
    assignedBody.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") selectPatient(event);
    });

    function openForm() {
        section.hidden = false;
        section.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function closeForm() {
        loadingVersion++;
        editingPatientId = null;
        form.reset();
        section.hidden = true;
        status("");
    }

    newButton.addEventListener("click", () => {
        loadingVersion++;
        editingPatientId = null;
        heading.textContent = "Add New Patient";
        fillForm();
        status("");
        openForm();
    });

    editButton.addEventListener("click", async () => {
        if (!selectedPatientId) return;
        const id = selectedPatientId;
        const version = ++loadingVersion;
        editingPatientId = null;
        heading.textContent = `Edit Patient #${id}`;
        form.reset();
        status("Loading patient information...");
        openForm();
        try {
            const response = await fetch(
                `${API_BASE}/api/doctor/patients/${id}`,
                { method: "GET", credentials: "include" }
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
            if (version !== loadingVersion) return;
            editingPatientId = id;
            fillForm(data);
            status("");
        } catch (error) {
            if (version !== loadingVersion) return;
            console.error("Could not load patient:", error);
            status(error.message, true);
        }
    });

    cancelButton.addEventListener("click", closeForm);

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const submit = form.querySelector('button[type="submit"]');
        const patient = {};
        for (const field of fields) {
            patient[field] = form.elements.namedItem(field).value.trim();
        }
        const editing = editingPatientId !== null;
        const url = editing
            ? `${API_BASE}/api/doctor/patients/${editingPatientId}`
            : `${API_BASE}/api/doctor/patients`;
        submit.disabled = true;
        status(editing ? "Saving patient changes..." : "Creating patient...");
        try {
            const response = await fetch(url, {
                method: editing ? "PATCH" : "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patient)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
            status(editing ? "Patient information saved." : `Patient #${result.patientId} created and assigned to you.`);
            if (!editing) {
                selectedPatientId = result.patientId;
                editButton.disabled = false;
                editButton.textContent = `Edit Patient #${selectedPatientId}`;
                editingPatientId = result.patientId;
            }
            if (typeof window.loadDoctorPatients === "function") {
                await window.loadDoctorPatients();
            } else {
                console.warn("Reload the page to see updated assigned patients.");
            }
        } catch (error) {
            console.error("Could not save patient:", error);
            status(error.message, true);
        } finally {
            submit.disabled = false;
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePatientManagement);
} else {
    initializePatientManagement();
}
})();
