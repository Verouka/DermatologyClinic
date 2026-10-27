import pool from "../database.js";
import { hashPassword } from "../utils/password.js";
import { verifyPassword } from "../utils/password.js";
import {
    createSession,
    getSession,
    deleteSession
} from "../services/sessionService.js";

export const handleAuthRoutes = async (req, res) => {



    if (req.method === "POST" && req.url === "/api/auth/logout") {
    deleteSession(req);

    res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": "clinic_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });

    res.end(JSON.stringify({
        message: "Logged out successfully"
    }));

    return true;
}




    if (req.method === "GET" && req.url === "/api/auth/me") {
    const session = getSession(req);

    if (!session) {
        res.writeHead(401, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
            error: "Not authenticated"
        }));

        return true;
    }

    res.writeHead(200, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
       userId: session.userId,
       email: session.email,
       role: session.role,
       patientId: session.patientId,
       administratorId: session.administratorId,
       doctorId: session.doctorId,
       nurseId: session.nurseId,
       receptionistId: session.receptionistId
    }));

    return true;
}







    if (req.method === "POST" && req.url === "/api/auth/login") {
    let body = "";

    for await (const chunk of req) {
        body += chunk;

        if (body.length > 10000) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Request too large" }));
            return true;
        }
    }

    let data;

    try {
        data = JSON.parse(body);
    } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return true;
    }

    const { email, password } = data;

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Email and password are required" }));
        return true;
    }

    const [rows] = await pool.execute(
     `SELECT
        UserID,
        Email,
        Password_hash,
        role,
        PATIENT_Patient_ID,
        ADMINISTRATOR_Administrator_ID,
        DOCTOR_Doctor_ID,
        NURSE_Nurse_ID,
        RECEPTIONIST_Receptionist_ID
     FROM usercredential
     WHERE Email = ?
     LIMIT 1`,
     [email.trim().toLowerCase()]
    );
    if (rows.length === 0) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid email or password" }));
        return true;
    }

    const user = rows[0];
    const validPassword = await verifyPassword(password, user.Password_hash);

    if (!validPassword) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid email or password" }));
        return true;
    }

    const token = createSession({
      userId: user.UserID,
      email: user.Email,
      role: user.role,
      patientId: user.PATIENT_Patient_ID,
      administratorId: user.ADMINISTRATOR_Administrator_ID,
      doctorId: user.DOCTOR_Doctor_ID,
      nurseId: user.NURSE_Nurse_ID,
      receptionistId: user.RECEPTIONIST_Receptionist_ID
    });

    res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": `clinic_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`
    });

    res.end(JSON.stringify({
        message: "Login successful!",
        role: user.role,
        userId: user.UserID
    }));

    return true;
}












  if (req.method !== "POST" || req.url !== "/api/auth/register") {
    return false;
  }

  const sendJSON = (status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json"
    });
    res.end(JSON.stringify(data));
  };

  let body = "";

  for await (const chunk of req) {
    body += chunk;

    if (body.length > 10000) {
      sendJSON(413, { error: "Request too large" });
      return true;
    }
  }

  let data;

  try {
    data = JSON.parse(body);
  } catch {
    sendJSON(400, { error: "Invalid JSON" });
    return true;
  }

  const {
    firstName,
    lastName,
    password,
    dateOfBirth,
    address,
    email,
    phone
  } = data;

  if (
    ![firstName, lastName, password, dateOfBirth,
      address, email, phone].every(
      value => typeof value === "string" && value.trim() !== ""
    )
  ) {
    sendJSON(400, { error: "All fields are required" });
    return true;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (
    firstName.length > 45 ||
    lastName.length > 45 ||
    address.length > 45 ||
    normalizedEmail.length > 45 ||
    phone.length > 20 ||
    password.length < 8 ||
    password.length > 128 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    !/^\d{3}-\d{3}-\d{4}$/.test(phone) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
    !Number.isFinite(Date.parse(dateOfBirth))
  ) {
    sendJSON(400, { error: "Invalid registration information" });
    return true;
  }

  const passwordHash = await hashPassword(password);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [patientResult] = await connection.execute(
      `INSERT INTO patient
       (First_Name, Last_Name, BirthDate, Street, Email, Phone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        firstName.trim(),
        lastName.trim(),
        dateOfBirth,
        address.trim(),
        normalizedEmail,
        phone
      ]
    );

    const patientId = patientResult.insertId;

    await connection.execute(
      `INSERT INTO usercredential
       (Email, Password_hash, role, PATIENT_Patient_ID)
       VALUES (?, ?, 'patient', ?)`,
      [normalizedEmail, passwordHash, patientId]
    );

    await connection.commit();

    sendJSON(201, {
      message: "Patient account created successfully!",
      patientId
    });

  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      sendJSON(409, {
        error: "An account with this email already exists"
      });
    } else {
      console.error("Registration error:", error);
      sendJSON(500, {
        error: "Registration failed"
      });
    }

  } finally {
    connection.release();
  }

  return true;
};