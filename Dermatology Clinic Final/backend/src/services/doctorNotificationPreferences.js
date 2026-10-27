
const preferencesByUser = new Map();

export function getDoctorNotificationPreferences(userId) {
    return preferencesByUser.get(String(userId)) || {
        appointmentReminders: true,
        medicalUpdates: true
    };
}

export function setDoctorNotificationPreferences(userId, data) {
    const preferences = {
        appointmentReminders: data.appointmentReminders,
        medicalUpdates: data.medicalUpdates
    };
    preferencesByUser.set(String(userId), preferences);
    return preferences;
}
