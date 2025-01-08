const { pool } = require("../config/database.js");
const { sendEmail } = require("../emails/sendEmails.js")
const dayjs = require("dayjs");
const { hashPassword, verifyHashPassword } = require("../utils/HashPsw.js");
const generateOTPAuthCode = () => {
    const OPTCode = Math.floor(10000 + Math.random() * 90000)
    return OPTCode
}
const loginClientWithEmail = async (req, res) => {
    const { email, password } = req.query
console.log(password)
    if (!email || !password) return res.status(400).json({ msg: "Algunos datos obligatorios no fueron proporcionados" })
    const query1 = `SELECT * from clients WHERE user_email = $1;`

    let client;

    try {
        client = await pool.connect()
        const result1 = await client.query(query1, [email])
        if (result1.rowCount === 0) return res.status(404).json({ msg: "No se pudo encontrar el usuario" }) 

        const userPassword = result1.rows[0].password
        const isPasswordCorrect = await verifyHashPassword(password, userPassword)
        console.log(isPasswordCorrect)
        if(!isPasswordCorrect) return res.status(403).json({ msg: "La contraseña es incorrecta" })

        return res.status(200).json({ msg: "Usuario logueado con exito", user: { ...result1.rows[0], admin: false, user_type: "client" } })
    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        return res.status(500).json({ msg: error.message || "Error interno del servidor al enviar el codigo de autenticación" })
    } finally {
        if (client) client.release()
    }
}

const createClient = async (req, res) => {
    const { userEmail, user_password } = req.query
    console.log(user_password)
    console.log(userEmail)
    if (!userEmail || !user_password) return res.status(400).json({ msg: "Algunos datos obligatorios no fueron proporcionados" })

    const query = `SELECT id from clients WHERE user_email = $1;`
    const query1 = `INSERT INTO clients(user_email, auth_code, password) VALUES($1, $2, $3);`

    let client;
    try {
        client = await pool.connect()

        await client.query("BEGIN")
        const countUsers = await client.query(query, [userEmail])

        if (countUsers.rowCount > 0) throw new Error("Ya existe un cliente registrado con este correo")



        const otpCode = generateOTPAuthCode()
        const hashedPassword = await hashPassword(user_password)
        await client.query(query1, [userEmail, otpCode, hashedPassword])

        const emailTemplate = `
            <!DOCTYPE html>
                <html lang="es">
                <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Bienvenido/a a Co-Reparaciones</title>
                <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #ffffff;
                    color: #000000;
                    margin: 0;
                    padding: 0;
                }
                .email-container {
                    width: 100%;
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    border: 1px solid #000000;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .header {
                    text-align: center;
                    padding: 20px 0;
                    background-color: #000000;
                    color: #ffffff;
                }
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                    font-weight: bold;
                }
                .body {
                    padding: 20px;
                    text-align: center;
                }
                .body p {
                    font-size: 16px;
                    margin-bottom: 20px;
                }
                .auth-code {
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 5px;
                    display: inline-block;
                    background-color: #f0f0f0;
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: 1px solid #000000;
                }
                .footer {
                    text-align: center;
                    padding: 20px;
                    font-size: 14px;
                    color: #555555;
                    border-top: 1px solid #000000;
                }
                </style>
                </head>
                <body>

                <div class="email-container">
                <!-- Encabezado -->
                <div class="header">
                    <h1>Co-Reparaciones</h1>
                </div>

                <!-- Cuerpo del mensaje -->
                <div class="body">
                    <p>¡Bienvenido/a a Co-Reparaciones!</p>
                    <p>Para continuar, por favor introduce el siguiente código de autenticación:</p>
                    <div class="auth-code">${otpCode}</div>
                </div>

                <div class="footer">
                    <p>Si no solicitaste este código, por favor ignora este mensaje.</p>
                    <p>&copy; 2024 Co-Reparaciones. Todos los derechos reservados.</p>
                </div>
                </div>

                </body>
                </html>

        `
        const emailStatus = await sendEmail(userEmail, "Co-Reparaciones OTP Code", emailTemplate)

        if (emailStatus) {
            await client.query("COMMIT")
            return res.status(200).json({ msg: "Un codigo de autenticación ha sido enviado a tu correo" })
        }
        throw new Error("No se pudo enviar el codigo de autenticación")

    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        return res.status(500).json({ msg: error.message || "Error interno del servidor al registrar el usuario" })
    } finally {
        if (client) client.release()
    }

}

const verifyAuthCode = async (req, res) => {
    const { otpCode, client_email } = req.query
    if (!client_email || !otpCode) return res.status(400).json({ msg: "Algunos datos obligatorios no fueron proporcionados" })

    const query1 = `SELECT auth_code FROM clients WHERE user_email = $1;`
    const query2 = `SELECT * from clients WHERE user_email = $1`

    let client;
    try {
        client = await pool.connect()

        await client.query("BEGIN")
        const selectedUser = await client.query(query1, [client_email])
        const authCode = selectedUser.rows[0].auth_code


        if (authCode !== otpCode) return res.status(400).json({ msg: "El codigo ingresado no coincide" })

        const tomorrow = dayjs().add(1, "day")

        await client.query("UPDATE clients SET auth_code = null, session_timeout = $1 WHERE user_email = $2;", [tomorrow, client_email])
        const result2 = await client.query(query2, [client_email])
        if (result2.rowCount === 0) throw new Error("Hubo un problema al traer los datos del usuario")

        await client.query("COMMIT")
        const { auth_code, ...user } = result2.rows[0]
        return res.status(200).json({ msg: "Codigo verificado con exito", user: { ...user, admin: false, user_type: "client" } })
    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        return res.status(500).json({ msg: error.message || "Error interno del servidor al registrar el usuario" })
    } finally {
        if (client) client.release()
    }
}

const saveClientInfo = async (req, res) => {
    const { client_id } = req.query
    console.log("ID del cliente al actualizar su informacion: ", client_id)
    const {
        client_name,
        client_dni,
        first_address,
        second_address,
        province,
        client_phone,
        city,
        postal_code
    } = req.body

    if (
        !client_dni ||
        !client_name ||
        !first_address ||
        !province ||
        !client_phone ||
        !city ||
        !postal_code ||
        !client_id
    ) return res.status(400).json({ msg: "El servidor no recibió correctamente algunos datos " })

    const query1 = `
    INSERT INTO clients_data (
            user_fullname,
            dni,
            first_address,
            second_address,
            province,
            user_phone,
            city,
            postal_code,
            client_uuid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const query2 = `
        UPDATE clients SET is_verified = true WHERE id = $1
    `

    let client
    try {
        client = await pool.connect()
        await client.query("BEGIN")
        const response1 = await client.query(query1, [
            client_name,
            client_dni,
            first_address,
            second_address || "",
            province,
            client_phone,
            city,
            postal_code,
            client_id
        ])


        if (response1.rowCount === 0) throw new Error("Hubo un problema al actualizar la informacion del cliente")
        const response2 = await client.query(query2, [client_id])

        if (response2.rowCount === 0) throw new Error("Hubo un problema al actualizar la informacion del cliente")

        await client.query("COMMIT")
        console.log("Informacion actualizada con exito")
        return res.status(200).json({ msg: "Informacion actualizada con exito" })
    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        return res.status(500).json({ msg: error.message || "Error interno del servidor al actualizar la informacion del cliente" })
    } finally {
        if (client) {
            client.release()
        }
    }
}

const getClientInfo = async (req, res) => {
    const { client_id } = req.query
    console.log("Client ID: ", client_id)
    if (!client_id || client_id === "null" || client_id === null) return res.status(400).json({ msg: "Algunos datos obligatorios no fueron proporcionados" })

    const query1 = `
        SELECT
            p.*, pd.*
        FROM clients p
        LEFT JOIN clients_data pd ON p.id = pd.client_uuid
        WHERE p.id = $1
    `

    let client
    try {
        client = await pool.connect()
        const response = await client.query(query1, [client_id])

        if (response.rowCount === 0) throw new Error("Hubo un problema al traer la informacion del cliente")
        console.log(response.rows[0])
        return res.status(200).json({ msg: "Informacion obtenida con exito", client: response.rows })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ msg: error.message || "Error interno del servidor al traer la informacion del cliente" })
    } finally {
        if (client) {
            client.release()
        }
    }
}

const getClientOrders = async (req, res) => {
    const { client_id } = req.params
    if (!client_id || client_id === "null" || client_id === null) return res.status(400).json({ msg: "Algunos datos obligatorios no fueron proporcionados" })

    const query1 = `SELECT * FROM clients_orders WHERE client_id = $1;`

    let client
    try {
        client = await pool.connect()
        const response = await client.query(query1, [client_id])

        if (response.rowCount === 0) return res.status(404).json({ msg: "No se pudo encontrar la informacion del cliente" })
        return res.status(200).json({ orders: response.rows })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ msg: error.message || "Error interno del servidor al traer la informacion del cliente" })
    } finally {
        if (client) {
            client.release()
        }
    }
}

module.exports = { loginClientWithEmail, verifyAuthCode, createClient, saveClientInfo, getClientInfo, getClientOrders }