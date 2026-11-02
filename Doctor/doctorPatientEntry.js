
const API_BASE = "";

const entryTypes = {
    medicalHistory: [
        ["Family member", "Family_Member_Name", "text", 45],
        ["Relationship", "Relationship", "text", 45],
        ["Condition", "Condition", "text", 100, true],
        ["Date", "Date", "date"],
        ["Notes", "Notes", "textarea", 250]
    ],
    allergies: [
        ["Allergy", "Allergy_Name", "text", 100, true],
        ["Time occurred", "Time_Occurred", "datetime-local"],
        ["Notes", "Notes", "textarea", 250]
    ],
    diagnoses: [
        ["Diagnosis", "Diagnosis_Name", "text", 100, true],
        ["Description", "Diagnosis_Description", "textarea", 250],
        ["Diagnosis date", "Diagnosis_Date", "date", null, true],
        ["Appointment", "APPOINTMENT_Appointment_ID", "appointment", null, true]
    ],
    treatments: [
        ["Treatment", "Treatment_Name", "text", 100, true],
        ["Description", "Treatment_Description", "textarea", 250],
        ["Status", "Treatment_Status", "text", 45, true]
    ],
    previousTreatments: [
        ["Condition", "Condition", "text", 100],
        ["Treatment", "Treatment_Name", "text", 100, true],
        ["Treatment date", "Treatment_Date", "date", null, true],
        ["Notes", "Notes", "textarea", 250]
    ],
    prescriptions: [
        ["Medication", "Medication_Name", "text", 45, true],
        ["Dosage value", "Dosage_Value", "number", null, true],
        ["Dosage unit", "Dosage_Measurement", "text", 45, true],
        ["Description", "Description", "textarea", 250]
    ]
};

function initializeDoctorPatientEntry() {
    const assignedBody = document.getElementById("assignedPatientRows");
    const addPatientInfoBtn = document.getElementById("addPatientInfoBtn");
    const section = document.getElementById("newPatientRecord");
    const form = document.getElementById("newPatientRecordForm");
    const recordType = document.getElementById("newRecordType");
    const fieldsContainer = document.getElementById("newPatientRecordFields");
    const patientLabel = document.getElementById("newRecordPatient");
    const message = document.getElementById("newPatientRecordMessage");

    if (!assignedBody || !section || !form || !recordType ||
        !fieldsContainer || !patientLabel || !message) {
        console.error("Add Medical Record form is missing from doctorPatients.html");
        return;
    }

    let patientId = null;
    let patientName = "";
    let appointmentLoadVersion = 0;

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.style.color = isError ? "#ba1c1c" : "#246a50";
    }

    async function loadAppointments(select, selectedId) {
        const version = ++appointmentLoadVersion;

        select.replaceChildren(
            new Option("Loading appointments...", "")
        );

        try {
            const response = await fetch(
                `${API_BASE}/api/doctor/patients/${selectedId}/appointments`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const appointments = await response.json();

            if (!Array.isArray(appointments)) {
                throw new Error("Invalid appointment data");
            }

            if (
                version !== appointmentLoadVersion ||
                selectedId !== patientId
            ) {
                return;
            }

            select.replaceChildren(
                new Option("Select an appointment", "")
            );

            for (const appointment of appointments) {
                const date = String(
                    appointment.Appointment_Date || ""
                ).slice(0, 10);

                const time = String(
                    appointment.Appointment_Time || ""
                ).slice(0, 5);

                select.appendChild(
                    new Option(
                        `#${appointment.Appointment_ID} - ${date} ${time}`,
                        String(appointment.Appointment_ID)
                    )
                );
            }

            if (appointments.length === 0) {
                showMessage(
                    "A diagnosis requires an existing appointment for this patient and doctor.",
                    true
                );
            }

        } catch (error) {
            console.error(
                "Could not load patient appointments:",
                error
            );

            select.replaceChildren(
                new Option("Could not load appointments", "")
            );

            showMessage(
                "Could not load appointment options.",
                true
            );
        }
    }

    function renderFields() {
        appointmentLoadVersion++;
        fieldsContainer.replaceChildren();
        showMessage("");

        const definition = entryTypes[recordType.value];

        if (!definition || !patientId) return;

        for (const [labelText, name, type, max, required] of definition) {
            const wrapper = document.createElement("div");
            wrapper.style.marginBottom = "12px";

            const label = document.createElement("label");
            label.htmlFor = `entry_${name}`;
            label.textContent = labelText;
            label.style.display = "block";
            label.style.marginBottom = "4px";

            const field =
                type === "textarea"
                    ? document.createElement("textarea")
                    : type === "appointment"
                        ? document.createElement("select")
                        : document.createElement("input");

            field.id = `entry_${name}`;
            field.name = name;

            if (type !== "textarea" && type !== "appointment") {
                field.type = type;
            }

            if (max) {
                field.maxLength = max;
            }

            field.required = Boolean(required);
            field.style.width = "100%";
            field.style.maxWidth = "500px";
            field.style.padding = "8px";
            field.style.boxSizing = "border-box";

            if (type === "number") {
                field.step = "0.01";
                field.min = "0.01";
                field.max = "99999999.99";
            }

            wrapper.append(label, field);
            fieldsContainer.appendChild(wrapper);

            if (type === "appointment") {
                loadAppointments(field, patientId);
            }
        }
    }

    function selectPatientFromRow(row) {
        if (
            !row ||
            !assignedBody.contains(row) ||
            row.cells.length < 2
        ) {
            return;
        }

        const id = Number(
            row.dataset.patientId ||
            row.cells[0].textContent.trim()
        );

        if (!Number.isSafeInteger(id) || id <= 0) {
            return;
        }

        patientId = id;
        patientName = row.cells[1].textContent.trim();

        patientLabel.textContent =
            `Adding a record for ${patientName} (Patient ID: ${patientId})`;

        renderFields();
    }

    addPatientInfoBtn.addEventListener("click", () => {
        if (!patientId) {
            alert("Please select an assigned patient first.");
            return;
        }

        section.hidden = !section.hidden;

        if (!section.hidden) {
            section.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });

    assignedBody.addEventListener("click", event => {
        selectPatientFromRow(
            event.target.closest("tr")
        );
    });

    assignedBody.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            selectPatientFromRow(
                event.target.closest("tr")
            );
        }
    });

    recordType.addEventListener("change", renderFields);

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!patientId) {
            return showMessage(
                "Select a patient first.",
                true
            );
        }

        if (!form.reportValidity()) {
            return;
        }

        const recordTypeName = recordType.value;
        const fields = {};

        for (const [, name, type] of entryTypes[recordTypeName] || []) {
            const field = fieldsContainer.querySelector(
                `[name="${name}"]`
            );

            if (!field) continue;

            fields[name] =
                type === "appointment"
                    ? Number(field.value)
                    : field.value.trim();
        }

        const submit = form.querySelector(
            'button[type="submit"]'
        );

        submit.disabled = true;
        showMessage("Saving medical record...");

        try {
            const response = await fetch(
                `${API_BASE}/api/doctor/patients/${patientId}/records`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        type: recordTypeName,
                        fields
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || `HTTP ${response.status}`
                );
            }

            const type = recordType.value;

            renderFields();
            recordType.value = type;

            showMessage(
                "Medical record saved to the database."
            );

            if (typeof window.loadPatientRecords === "function") {
                await window.loadPatientRecords(
                    patientId,
                    patientName
                );

            } else if (typeof window.selectPatient === "function") {
                await window.selectPatient(patientId);
            }

        } catch (error) {
            console.error(
                "Could not save patient record:",
                error
            );

            showMessage(error.message, true);

        } finally {
            submit.disabled = false;
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeDoctorPatientEntry
    );
} else {
    initializeDoctorPatientEntry();
}
