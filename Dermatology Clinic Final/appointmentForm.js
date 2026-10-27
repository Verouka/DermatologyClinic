
const officeSelect = document.getElementById("office");
const doctorSelect = document.getElementById("doctor");

let appointmentOptions = [];

async function loadAppointmentOptions() {
    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/patient/appointment-options",
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Could not load doctors and offices");
        }

        appointmentOptions = await response.json();

        const offices = new Map();

        appointmentOptions.forEach(item => {
            if (!offices.has(item.Office_ID)) {
                offices.set(item.Office_ID, item);
            }
        });

        offices.forEach(office => {
            const option = document.createElement("option");
            option.value = office.Office_ID;
            option.textContent =
                `${office.Street}, ${office.City}, ${office.State} ${office.Zip_Code}`;

            officeSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Appointment options error:", error);
        alert("Could not load available doctors and offices.");
    }
}

officeSelect.addEventListener("change", () => {
    doctorSelect.innerHTML =
        '<option value="">Select a doctor</option>';

    const selectedOffice = Number(officeSelect.value);

    doctorSelect.disabled = !selectedOffice;

    const doctors = appointmentOptions.filter(
        item => item.Office_ID === selectedOffice
    );

    doctors.forEach(doctor => {
        const option = document.createElement("option");
        option.value = doctor.Doctor_ID;
        option.textContent =
            `Dr. ${doctor.First_Name} ${doctor.Last_Name}`;

        doctorSelect.appendChild(option);
    });
});

loadAppointmentOptions();



async function loadPatientInformation() {
    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/patient/me",
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Could not load patient information");
        }

        const patient = await response.json();

        document.getElementById("FirstName").value =
            patient.First_Name || "";

        document.getElementById("LastName").value =
            patient.Last_Name || "";

        document.getElementById("email").value =
            patient.Email || "";

        document.getElementById("phone").value =
            patient.Phone || "";

    } catch (error) {
        console.error("Patient information error:", error);
        alert("Could not load your information. Please refresh the page.");
    }
}

loadPatientInformation();


const appointmentDateInput = document.getElementById("appointmentDate");

const today = new Date();
const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
].join("-");

appointmentDateInput.min = localToday;



const appointmentForm = document.getElementById("appointmentForm");

appointmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const officeId = Number(document.getElementById("office").value);
    const doctorId = Number(document.getElementById("doctor").value);
    const appointmentDate = document.getElementById("appointmentDate").value;
    const appointmentTime = document.getElementById("appointmentTime").value;
    const reason = document.getElementById("reason").value.trim();

    const submitButton = appointmentForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;

    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/patient/appointments",
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    officeId,
                    doctorId,
                    appointmentDate,
                    appointmentTime,
                    reason
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Could not submit appointment"
            );
        }

        alert("Appointment request submitted successfully!");

        window.location.href = "patientAppointment.html";

    } catch (error) {
        console.error("Appointment request error:", error);
        alert(error.message);

    } finally {
        submitButton.disabled = false;
    }
});
