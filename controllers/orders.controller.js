const { pool } = require("../config/database.js")
const dayjs = require("dayjs");
const { sendEmail } = require("../emails/sendEmails.js");
const getOrders = async (req, res) => {
    const query1 = `
    SELECT 
        cd.dni,
        cd.user_fullname,
        cd.first_address,
        cd.second_address,
        cd.province,
        cd.city,
        cd.postal_code,
        cd.user_phone,
        co.id AS order_id,
        co.products_details, 
        co.order_status,
        c.user_email
    FROM clients_orders co
    LEFT JOIN clients_data cd ON co.client_id = cd.client_uuid
    LEFT JOIN clients c ON cd.client_uuid = c.id
    ORDER BY co.id ASC
`;



    let client;
    try {
        client = await pool.connect()

        const response = await client.query(query1)

        if (response.rowCount === 0) return res.status(404).json({
            msg: "No se encontraron ordenes de compra",
        })

        return res.status(200).json({
            msg: "Ordenes encontradas con exito",
            orders: response.rows
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            msg: "Error al obtener las ordenes de compra"
        })
    } finally {
        if (client) client.release()
    }

}

const processOrder = async (req, res) => {
    const { order_id } = req.params

    if (!order_id) return res.status(404).json({ msg: "El servidor no recibió el ID de la orden" })
    
    const query = `
        SELECT order_status FROM clients_orders WHERE id = $1
    `

    const query1 = `
        UPDATE clients_orders SET order_status = $1 WHERE id = $2
    `
    const query2 = `
        SELECT cd.user_fullname, c.user_email, co.order_date
        FROM clients_orders co
        LEFT JOIN clients_data cd ON co.client_id = cd.client_uuid
        LEFT JOIN clients c ON cd.client_uuid = c.id
        WHERE co.id = $1
    `

    let client
    try {
        client = await pool.connect()

        const response0 = await client.query(query, [order_id])

        if (response0.rowCount === 0) return res.status(404).json({
            msg: "Ocurrió un error inesperado al obtener el estado de la orden"
        })

        const orderStatus = response0.rows[0].order_status

        let orderStatuses = ""
        let subjectEmail = ""
        let emailTemplate = ``

        const result2 = await client.query(query2, [order_id])

        if (result2.rowCount === 0) return res.status(404).json({
            msg: "Ocurrió un error inesperado al obtener los datos del cliente"
        })

        const clientData = result2.rows[0]

        switch (orderStatus) {
            case "pending":
                orderStatuses = "processing"
                subjectEmail = "Procesando orden de compra"
                emailTemplate = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Co-Reparaciones</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                margin: 0;
                                padding: 0;
                                background-color: #fff;
                                color: #000;
                                line-height: 1.6;
                            }
                            h1 {
                                text-align: center;
                                font-size: 2.5em;
                                margin-top: 20px;
                                color: #000;
                            }
                            p {
                                margin: 20px;
                                text-align: justify;
                                font-size: 1.2em;
                            }
                            .container {
                                max-width: 800px;
                                margin: 0 auto;
                                padding: 20px;
                                border: 1px solid #000;
                                border-radius: 10px;
                                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Co-Reparaciones</h1>
                            <p>Hola, ${clientData.user_fullname}</p>
                            <p>Queremos avisarte que tu compra hecha el día ${dayjs(clientData.order_date).format("DD/MM/YYYY")} fue comprobada y está siendo procesada por el vendedor. En las próximas horas serás notificado cuando tu pedido sea despachado.</p>
                            <p>Gracias por elegir Co-Reparaciones</p>
                        </div>
                    </body>
                    </html>
                `
                break;
            case "processing":
                orderStatuses = "completed"
                subjectEmail = "Orden de compra procesada"
                emailTemplate = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Co-Reparaciones</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                margin: 0;
                                padding: 0;
                                background-color: #fff;
                                color: #000;
                                line-height: 1.6;
                            }
                            h1 {
                                text-align: center;
                                font-size: 2.5em;
                                margin-top: 20px;
                                color: #000;
                            }
                            p {
                                margin: 20px;
                                text-align: justify;
                                font-size: 1.2em;
                            }
                            .container {
                                max-width: 800px;
                                margin: 0 auto;
                                padding: 20px;
                                border: 1px solid #000;
                                border-radius: 10px;
                                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Co-Reparaciones</h1>
                            <p>Hola, ${clientData.user_fullname}</p>
                            <p>Queremos avisarte que tu compra hecha el día ${dayjs(clientData.order_date).format("DD/MM/YYYY")} fue despachada, recibirás por parte del vendedor un mensaje con los datos del envío.</p>
                            <p>Gracias por elegir Co-Reparaciones</p>
                        </div>
                    </body>
                    </html>
                `
                break;
            default:
                break;
        }

        const response = await client.query(query1, [orderStatuses, order_id])

        if (response.rowCount === 0) return res.status(404).json({
            msg: "Ocurrió un error inesperado al actualizar el estado de la orden"
        })

        await sendEmail(clientData.user_email, subjectEmail, emailTemplate)

        return res.status(200).json({
            msg: "Estado de la orden actualizado con éxito"
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            msg: "Error al actualizar el estado de la orden"
        })
    } finally {
        if (client) client.release()
    }
}


module.exports = { getOrders, processOrder }