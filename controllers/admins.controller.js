const { pool } = require("../config/database.js");
const { sendEmail } = require("../emails/sendEmails.js");
const { encriptar } = require("../utils/EncryptData.js");
const { hashPassword, verifyHashPassword } = require("../utils/HashPsw.js");
const dayjs = require("dayjs")

const generateOTP = () => {
    const otp = Math.random(10000 + Math.random() * 90000).toString()
    const result = ("00000" + otp).slice(-5)
    console.log(result)
    return result;
}

const verifyAdminData = async (req, res) => {
    const { user_email } = req.params

    if (!user_email) return res.status(400).json({ msg: "Por favor ingrese el correo del administrador" })

    const query1 = `SELECT is_verified, id FROM admins WHERE admin_email = $1`

    let client;
    try {
        client = await pool.connect()
        await client.query("BEGIN")

        const response = await client.query(query1, [user_email])
        if (response.rowCount === 0) return res.status(400).json({ msg: "No se pudo encontrar el usuario" })

        const isVerified = response.rows[0].is_verified
        const adminId = response.rows[0].id
        const otpCode = generateOTP()


        if (isVerified) return res.status(200).json({ verified: true, msg: "El usuario ya se encuentra verificado" })

        const responseInsertOtp = await client.query("UPDATE admins SET auth_code = $1 WHERE id= $2", [otpCode, adminId])


        if (responseInsertOtp.rowCount === 0) {
            await client.query("ROLLBACK")
            return res.status(400).json({ message: "Hubo un error al intentar verificar su usuario." })
        }
        const emailTemplate = `
            <!DOCTYPE html>
                <html lang="es">
                <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Bienvenido/a a Co-Reparaciones</title>
                <style>
                /* Estilos básicos para correos electrónicos */
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
                    <p>¡Bienvenido/a nuevamente a Co-Reparaciones!</p>
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
        const resultEMail = await sendEmail(user_email, "Verificación de Cuenta", emailTemplate)

        if (!resultEMail) {
            await client.query("ROLLBACK")
            return res.status(400).json({ message: "Hubo un error al intentar verificar su usuario." })
        }
        await client.query("COMMIT")
        return res.status(403).json({ message: "Tu cuenta debe ser verificada, se envio un codigo de verificacion a tu correo", verified: false })

    } catch (error) {
        console.log(error)
        return res.status(500).json({ msg: "Error interno del servidor al verificar el usuario" })
    }finally{
        if(client) client.release()
    }
}

const registerAdmin = async (req, res) => {
    const { user_login_name, user_fullname, user_email, user_password } = req.body;
    if (!user_fullname || !user_email || !user_password) return res.status(400).json({ message: "Algunos datos obligatorios no fueron proporcionados" });
    const query1 = `
        INSERT INTO users(user_email, user_fullname, user_login_name, user_psw) VALUES($1, $2, $3, $4);
    `

    let client;
    try {
        const hashedPsw = await hashPassword(user_password)

        client = await pool.connect()
        const response = await client.query(query1, [user_email, user_fullname, user_login_name, hashedPsw])
        if (response.rowCount === 0) return res.status(400).json({ msg: "No se pudo registrar el usuario" })
        return res.status(200).json({ msg: "Usuario registrado con exito" })
    } catch (error) {
        console.log(error)
        if (error.code === "23505") return res.status(400).json({ msg: "El correo o usuario ya se encuentra registrado" })
        return res.status(500).json({ msg: "Error interno del servidor al registrar el usuario" })
    } finally {
        if (client) client.release()
    }
};

const loginAdmin = async (req, res) => {
    const { user_email, user_password } = req.body;

    if (!user_password || !user_email) return res.status(400).json({ message: "Algunos datos obligatorios no fueron proporcionados" });

    const query1 = `
        SELECT * FROM admins WHERE admin_email = $1;
    `
    const query2 = `
        UPDATE admins SET session_timeout = $1, authorized_session = $2 WHERE admin_email = $3 RETURNING *;
    `
    let client;
    try {
        client = await pool.connect()
        await client.query("BEGIN")
        const response = await client.query(query1, [user_email])
        if (response.rowCount === 0) return res.status(400).json({ msg: "No se pudo encontrar el usuario" })

        const userData = response.rows[0]
        const isṔswValid = await verifyHashPassword(user_password, userData.admin_psw)
        if (!isṔswValid) return res.status(400).json({ msg: "Contraseña incorrecta" })
        
        const tomorrow = dayjs().add(1,"day")

        const response2 = await client.query(query2,[dayjs(tomorrow).format("YYYY-MM-DD"), true, user_email])

        if (response2.rowCount === 0) return res.status(400).json({ msg: "No se pudo actualizar la sesión del usuario" });
        
        await client.query("COMMIT")
        return res.status(200).json({ msg: "Usuario logueado con exito", user: { ...userData, admin: true, user_type: "admin" } })

    } catch (error) {
        console.log(error)
        return res.status(500).json({ msg: "Error interno del servidor al loguear el usuario" })
    } finally {
        if (client) client.release()
    }
}

const verifyOtp = async (req, res) => {
    const { otpCode } = req.params;
    const { admin_email } = req.query

    console.log(otpCode, admin_email)
    if (!admin_email || !otpCode) return res.status(400).json({ message: "Algunos datos obligatorios no fueron proporcionados" });

    const query1 = `SELECT auth_code FROM admins WHERE admin_email = $1;`

    let client;
    try {
        client = await pool.connect()

        const result1 = await client.query(query1, [admin_email])
        const authCode = result1.rows[0].auth_code
        if (authCode !== otpCode) return res.status(400).json({ msg: "El codigo ingresado no coincide" })
        await client.query("UPDATE admins SET auth_code = null WHERE admin_email = $1;", [admin_email])
        return res.status(200).json({ msg: "Codigo verificado con exito" })

    } catch (error) {
        console.log(error)
        return res.status(500).json({ msg: "Error interno del servidor al verificar el codigo" })
    } finally {
        if (client) client.release()
    }
}

const setAdminPsw = async (req, res) => {
    const { password } = req.body
    const { user_email } = req.params
    if (!user_email || !password) return res.status(400).json({ message: "Algunos datos obligatorios no fueron proporcionados" });
    const query1 = `
        UPDATE admins SET admin_psw = $1, is_verified = true WHERE admin_email = $2;`

    let client;
    try {
        client = await pool.connect()

        await client.query("BEGIN")
        const hashedPsw = await hashPassword(password)
        const result = await client.query(query1, [hashedPsw, user_email])
        if (result.rowCount === 0) {
            await client.query("ROLLBACK")
            return res.status(400).json({ msg: "No se pudo actualizar la contraseña" })
        }
        await client.query("COMMIT")
        return res.status(200).json({ msg: "Contraseña actualizada con exito" })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ msg: "Error interno del servidor al actualizar la contraseña" })
    } finally {
        if (client) client.release()
    }
}

const changePsw = async (req, res) => {
    const { password, admin_email } = req.query

    console.log(admin_email, password)
    if (!admin_email || !password) return res.status(400).json({ message: "Algunos datos obligatorios no fueron proporcionados" });
    const query1 = `
        UPDATE admins SET admin_psw = $1 WHERE admin_email = $2;`

    let client;
    try {
        client = await pool.connect()

        await client.query("BEGIN")
        const hashedPsw = await hashPassword(password)
        const result = await client.query(query1, [hashedPsw, admin_email])
        console.log(result)
        if (result.rowCount === 0) {
            await client.query("ROLLBACK")
            return res.status(400).json({ msg: "No se pudo actualizar la contraseña" })
        }

        const htmlTemplate = `
            <!DOCTYPE html>
                <html lang="es">
                <head>
                <meta charset="UTF-8">
                <style>
                    body {
                    background-color: #fff;
                    color: #000;
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 50px;
                    }
                    .container {
                    max-width: 500px;
                    margin: 0 auto;
                    padding: 20px;
                    border: 1px solid #000;
                    border-radius: 10px;
                    }
                    h1 {
                    color: #000;
                    }
                    .message {
                    margin-top: 20px;
                    font-size: 18px;
                    }
                    .new-password {
                    font-size: 20px;
                    font-weight: bold;
                    margin-top: 10px;
                    display: block;
                    }
                    .password-box {
                    margin-top: 15px;
                    font-size: 18px;
                    padding: 10px;
                    border: 1px solid #000;
                    border-radius: 5px;
                    width: 100%;
                    background-color: #f4f4f4;
                    }
                    .back-button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    background-color: #000;
                    color: #fff;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    }
                    .back-button:hover {
                    background-color: #444;
                    }
                </style>
                </head>
                <body>

                <div class="container">
                    <h1>Contraseña Cambiada Exitosamente</h1>
                    <div class="message">
                    <p>Tu contraseña ha sido cambiada correctamente.</p>
                    <p class="new-password">Nueva Contraseña:</p>
                    <input type="text" class="password-box" value="${password}" readonly>
                    </div>
                </div>

                </body>
                </html>
        `
        const emailStatus = await sendEmail(admin_email, "Cambio de contraseña", htmlTemplate)
        console.log(emailStatus)
        if (!emailStatus) {
            await client.query("ROLLBACK")
            return res.status(400).json({ msg: "No se pudo enviar el correo de cambio de contraseña" })
        }
        await client.query("COMMIT")
        return res.status(200).json({ msg: "Contraseña actualizada con exito" })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ msg: "Error interno del servidor al actualizar la contraseña" })
    } finally {
        if (client) client.release()
    }
}


module.exports = { registerAdmin, loginAdmin, verifyAdminData, verifyOtp, setAdminPsw, changePsw }