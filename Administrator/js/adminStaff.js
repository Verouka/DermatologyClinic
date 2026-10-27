

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
