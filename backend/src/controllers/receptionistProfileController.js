
import pool from "../database.js";
import { getSession } from "../services/sessionService.js";
import {
    hashPassword,
    verifyPassword
} from "../utils/password.js";

function getReceptionistSession(req, res, sendJSON) {
    const session = getSession(req);

    if (!session) {
        sendJSON(res, 401, { error: "Not authenticated" });
        return null;
    }

    if (
        session.role !== "receptionist" ||
        !session.receptionistId
    ) {
        sendJSON(res, 403, {
            error: "Receptionist access required"
        });
        return null;
    }

    return session;
}

export async function getReceptionistProfile(req, res, sendJSON) {
    const session = getReceptionistSession(req, res, sendJSON);
    if (!session) return;

    const [rows] = await pool.execute(`
        SELECT
            First_Name AS firstName,
            Middle_Name AS middleName,
            Last_Name AS lastName,
            Street AS street,
            City AS city,
            State AS state,
            Zip_Code AS zipCode,
            Phone AS phone,
            Email AS email
        FROM receptionist
        WHERE Receptionist_ID = ?
    `, [session.receptionistId]);

    if (rows.length === 0) {
        return sendJSON(res, 404, {
            error: "Receptionist profile not found"
        });
    }

    const profile = rows[0];

    return sendJSON(res, 200, {
        name: [profile.firstName, profile.middleName, profile.lastName]
            .filter(Boolean)
            .join(" "),
        role: "receptionist",
        address: [
            profile.street,
            profile.city,
            profile.state,
            profile.zipCode
        ].filter(Boolean).join(", "),
        phone: profile.phone,
        email: profile.email
    });
}

export async function updateReceptionistProfile(
    req, res, sendJSON, readBody
) {
    const session = getReceptionistSession(req, res, sendJSON);
    if (!session) return;

    const body = await readBody(req);
    const { phone, address, email } = body;

    if (
        (phone !== undefined && typeof phone !== "string") ||
        (address !== undefined && typeof address !== "string") ||
        (email !== undefined && typeof email !== "string")
    ) {
        return sendJSON(res, 400, {
            error: "Phone, address, and email must be text values"
        });
    }

    if (phone === undefined && address === undefined && email === undefined) {
        return sendJSON(res, 400, {
            error: "Provide at least one profile field to update"
        });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [profiles] = await connection.execute(`
            SELECT Email
            FROM receptionist
            WHERE Receptionist_ID = ?
            FOR UPDATE
        `, [session.receptionistId]);

        if (profiles.length === 0) {
            await connection.rollback();
            return sendJSON(res, 404, {
                error: "Receptionist profile not found"
            });
        }

        const updates = [];
        const values = [];

        if (phone !== undefined) {
            if (phone.trim().length > 20) {
                await connection.rollback();
                return sendJSON(res, 400, {
                    error: "Phone number is too long"
                });
            }

            updates.push("Phone = ?");
            values.push(phone.trim() || null);
        }

        if (address !== undefined) {
            const parts = address.split(",").map(part => part.trim());

            if (parts.length > 4) {
                await connection.rollback();
                return sendJSON(res, 400, {
                    error: "Enter address as street, city, state, ZIP code"
                });
            }

            const [street, city, state, zipCode] = parts;

            for (const part of [street, city, state]) {
                if (part && part.length > 45) {
                    await connection.rollback();
                    return sendJSON(res, 400, {
                        error: "Address fields must be 45 characters or fewer"
                    });
                }
            }

            if (zipCode && zipCode.length > 10) {
                await connection.rollback();
                return sendJSON(res, 400, {
                    error: "ZIP code is too long"
                });
            }

            updates.push(
                "Street = ?", "City = ?", "State = ?", "Zip_Code = ?"
            );
            values.push(
                street || null,
                city || null,
                state || null,
                zipCode || null
            );
        }

        if (email !== undefined) {
            const normalizedEmail = email.trim().toLowerCase();

            if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
                normalizedEmail.length > 255
            ) {
                await connection.rollback();
                return sendJSON(res, 400, {
                    error: "Enter a valid email address"
                });
            }

            const [duplicates] = await connection.execute(`
                SELECT UserID
                FROM usercredential
                WHERE Email = ?
                  AND UserID <> ?
            `, [normalizedEmail, session.userId]);

            if (duplicates.length > 0) {
                await connection.rollback();
                return sendJSON(res, 409, {
                    error: "That email is already in use"
                });
            }

            updates.push("Email = ?");
            values.push(normalizedEmail);

            await connection.execute(`
                UPDATE usercredential
                SET Email = ?
                WHERE UserID = ?
                  AND role = 'receptionist'
            `, [normalizedEmail, session.userId]);
        }

        values.push(session.receptionistId);

        await connection.execute(`
            UPDATE receptionist
            SET ${updates.join(", ")}
            WHERE Receptionist_ID = ?
        `, values);

        await connection.commit();

        return sendJSON(res, 200, {
            message: "Profile updated successfully"
        });
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function updateReceptionistPassword(
    req, res, sendJSON, readBody
) {
    const session = getReceptionistSession(req, res, sendJSON);
    if (!session) return;

    const body = await readBody(req);
    const { currentPassword, newPassword } = body;

    if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        newPassword.length < 8 ||
        newPassword.length > 128
    ) {
        return sendJSON(res, 400, {
            error: "Enter your current password and a new password of 8–128 characters"
        });
    }

    const [rows] = await pool.execute(`
        SELECT Password_hash
        FROM usercredential
        WHERE UserID = ?
          AND role = 'receptionist'
        LIMIT 1
    `, [session.userId]);

    if (rows.length === 0) {
        return sendJSON(res, 404, {
            error: "Login account not found"
        });
    }

    const validPassword = await verifyPassword(
        currentPassword,
        rows[0].Password_hash
    );

    if (!validPassword) {
        return sendJSON(res, 401, {
            error: "Current password is incorrect"
        });
    }

    const newHash = await hashPassword(newPassword);

    await pool.execute(`
        UPDATE usercredential
        SET Password_hash = ?
        WHERE UserID = ?
          AND role = 'receptionist'
    `, [newHash, session.userId]);

    return sendJSON(res, 200, {
        message: "Password updated successfully"
    });
}
