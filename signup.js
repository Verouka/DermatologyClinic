const signupForm = document.getElementById("signupForm");

signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const patient = {
        firstName: document.getElementById("FirstName").value.trim(),
        lastName: document.getElementById("LastName").value.trim(),
        password: document.getElementById("password").value,
        dateOfBirth: document.getElementById("dateOfBirth").value,
        address: document.getElementById("address").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim()
    };

    try {
        const response = await fetch("http://127.0.0.1:3000/api/auth/register",{
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(patient)
        });

        const result = await response.json();

        if (response.ok) {
            alert("Account created successfully!");
            signupForm.reset();
            window.location.href = "LoginPage.html";
        } else {
            alert(result.error || "Registration failed.");
        }

    } catch (error) {
        console.error("Registration error:", error);
        alert("Cannot connect to the server.");
    }
});