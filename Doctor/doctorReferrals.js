 

const API_BASE = "";

function showReferralMessage(message, error = false) {
    const element = document.getElementById("referralFeedback");

    if (!element) return;

    element.textContent = message;
    element.style.color = error ? "red" : "";
}

function formatReferralDate(value) {
    return value ? String(value).slice(0, 10) : "—";
}

function addCell(row, value) {
    const cell = row.insertCell();

    cell.textContent =
        value === null || value === undefined || value === ""
            ? "—"
            : String(value);

    return cell;
}

function showEmptyRow(tbody, message) {
    if (!tbody) return;

    tbody.replaceChildren();

    const row = tbody.insertRow();
    const cell = row.insertCell();

    cell.colSpan = 8;
    cell.textContent = message;
    cell.className = "empty";
}

async function updateReferral(referralId, status, row) {
    const action = {
        Approved: "approve",
        Denied: "deny",
        Canceled: "cancel"
    }[status];

    if (!action) return;

    const confirmed = confirm(
        `Are you sure you want to ${action} referral #${referralId}?`
    );

    if (!confirmed) return;

    const buttons = row.querySelectorAll("button");

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        const response = await fetch(
            `${API_BASE}/api/doctor/referrals/${referralId}/decision`,
            {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: status
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Could not update referral"
            );
        }

        await loadDoctorReferrals();

        showReferralMessage(
            `Referral #${referralId} ${status.toLowerCase()} successfully.`
        );

    } catch (error) {
        console.error("Referral update error:", error);

        showReferralMessage(error.message, true);

        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}

function addReferralRow(tbody, referral) {
    const row = tbody.insertRow();

    const patientName = [
        referral.Patient_First_Name,
        referral.Patient_Last_Name
    ].filter(Boolean).join(" ");

    const specialistName = [
        referral.Specialist_First_Name,
        referral.Specialist_Last_Name
    ].filter(Boolean).join(" ");

    addCell(row, referral.Referral_ID);
    addCell(row, patientName);
    addCell(row, specialistName);
    addCell(row, referral.Reason);
    addCell(row, formatReferralDate(referral.Referral_Date));
    addCell(row, formatReferralDate(referral.Approval_Date));
    addCell(row, referral.Status);

    const actionCell = row.insertCell();
    actionCell.className = "referralActions";

    const pending =
        String(referral.Status || "").trim().toLowerCase() === "pending";

    const canDecide = Number(referral.Can_Decide) === 1;

if (!pending) {
    actionCell.textContent = "—";
    return;
}

// Any doctor can approve a pending referral.
// Only the primary doctor can deny or cancel.
const actions = [
    ["Approve", "Approved", "approveBtn"]
];

if (canDecide) {
    actions.push(
        ["Deny", "Denied", "denyBtn"],
        ["Cancel", "Canceled", "cancelBtn"]
    );
}

    actions.forEach(([label, status, className]) => {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = label;
        button.className = className;

        button.addEventListener("click", () => {
            updateReferral(
                referral.Referral_ID,
                status,
                row
            );
        });

        actionCell.appendChild(button);
    });
}

async function loadDoctorReferrals() {
    const sections = {
        pending: document.getElementById("pendingReferralRows"),
        approved: document.getElementById("approvedReferralRows"),
        denied: document.getElementById("deniedReferralRows"),
        canceled: document.getElementById("canceledReferralRows")
    };

    Object.entries(sections).forEach(([status, tbody]) => {
        showEmptyRow(tbody, `Loading ${status} referrals...`);
    });

    try {
        const response = await fetch(
            `${API_BASE}/api/doctor/referrals`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Could not load referrals (HTTP ${response.status})`
            );
        }

        const referrals = await response.json();

        if (!Array.isArray(referrals)) {
            throw new Error("Invalid referral data");
        }

        const grouped = {
            pending: [],
            approved: [],
            denied: [],
            canceled: []
        };

        referrals.forEach(referral => {
            let status = String(
                referral.Status || ""
            ).trim().toLowerCase();

            if (status === "cancelled") {
                status = "canceled";
            }

            if (grouped[status]) {
                grouped[status].push(referral);
            }
        });

        Object.entries(sections).forEach(([status, tbody]) => {
            if (!tbody) return;

            tbody.replaceChildren();

            if (grouped[status].length === 0) {
                showEmptyRow(
                    tbody,
                    `No ${status} referrals found.`
                );
                return;
            }

            grouped[status].forEach(referral => {
                addReferralRow(tbody, referral);
            });
        });

    } catch (error) {
        console.error("Referral loading error:", error);

        Object.entries(sections).forEach(([status, tbody]) => {
            showEmptyRow(
                tbody,
                `Could not load ${status} referrals.`
            );
        });

        showReferralMessage(error.message, true);
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        loadDoctorReferrals
    );
} else {
    loadDoctorReferrals();
}
