const { pool } = require("../config/database.js");
const { sendEmail } = require("../emails/sendEmails.js")
const generateOTPAuthCode = () => {
    const OPTCode = Math.floor(10000 + Math.random() * 90000)
    return OPTCode
}
const loginClientWithEmail = async(req,res) => {
    const { email } = req.params

    if(!email) return res.status(400).json({ msg: "Algunos datos obligatorios no fueron proporcionados" })
    const query1 = `SELECT id FROM clients WHERE user_email = $1;`
    const query2 = `UPDATE clients SET auth_code = $1 WHERE user_email = $2`

    let client;

    try {
        client = await pool.connect()

        await client.query("BEGIN")
        const result1 = await client.query(query1, [email])
        if(result1.rowCount === 0) throw new Error("El usuario no existe")
        const otpCode = generateOTPAuthCode()
        
        const result2 = await client.query(query2,[otpCode, email])
        if(result2.rowCount === 0) throw new Error("No se pudo generar el codigo de autorizacion")
        
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

        const emailStatus = await sendEmail(email, "Co-Reparaciones OTP Code", emailTemplate)

        if(emailStatus){
            await client.query("COMMIT")
            return res.status(200).json({msg: "Un codigo de autenticación ha sido enviado a tu correo"})
        }
        throw new Error("No se pudo enviar el codigo de autenticación")
    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        return res.status(500).json({ msg: error.message || "Error interno del servidor al enviar el codigo de autenticación" })
    }finally{
        if(client) client.release()
    }
}

const createClient = async(req,res) => {
    const { userEmail } = req.params

    if(!userEmail) return res.status(400).json({ msg: "Algunos datos obligatorios no fueron proporcionados" })

    const query = `SELECT id from clients WHERE user_email = $1;`
    const query1 = `INSERT INTO clients(user_email, auth_code) VALUES($1, $2);`

    let client;
    try {
        client = await pool.connect()

        await client.query("BEGIN")
        const countUsers = await client.query(query, [userEmail])

        if(countUsers.rowCount > 0) throw new Error("Ya existe un cliente registrado con este correo")
        const otpCode = generateOTPAuthCode()
        
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

        if(emailStatus) return res.status(200).json({msg: "Un codigo de autenticación ha sido enviado a tu correo"})
        throw new Error("No se pudo enviar el codigo de autenticación")

    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        return res.status(500).json({ msg: error.message || "Error interno del servidor al registrar el usuario" })
    }finally{
        if(client) client.release()
    }

}

const verifyAuthCode = async(req, res) => {
    const { otpCode, client_email } = req.query
    if(!client_email || !otpCode) return res.status(400).json({ msg: "Algunos datos obligatorios no fueron proporcionados" })

    const query1 = `SELECT auth_code FROM clients WHERE client_email = $1;`

    let client;
    try {
        client = await pool.connect()

        await client.query("BEGIN")
        const selectedUser = await client.query(query1, [client_email])
        const authCode = selectedUser.rows[0].auth_code
        if(authCode !== otpCode) return res.status(400).json({ msg: "El codigo ingresado no coincide" })
        await client.query("UPDATE clients SET auth_code = null WHERE client_email = $1;", [client_email])
        await client.query("COMMIT")
        return res.status(200).json({ msg: "Codigo verificado con exito" })
    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        return res.status(500).json({ msg: error.message || "Error interno del servidor al registrar el usuario" })
    }finally{
        if(client) client.release()
    }
}


module.exports = { loginClientWithEmail, verifyAuthCode, createClient }