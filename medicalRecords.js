
const tabButtons = document.querySelectorAll(".tabBtn");
const recordTitle = document.getElementById("recordTitle");
const recordContent = document.getElementById("recordContent");

let medicalRecords = null;
let activeTab = "medicalHistory";

const tabSettings = {
    medicalHistory: {
        title: "Medical History",
        fields: [
            ["Family Member", "Family_Member_Name"],
            ["Relationship", "Relationship"],
            ["Condition", "Condition"],
            ["Date", "Date"],
            ["Notes", "Notes"]
        ]
    },

    allergies: {
        title: "Allergies",
        fields: [
            ["Allergy", "Allergy_Name"],
            ["Time Occurred", "Time_Occurred"],
            ["Notes", "Notes"]
        ]
    },

    diagnoses: {
        title: "Diagnoses",
        fields: [
            ["Diagnosis", "Diagnosis_Name"],
            ["Description", "Diagnosis_Description"],
            ["Date", "Diagnosis_Date"],
            ["Doctor ID", "DOCTOR_Doctor_ID"]
        ]
    },

    treatments: {
        title: "Treatments",
        fields: [
            ["Treatment", "Treatment_Name"],
            ["Description", "Treatment_Description"],
            ["Status", "Treatment_Status"],
            ["Doctor ID", "DOCTOR_Doctor_ID"]
        ]
    },

    prescriptions: {
        title: "Prescriptions",
        fields: [
            ["Medication", "Medication_Name"],
            ["Dosage", "Dosage_Value"],
            ["Unit", "Dosage_Measurement"],
            ["Description", "Description"],
            ["Doctor ID", "DOCTOR_Doctor_ID"]
        ]
    },

    referrals: {
        title: "Referrals",
        fields: [
            ["Primary Doctor ID", "Primary_Doctor_ID"],
            ["Specialist Doctor ID", "Specialist_Doctor_ID"],
            ["Reason", "Reason"],
            ["Referral Date", "Referral_Date"],
            ["Approval Date", "Approval_Date"],
            ["Status", "Status"]
        ]
    }
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

function displayMedicalRecords(tabName) {
    activeTab = tabName;

    const settings = tabSettings[tabName];
    recordTitle.textContent = settings.title;

    tabButtons.forEach(button => {
        const selected = button.dataset.tab === tabName;

        button.classList.toggle("activeTab", selected);
        button.setAttribute("aria-pressed", String(selected));
    });

    recordContent.replaceChildren();

    if (!medicalRecords) {
        const message = document.createElement("p");
        message.textContent = "Loading medical records...";
        recordContent.appendChild(message);
        return;
    }

    const records = medicalRecords[tabName] || [];

    if (records.length === 0) {
        const message = document.createElement("p");
        message.textContent =
            `No ${settings.title.toLowerCase()} records to display yet.`;

        recordContent.appendChild(message);
        return;
    }

    records.forEach(record => {
        const card = document.createElement("div");
        card.className = "medicalRecordItem";

        settings.fields.forEach(([label, field]) => {
            const line = document.createElement("p");

            const strong = document.createElement("strong");
            strong.textContent = `${label}: `;

            const value = document.createElement("span");
            value.textContent = formatValue(record[field]);

            line.appendChild(strong);
            line.appendChild(value);
            card.appendChild(line);
        });

        recordContent.appendChild(card);
    });
}

async function loadMedicalRecords() {
    try {
        const response = await fetch(
            "/api/patient/medical-records",
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Could not load medical records");
        }

        medicalRecords = await response.json();

        displayMedicalRecords(activeTab);

    } catch (error) {
        console.error("Medical records error:", error);

        recordContent.replaceChildren();

        const message = document.createElement("p");
        message.textContent =
            "Could not load medical records. Please try again.";

        recordContent.appendChild(message);
    }
}

tabButtons.forEach(button => {
    button.addEventListener("click", () => {
        displayMedicalRecords(button.dataset.tab);
    });
});

loadMedicalRecords();

