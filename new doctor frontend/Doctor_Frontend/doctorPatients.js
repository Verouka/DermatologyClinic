
const PATIENTS_API_ORIGIN = window.location.origin.endsWith(':3000')
    ? window.location.origin
    : 'http://127.0.0.1:3000';
const PATIENTS_LOGIN_PAGE = '../LoginPage.html';

let patientSelectionVersion = 0;
const recordTables = [
    ['medical-history', 6], ['allergies', 4], ['diagnoses', 6],
    ['treatments', 5], ['previous-treatments', 5],
    ['prescriptions', 6], ['patient-referrals', 7]
];

async function patientsGET(path) {
    const response = await fetch(`${PATIENTS_API_ORIGIN}${path}`, {
        method: 'GET', credentials: 'include'
    });
    if (response.status === 401 || response.status === 403) {
        window.location.replace(PATIENTS_LOGIN_PAGE);
        return null;
    }
    if (!response.ok) {
        throw new Error(`${path} failed with HTTP ${response.status}`);
    }
    return response.json();
}

function patientCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value == null || value === '' ? '—' : String(value);
    row.appendChild(cell);
    return cell;
}

function tableMessage(tbody, count, message) {
    tbody.replaceChildren();
    const tr = document.createElement('tr');
    const td = patientCell(tr, message);
    td.colSpan = count;
    td.className = 'empty';
    tbody.appendChild(tr);
}

function showRows(tbody, rows, columns, noDataText) {
    if (!tbody) return;
    if (!Array.isArray(rows) || rows.length === 0) {
        tableMessage(tbody, columns.length, noDataText);
        return;
    }
    tbody.replaceChildren();
    for (const item of rows) {
        const tr = document.createElement('tr');
        for (const col of columns) {
            const value = typeof col === 'function' ? col(item) : item[col];
            patientCell(tr, value);
        }
        tbody.appendChild(tr);
    }
}

function dateOnly(value) {
    if (!value) return '—';
    const text = String(value);
    const date = /^\d{4}-\d{2}-\d{2}/.exec(text);
    if (!date) return text;
    const [year, month, day] = date[0].split('-');
    return `${month}/${day}/${year}`;
}

function timeOnly(value) {
    if (!value) return '—';
    const text = String(value);
    const found = /^(\d{1,2}):(\d{2})/.exec(text);
    if (!found) return text;
    const hour = Number(found[1]);
    return `${hour % 12 || 12}:${found[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function recordTable(section, index = 0) {
    return document.querySelectorAll(`#${section} .recordTable tbody`)[index];
}

function clearRecordTables(message = 'Select an assigned patient to view records.') {
    for (const [section, count] of recordTables) {
        const tbody = section === 'previous-treatments'
            ? recordTable('treatments', 1)
            : recordTable(section);
        if (tbody) tableMessage(tbody, count, message);
    }
}

function recordsSummary(text) {
    const paragraph = document.querySelector('#medical-records > .title p');
    if (paragraph) paragraph.textContent = text;
}

function patientName(patient) {
    return [patient.First_Name, patient.Middle_Name, patient.Last_Name]
        .filter(Boolean).join(' ');
}

function renderPatientRecords(data) {
    showRows(recordTable('medical-history'), data.medicalHistory,
        ['Medical_History_ID', 'Family_Member_Name', 'Relationship', 'Condition',
            item => dateOnly(item.Date), 'Notes'], 'No medical history records found.');
    showRows(recordTable('allergies'), data.allergies,
        ['Allergy_ID', 'Allergy_Name', item => timeOnly(item.Time_Occurred), 'Notes'],
        'No allergy records found.');
    showRows(recordTable('diagnoses'), data.diagnoses,
        ['Diagnosis_ID', 'Diagnosis_Name', 'Diagnosis_Description',
            item => dateOnly(item.Diagnosis_Date), 'DOCTOR_Doctor_ID', 'APPOINTMENT_Appointment_ID'],
        'No diagnoses found.');
    showRows(recordTable('treatments'), data.treatments,
        ['Treatment_ID', 'Treatment_Name', 'Treatment_Description',
            'Treatment_Status', 'DOCTOR_Doctor_ID'], 'No current treatments found.');
    showRows(recordTable('treatments', 1), data.previousTreatments,
        ['Previous_Treatment_ID', 'Condition', 'Treatment_Name',
            item => dateOnly(item.Treatment_Date), 'Notes'], 'No previous treatments found.');
    showRows(recordTable('prescriptions'), data.prescriptions,
        ['Prescription_ID', 'Medication_Name', 'Dosage_Value', 'Dosage_Measurement',
            'Description', 'DOCTOR_Doctor_ID'], 'No prescriptions found.');
}

async function selectPatient(patientId) {
    const version = ++patientSelectionVersion;
    const id = Number(patientId);
    if (!Number.isSafeInteger(id) || id <= 0) return;

    // Highlight selection without modifying the original CSS file.
    document.querySelectorAll('#assignedPatientRows tr[data-patient-id]').forEach(row => {
        const selected = row.dataset.patientId === String(id);
        row.style.backgroundColor = selected ? 'rgb(220, 245, 237)' : '';
        row.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    clearRecordTables('Loading records...');
    recordsSummary('Loading selected patient’s medical records...');

    try {
        
        const data = await patientsGET(`/api/doctor/patients/${id}/records`);
        if (!data || version !== patientSelectionVersion) return;
        if (!data.patient) throw new Error('Patient record response is missing patient information');
        renderPatientRecords(data);
        recordsSummary(`Showing records for ${patientName(data.patient)} (Patient ID: ${id}).`);

        
        try {
            const allReferrals = await patientsGET('/api/doctor/referrals');
            if (version !== patientSelectionVersion || allReferrals === null) return;
            const rows = Array.isArray(allReferrals)
                ? allReferrals.filter(ref => Number(ref.Patient_ID) === id)
                : [];
            showRows(recordTable('patient-referrals'), rows,
                ['Referral_ID', 'Primary_Doctor_ID', 'Specialist_Doctor_ID',
                    'Reason', ref => dateOnly(ref.Referral_Date),
                    ref => dateOnly(ref.Approval_Date), 'Status'],
                'No referrals found for this patient.');
        } catch (err) {
            console.error('Could not load patient referrals:', err);
            if (version === patientSelectionVersion) {
                tableMessage(recordTable('patient-referrals'), 7, 'Could not load patient referrals.');
            }
        }
    } catch (error) {
        console.error('Could not load doctor patient records:', error);
        if (version === patientSelectionVersion) {
            clearRecordTables('Unable to load records for this patient.');
            recordsSummary('Could not load patient records. Check your server and doctor assignment.');
        }
    }
}

function renderAssignedPatients(patients) {
    const tbody = document.getElementById('assignedPatientRows');
    if (!tbody) return;
    if (!Array.isArray(patients) || patients.length === 0) {
        tableMessage(tbody, 5, 'No patients are assigned to your account.');
        return;
    }
    tbody.replaceChildren();
    for (const patient of patients) {
        const id = Number(patient.Patient_ID);
        if (!Number.isSafeInteger(id) || id <= 0) continue;
        const tr = document.createElement('tr');
        tr.dataset.patientId = String(id);
        tr.tabIndex = 0;
        tr.setAttribute('role', 'button');
        tr.setAttribute('aria-label', `View medical records for ${patientName(patient)}`);
        tr.style.cursor = 'pointer';
        patientCell(tr, patient.Patient_ID);
        patientCell(tr, patientName(patient));
        patientCell(tr, patient.Reason_For_Visit);
        patientCell(tr, patient.Latest_Diagnosis);
        patientCell(tr, patient.Latest_Treatment);
        tr.addEventListener('click', () => selectPatient(id));
        tr.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectPatient(id);
            }
        });
        tbody.appendChild(tr);
    }
}

async function loadDoctorPatients() {
    clearRecordTables();
    const assigned = document.getElementById('assignedPatientRows');
    if (!assigned) return;
    try {
        const user = await patientsGET('/api/auth/me');
        if (!user) return; // Redirect already started.
        if (user.role !== 'doctor' || !user.doctorId) {
            window.location.replace(PATIENTS_LOGIN_PAGE);
            return;
        }
        const patients = await patientsGET('/api/doctor/patients');
        if (!patients) return;
        renderAssignedPatients(patients);
        const paragraph = document.querySelector('#assigned-patients .recordCard > p');
        if (paragraph) paragraph.textContent =
            'Click an assigned patient to view medical history, diagnoses, treatments, and prescriptions.';
        recordsSummary('Choose a patient from the Assigned Patients table above.');
    } catch (error) {
        console.error('Unable to load assigned patients:', error);
        tableMessage(assigned, 5, 'Could not load assigned patients. Check your backend connection.');
        recordsSummary('Could not connect to the Doctor API.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDoctorPatients);
} else {
    loadDoctorPatients();
}
