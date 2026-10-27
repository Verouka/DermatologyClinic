 
const API_BASE = "http://127.0.0.1:3000";
 
let selectedPatientId = null;
let recordsRequestId = 0;
 
const recordFields = {
    medicalHistory: [
        "Medical_History_ID",
        "Family_Member_Name",
        "Relationship",
        "Condition",
        "Date",
        "Notes"
    ],
 
    allergies: [
        "Allergy_ID",
        "Allergy_Name",
        "Time_Occurred",
        "Notes"
    ],
 
    diagnoses: [
        "Diagnosis_ID",
        "Diagnosis_Name",
        "Diagnosis_Description",
        "Diagnosis_Date",
        "DOCTOR_Doctor_ID",
        "APPOINTMENT_Appointment_ID"
    ],
 
    treatments: [
        "Treatment_ID",
        "Treatment_Name",
        "Treatment_Description",
        "Treatment_Status",
        "DOCTOR_Doctor_ID"
    ],
 
    previousTreatments: [
        "Previous_Treatment_ID",
        "Condition",
        "Treatment_Name",
        "Treatment_Date",
        "Notes"
    ],
 
    prescriptions: [
        "Prescription_ID",
        "Medication_Name",
        "Dosage_Value",
        "Dosage_Measurement",
        "Description",
        "DOCTOR_Doctor_ID"
    ],
 
    referrals: [
        "Referral_ID",
        "Primary_Doctor_ID",
        "Specialist_Doctor_ID",
        "Reason",
        "Referral_Date",
        "Approval_Date",
        "Status"
    ]
};
 
function formatValue(value) {
    if (value === null || value === undefined || value === "") {
        return "Not provided";
    }
 
    if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T/.test(value)
    ) {
        return value.slice(0, 10);
    }
 
    return String(value);
}
 
function addCell(row, value) {
    const cell = row.insertCell();
    cell.textContent = formatValue(value);
    return cell;
}
 
function displayTable(tbody, records, fields, message) {
    if (!tbody) return;
 
    tbody.replaceChildren();
 
    if (!Array.isArray(records) || records.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
 
        cell.colSpan = fields.length;
        cell.textContent = message;
        cell.className = "empty";
        return;
    }
 
    records.forEach(record => {
        const row = tbody.insertRow();
 
        fields.forEach(field => {
            addCell(row, record[field]);
        });
    });
}
 
function getRecordTables() {
    const treatmentBodies = document.querySelectorAll(
        "#treatments tbody"
    );
 
    return {
        medicalHistory: document.querySelector(
            "#medical-history tbody"
        ),
 
        allergies: document.querySelector(
            "#allergies tbody"
        ),
 
        diagnoses: document.querySelector(
            "#diagnoses tbody"
        ),
 
        treatments: treatmentBodies[0],
 
        previousTreatments: treatmentBodies[1],
 
        prescriptions: document.querySelector(
            "#prescriptions tbody"
        ),
 
        referrals: document.querySelector(
            "#patient-referrals tbody"
        )
    };
}
 
function showRecordMessage(message) {
    const tables = getRecordTables();
 
    Object.keys(recordFields).forEach(section => {
        displayTable(
            tables[section],
            [],
            recordFields[section],
            message
        );
    });
}
 
function displayMedicalRecords(records) {
    const tables = getRecordTables();
 
    Object.keys(recordFields).forEach(section => {
        displayTable(
            tables[section],
            records[section] || [],
            recordFields[section],
            `No ${section} records found.`
        );
    });
}
 
async function loadPatientRecords(patientId, patientName) {
    selectedPatientId = patientId;
    const requestId = ++recordsRequestId;
 
    const description = document.querySelector(
        "#medical-records .title p"
    );
 
    if (description) {
        description.textContent =
            `Medical records for ${patientName}`;
    }
 
    showRecordMessage("Loading medical records...");
 
    try {
        const response = await fetch(
            `${API_BASE}/api/doctor/patients/${patientId}/records`,
            {
                method: "GET",
                credentials: "include"
            }
        );
 
        if (!response.ok) {
            throw new Error(
                `Could not load records (HTTP ${response.status})`
            );
        }
 
        const records = await response.json();
 
        if (requestId !== recordsRequestId) return;
 
        displayMedicalRecords(records);
 
    } catch (error) {
        if (requestId !== recordsRequestId) return;
 
        console.error(
            "Medical records loading error:",
            error
        );
 
        showRecordMessage(
            "Could not load medical records."
        );
    }
}
 
function displayAssignedPatients(patients) {
    const tbody = document.getElementById(
        "assignedPatientRows"
    );
 
    if (!tbody) return;
 
    tbody.replaceChildren();
 
    if (patients.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
 
        cell.colSpan = 5;
        cell.textContent = "No assigned patients found.";
        cell.className = "empty";
        return;
    }
 
    patients.forEach(patient => {
        const row = tbody.insertRow();
 
        const patientName = [
            patient.First_Name,
            patient.Middle_Name,
            patient.Last_Name
        ].filter(Boolean).join(" ");
 
        addCell(row, patient.Patient_ID);
 
        const nameCell = row.insertCell();
        const selectButton = document.createElement("button");
 
        selectButton.type = "button";
        selectButton.textContent =
            patientName || "View patient";
 
        selectButton.className = "tabBtn";
 
        selectButton.addEventListener("click", () => {
            loadPatientRecords(
                patient.Patient_ID,
                patientName || `Patient ${patient.Patient_ID}`
            );
 
            const section = document.getElementById(
                "medical-records"
            );
 
            if (section) {
                section.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        });
 
        nameCell.appendChild(selectButton);
 
        addCell(row, patient.Reason_For_Visit);
        addCell(row, patient.Diagnosis);
        addCell(row, patient.Recommended_Treatment);
    });
}
 
async function loadDoctorPatients() {
    const tbody = document.getElementById(
        "assignedPatientRows"
    );
 
    if (!tbody) {
        console.error("Assigned patient table not found.");
        return;
    }
 
    showRecordMessage("Select an assigned patient.");
 
    try {
        const response = await fetch(
            `${API_BASE}/api/doctor/patients`,
            {
                method: "GET",
                credentials: "include"
            }
        );
 
        if (!response.ok) {
            throw new Error(
                `Could not load patients (HTTP ${response.status})`
            );
        }
 
        const patients = await response.json();
 
        if (!Array.isArray(patients)) {
            throw new Error("Invalid assigned patient data");
        }
 
        displayAssignedPatients(patients);
 
    } catch (error) {
        console.error(
            "Doctor patients loading error:",
            error
        );
 
        tbody.replaceChildren();
 
        const row = tbody.insertRow();
        const cell = row.insertCell();
 
        cell.colSpan = 5;
        cell.textContent = "Could not load assigned patients.";
        cell.className = "empty";
    }
}
 
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        loadDoctorPatients
    );
} else {
    loadDoctorPatients();
}
 