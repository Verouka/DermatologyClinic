
const appointmentForm = document.getElementById("appointmentForm");
const appointmentDateInput = document.getElementById("appointmentDate");
const formStatus = document.getElementById("formStatus");

function setMinimumDate() {
    const today = new Date();

    const localToday = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");

    appointmentDateInput.min = localToday;
}

setMinimumDate();

appointmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    setMinimumDate();

    if (!appointmentForm.reportValidity()) {
        return;
    }

    const formData = {
        firstName: document.getElementById("FirstName").value.trim(),
        lastName: document.getElementById("LastName").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        currentPatient: document.getElementById("currentPatient").value,
        appointmentDate: appointmentDateInput.value,
        reason: document.getElementById("reason").value.trim(),
        message: document.getElementById("message").value.trim()
    };

    const submitButton = appointmentForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    formStatus.textContent = "Submitting your request...";

    try {
        const response = await fetch(
            "/api/public/appointment-requests",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Could not submit appointment request."
            );
        }

        formStatus.textContent =
            "Your request was submitted successfully! " +
            "Our receptionist will contact you.";

        alert(
            "Appointment request submitted successfully! " +
            "Our receptionist will contact you."
        );

        appointmentForm.reset();
        setMinimumDate();

    } catch (error) {
        console.error("Appointment request error:", error);

        formStatus.textContent = error.message;
        alert(error.message);

    } finally {
        submitButton.disabled = false;
    }
});

