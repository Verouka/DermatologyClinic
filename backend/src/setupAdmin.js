
import "dotenv/config";
import pool from "./database.js";
import { hashPassword } from "./utils/password.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = createInterface({ input, output });

async function setupAdmin() {
  let connection;

  try {
    const password = await rl.question(
      "Enter a temporary administrator password: "
    );

    if (password.length < 12) {
      throw new Error("Password must contain at least 12 characters.");
    }

    const passwordHash = await hashPassword(password);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      "SELECT UserID FROM usercredential WHERE Email = ?",
      ["admin@houstonderm.example"]
    );

    if (existing.length > 0) {
      throw new Error("Administrator account already exists.");
    }

    const [adminResult] = await connection.execute(
      `INSERT INTO administrator
       (First_Name, Last_Name, Email, OFFICE_Office_ID)
       VALUES (?, ?, ?, ?)`,
      [
        "Clinic",
        "Administrator",
        "admin@houstonderm.example",
        1
      ]
    );

    const adminId = adminResult.insertId;

    await connection.execute(
      `INSERT INTO usercredential
       (Email, Password_hash, role, ADMINISTRATOR_Administrator_ID)
       VALUES (?, ?, ?, ?)`,
      [
        "admin@houstonderm.example",
        passwordHash,
        "administrator",
        adminId
      ]
    );

    await connection.commit();

    console.log("Administrator account created successfully!");
    console.log("Administrator ID:", adminId);
    console.log("Email: admin@houstonderm.example");

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Setup failed:", error.message);

  } finally {
    rl.close();

    if (connection) {
      connection.release();
    }

    await pool.end();
  }
}

setupAdmin();
