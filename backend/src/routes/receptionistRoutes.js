
import {
    getPatients,
    createPatient
} from "../controllers/patientController.js";

import {
    getDoctors
} from "../controllers/doctorController.js";

import {
    getAppointments,
    createAppointment,
    updateAppointment
} from "../controllers/appointmentController.js";

import {
    getInvoices,
    updateInvoice
} from "../controllers/invoiceController.js";

import {
    getReceptionistProfile,
    updateReceptionistProfile,
    updateReceptionistPassword
} from "../controllers/receptionistProfileController.js";

export async function handleReceptionistRoutes(
    req,
    res,
    sendJSON,
    readBody,
    path
) {
    if (req.method === "GET" && path === "/api/receptionist/me") {
    return getReceptionistProfile(req, res, sendJSON);
    }

    if (req.method === "PATCH" && path === "/api/receptionist/me") {
        return updateReceptionistProfile(req, res, sendJSON, readBody);
    }

    if (req.method === "POST" && path === "/api/receptionist/password") {
        return updateReceptionistPassword(req, res, sendJSON, readBody);
    }
    if (req.method === "GET" && path === "/api/patients") {
        return getPatients(req, res, sendJSON);
    }

    if (req.method === "POST" && path === "/api/patients") {
        return createPatient(req, res, sendJSON, readBody);
    }

    if (req.method === "GET" && path === "/api/doctors") {
        return getDoctors(req, res, sendJSON);
    }

    if (req.method === "GET" && path === "/api/appointments") {
        return getAppointments(req, res, sendJSON);
    }

    if (req.method === "POST" && path === "/api/appointments") {
        return createAppointment(req, res, sendJSON, readBody);
    }

    const appointmentMatch = path.match(/^\/api\/appointments\/(\d+)$/);

    if (req.method === "PATCH" && appointmentMatch) {
        return updateAppointment(
            req, res, sendJSON, readBody, Number(appointmentMatch[1])
        );
    }

    if (req.method === "GET" && path === "/api/invoices") {
        return getInvoices(req, res, sendJSON);
    }

    const invoiceMatch = path.match(/^\/api\/invoices\/(\d+)$/);

    if (req.method === "PATCH" && invoiceMatch) {
        return updateInvoice(
            req, res, sendJSON, readBody, Number(invoiceMatch[1])
        );
    }

    return false;
}
