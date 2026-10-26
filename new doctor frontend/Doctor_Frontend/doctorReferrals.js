
const API_ORIGIN = "http://127.0.0.1:3000";

async function getDoctorData(path) {
    const response = await fetch(`${API_ORIGIN}${path}`, {
        method: "GET",
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${path}`);
    }

    return response.json();
}

function displayReferralDate(value) {
    if (!value) return "—";
    // Handles MySQL DATE strings and JSON timestamps without timezone shifts.
    const text = String(value);
    const date = text.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : text;
}

function appendCell(row, value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value === null || value === undefined || value === ""
        ? "—" : String(value);
    if (className) cell.className = className;
    row.appendChild(cell);
    return cell;
}

function showReferralMessage(tableId, message) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    tbody.replaceChildren();
    const row = document.createElement("tr");
    row.className = "empty-referral-row";
    const cell = appendCell(row, message, "empty");
    cell.colSpan = 8;
    tbody.appendChild(row);
}

function showReferrals(tableId, referrals, emptyMessage) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    tbody.replaceChildren();

    if (referrals.length === 0) {
        showReferralMessage(tableId, emptyMessage);
        return;
    }

    for (const referral of referrals) {
        const row = document.createElement("tr");
        const patientName = [referral.Patient_First_Name, referral.Patient_Last_Name]
            .filter(Boolean).join(" ").trim();
        const specialistName = [referral.Specialist_First_Name, referral.Specialist_Last_Name]
            .filter(Boolean).join(" ").trim();
        const status = String(referral.Status || "").trim();

        appendCell(row, referral.Referral_ID);
        appendCell(row, patientName);
        appendCell(row, specialistName);
        appendCell(row, referral.Reason);
        appendCell(row, displayReferralDate(referral.Referral_Date));
        appendCell(row, displayReferralDate(referral.Approval_Date));
        appendCell(row, status, "referralStatus");

        const actionCell = document.createElement("td");
        actionCell.className = "referralActions";
        if (status.toLowerCase() === "pending") {
            const approve = document.createElement("button");
            approve.type = "button";
            approve.className = "approveBtn";
            approve.textContent = "Approve";
            approve.disabled = true;
            approve.title = "Referral approval is not enabled yet";

            const deny = document.createElement("button");
            deny.type = "button";
            deny.className = "denyBtn";
            deny.textContent = "Deny";
            deny.disabled = true;
            deny.title = "Referral decisions are not enabled yet";

            actionCell.append(approve, deny);
        } else {
            actionCell.textContent = "—";
        }
        row.appendChild(actionCell);
        tbody.appendChild(row);
    }
}

async function loadDoctorReferrals() {
    const tables = {
        pending: ["pendingReferralRows", "No pending referrals found."],
        approved: ["approvedReferralRows", "No approved referrals found."],
        denied: ["deniedReferralRows", "No denied referrals found."],
        canceled: ["canceledReferralRows", "No canceled referrals found."]
    };

    for (const [tableId] of Object.values(tables)) {
        showReferralMessage(tableId, "Loading referrals...");
    }

    try {
        const user = await getDoctorData("/api/auth/me");
        if (user.role !== "doctor") {
            window.location.replace("../LoginPage.html");
            return;
        }

        
        const referrals = await getDoctorData("/api/doctor/referrals");
        if (!Array.isArray(referrals)) {
            throw new Error("Unexpected referrals response: expected an array");
        }

        const grouped = {
            pending: [], approved: [], denied: [], canceled: []
        };

        for (const referral of referrals) {
            const status = String(referral.Status || "").trim().toLowerCase();
            const key = status === "cancelled" ? "canceled" : status;
            if (grouped[key]) grouped[key].push(referral);
        }

        for (const [status, [tableId, emptyMessage]] of Object.entries(tables)) {
            showReferrals(tableId, grouped[status], emptyMessage);
        }
    } catch (error) {
        console.error("Could not load doctor referrals:", error);
        for (const [tableId] of Object.values(tables)) {
            showReferralMessage(tableId, "Unable to load referrals. Check your login and server connection.");
        }
    }
}

loadDoctorReferrals();
