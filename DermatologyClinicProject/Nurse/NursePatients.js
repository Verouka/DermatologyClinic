const API_BASE = "http://127.0.0.1:3000/api/nurse/patients";

const patientSelect = document.getElementById("patientSelect");
const intakeMessage = document.getElementById("intakeMessage");

const allergiesBody = document.getElementById("allergyTableBody");
const historyBody = document.getElementById("historyTableBody");
const treatmentsBody = document.getElementById("treatmentTableBody");
const doctorRecordsBody = document.getElementById("doctorRecordsBody");

// DISPLAY MESSAGES
function showMessage(message) {
    intakeMessage.textContent = message;
}

// DISPLAY EMPTY TABLE ROW
function showEmptyRow(body, columns, message) {
    body.replaceChildren();

    const row = body.insertRow();
    const cell = row.insertCell();

    cell.colSpan = columns;
    cell.textContent = message;
}

// ADD TABLE CELL
function addCell(row, value) {
    const cell = row.insertCell();

    cell.textContent =
        value === null || value === undefined
            ? ""
            : String(value);

    return cell;
}

// FORMAT DATE
function formatDate(value) {
    if (!value) {
        return "";
    }

    return String(value).slice(0, 10);
}

// FORMAT DATE AND TIME
function formatDateTime(value) {
    if (!value) {
        return "";
    }

    return String(value)
        .replace("T", " ")
        .slice(0, 19);
}

// API REQUEST
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "include",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        throw new Error(
            data.error || "Request failed."
        );
    }

    return data;
}

// CLEAR ALL TABLES
function emptyAllTables(message) {
    showEmptyRow(allergiesBody, 5, message);
    showEmptyRow(historyBody, 6, message);
    showEmptyRow(treatmentsBody, 5, message);
    showEmptyRow(doctorRecordsBody, 5, message);
}

// LOAD PATIENTS FROM DATABASE

async function loadPatients() {
    showMessage("Loading patients...");

    try {
        const patients = await apiRequest(API_BASE);

        patientSelect.replaceChildren();

        if (!patients.length) {
            patientSelect.add(
                new Option("No patients available", "")
            );

            emptyAllTables("No patients available.");
            showMessage("");
            return;
        }

        patients.forEach(patient => {
            const fullName = [
                patient.First_Name,
                patient.Middle_Name,
                patient.Last_Name
            ]
                .filter(Boolean)
                .join(" ");

            const dateOfBirth =
                formatDate(patient.BirthDate) || "N/A";

            const label =
                `${fullName} - ID: ${patient.Patient_ID} ` +
                `(DOB: ${dateOfBirth})`;

            patientSelect.add(
                new Option(label, patient.Patient_ID)
            );
        });

        // SELECT PATIENT SENT FROM NURSE APPOINTMENTS
        const params = new URLSearchParams(
            window.location.search
        );

        const requestedPatientId = params.get("patientId");

        if (requestedPatientId) {
            const patientExists = Array.from(
                patientSelect.options
            ).some(
                option => option.value === requestedPatientId
            );

            if (patientExists) {
                patientSelect.value = requestedPatientId;
            } else {
                showMessage(
                    "The selected patient was not found."
                );
            }
        }

        await loadPatientRecords();

    } catch (error) {
        console.error("Patient loading error:", error);

        patientSelect.replaceChildren(
            new Option("Could not load patients", "")
        );

        emptyAllTables("Unable to load records.");

        showMessage(error.message);
    }
}

// LOAD SELECTED PATIENT RECORDS

async function loadPatientRecords() {
    const patientId = patientSelect.value;

    if (!patientId) {
        emptyAllTables("Select a patient.");
        return;
    }

    showMessage("Loading patient records...");

    try {
        const url =
            `${API_BASE}/${encodeURIComponent(patientId)}/intake`;

        const data = await apiRequest(url);

        displayAllergies(
            patientId,
            data.allergies || []
        );

        displayHistory(
            data.history || []
        );

        displayTreatments(
            data.treatments || []
        );

        displayDoctorRecords(
            data.diagnoses || [],
            data.prescriptions || []
        );

        showMessage("");

    } catch (error) {
        console.error("Patient records error:", error);

        emptyAllTables("Unable to load records.");

        showMessage(error.message);
    }
}

// DISPLAY ALLERGIES

function displayAllergies(patientId, allergies) {
    allergiesBody.replaceChildren();

    if (!allergies.length) {
        showEmptyRow(
            allergiesBody,
            5,
            "No allergies recorded."
        );
        return;
    }

    allergies.forEach(allergy => {
        const row = allergiesBody.insertRow();

        addCell(row, allergy.Allergy_ID);
        addCell(row, allergy.Allergy_Name);

        addCell(
            row,
            formatDateTime(allergy.Time_Occurred)
        );

        addCell(row, allergy.Notes);

        const actionCell = row.insertCell();

        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.className = "intake-button";
        editButton.textContent = "Edit";

        editButton.addEventListener("click", () => {
            editAllergy(patientId, allergy);
        });

        actionCell.appendChild(editButton);
    });
}

// DISPLAY FAMILY MEDICAL HISTORY
function displayHistory(historyRecords) {
    historyBody.replaceChildren();

    if (!historyRecords.length) {
        showEmptyRow(
            historyBody,
            6,
            "No family medical history recorded."
        );
        return;
    }

    historyRecords.forEach(history => {
        const row = historyBody.insertRow();

        addCell(row, history.Medical_History_ID);
        addCell(row, history.Family_Member_Name);
        addCell(row, history.Relationship);
        addCell(row, history.Condition);
        addCell(row, formatDate(history.Date));
        addCell(row, history.Notes);
    });
}

// DISPLAY PREVIOUS TREATMENTS
function displayTreatments(treatments) {
    treatmentsBody.replaceChildren();

    if (!treatments.length) {
        showEmptyRow(
            treatmentsBody,
            5,
            "No previous treatments recorded."
        );
        return;
    }

    treatments.forEach(treatment => {
        const row = treatmentsBody.insertRow();

        addCell(row, treatment.Previous_Treatment_ID);
        addCell(row, treatment.Condition);
        addCell(row, treatment.Treatment_Name);

        addCell(
            row,
            formatDate(treatment.Treatment_Date)
        );

        addCell(row, treatment.Notes);
    });
}

// DISPLAY DOCTOR RECORDS (READ ONLY)
function displayDoctorRecords(diagnoses, prescriptions) {
    doctorRecordsBody.replaceChildren();

    if (!diagnoses.length && !prescriptions.length) {
        showEmptyRow(
            doctorRecordsBody,
            5,
            "No doctor records available."
        );
        return;
    }

    // DIAGNOSES
    diagnoses.forEach(diagnosis => {
        const row = doctorRecordsBody.insertRow();

        addCell(row, "Diagnosis");
        addCell(row, diagnosis.Diagnosis_Name);

        addCell(
            row,
            diagnosis.Diagnosis_Description
        );

        addCell(
            row,
            formatDate(diagnosis.Diagnosis_Date)
        );

        addCell(row, diagnosis.DOCTOR_Doctor_ID);
    });

    // PRESCRIPTIONS
    prescriptions.forEach(prescription => {
        const row = doctorRecordsBody.insertRow();

        addCell(row, "Prescription");
        addCell(row, prescription.Medication_Name);

        const dosage = [
            prescription.Dosage_Value,
            prescription.Dosage_Measurement
        ]
            .filter(
                value => value !== null &&
                         value !== undefined &&
                         value !== ""
            )
            .join(" ");

        const details = [
            dosage,
            prescription.Description
        ]
            .filter(Boolean)
            .join(" - ");

        addCell(row, details);

        // NO PRESCRIPTION DATE IN DATABASE
        addCell(row, "Not recorded");

        addCell(
            row,
            prescription.DOCTOR_Doctor_ID
        );
    });
}

// EDIT EXISTING ALLERGY

async function editAllergy(patientId, allergy) {
    const name = prompt(
        "Allergy name:",
        allergy.Allergy_Name || ""
    );

    if (name === null) {
        return;
    }

    if (!name.trim()) {
        showMessage(
            "Allergy name cannot be empty."
        );
        return;
    }

    const currentTime = allergy.Time_Occurred
        ? String(allergy.Time_Occurred)
            .replace(" ", "T")
            .slice(0, 16)
        : "";

    const occurred = prompt(
        "Time occurred (YYYY-MM-DDTHH:mm), or leave blank:",
        currentTime
    );

    if (occurred === null) {
        return;
    }

    const notes = prompt(
        "Notes:",
        allergy.Notes || ""
    );

    if (notes === null) {
        return;
    }

    try {
        const url =
            `${API_BASE}/${patientId}/allergies/${allergy.Allergy_ID}`;

        await apiRequest(url, {
            method: "PATCH",
            body: JSON.stringify({
                Allergy_Name: name.trim(),
                Time_Occurred: occurred || null,
                Notes: notes
            })
        });

        await loadPatientRecords();

        showMessage(
            "Allergy updated successfully."
        );

    } catch (error) {
        console.error(
            "Allergy update error:",
            error
        );

        showMessage(error.message);
    }
}

// HANDLE ADD RECORD FORMS

function setupForm(formId, endpoint, fields) {
    const form = document.getElementById(formId);

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const patientId = patientSelect.value;

        if (!patientId) {
            showMessage(
                "Please select a patient first."
            );
            return;
        }

        const record = {};

        fields.forEach(field => {
            const input = form.elements.namedItem(field);

            record[field] =
                input.value.trim() || null;
        });

        const button = form.querySelector(
            'button[type="submit"]'
        );

        button.disabled = true;

        showMessage("Saving record...");

        try {
            const url =
                `${API_BASE}/${encodeURIComponent(patientId)}/${endpoint}`;

            await apiRequest(url, {
                method: "POST",
                body: JSON.stringify(record)
            });

            form.reset();

            await loadPatientRecords();

            showMessage(
                "Record saved successfully."
            );

        } catch (error) {
            console.error(
                "Save record error:",
                error
            );

            showMessage(error.message);

        } finally {
            button.disabled = false;
        }
    });
}

// PATIENT SELECTION
patientSelect.addEventListener(
    "change",
    loadPatientRecords
);

// ADD ALLERGY
setupForm(
    "addAllergyForm",
    "allergies",
    [
        "Allergy_Name",
        "Time_Occurred",
        "Notes"
    ]
);

// ADD FAMILY MEDICAL HISTORY
setupForm(
    "addHistoryForm",
    "history",
    [
        "Family_Member_Name",
        "Relationship",
        "Condition",
        "Date",
        "Notes"
    ]
);

// ADD PREVIOUS TREATMENT
setupForm(
    "addTreatmentForm",
    "treatments",
    [
        "Condition",
        "Treatment_Name",
        "Treatment_Date",
        "Notes"
    ]
);

// INITIAL LOAD
loadPatients();