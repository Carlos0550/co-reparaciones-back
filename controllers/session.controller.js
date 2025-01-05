const { pool } = require("../config/database.js")
const dayjs = require("dayjs")
const getSession = async(req,res) => {
    const { 
        user_id,
        user_type
     } = req.query

     console.log("USER ID: ", user_id)
     console.log("USER TYPE: ", user_type)
    
    if(!user_id || !user_type) return res.status(400).json({ msg: "No se pudo validar la sesión porque falta información importante" })

        const query1 = `
        SELECT * FROM admins WHERE id = $1 
    `
    const query2 = `SELECT 
        c.*, cd.*,
        cd.id AS client_data_id
        FROM clients c
        LEFT JOIN clients_data cd ON c.id = cd.client_uuid
        WHERE c.id = $1;
`;

    const query2_1 = `
        SELECT * FROM clients WHERE id = $1
    `

    const query3 = `
        UPDATE admins SET session_timeout = $1 WHERE id = $2
    `

    const query4 = `
        UPDATE clients SET session_timeout = $1 WHERE id = $2
    `

    let client = await pool.connect()
    const tomorrow = dayjs().add(1,"day")
    try {
        await client.query("BEGIN")
        if(user_type === "admin"){
            const response = await client.query(query1, [user_id])
            if (response.rowCount === 0) return res.status(400).json({ msg: "No se pudo encontrar el usuario" })

            const userData = response.rows
            await client.query(query3, [dayjs(tomorrow).format("YYYY-MM-DD"), user_id])  
            await client.query("COMMIT")
            return res.status(200).json({ msg: "Usuario logueado con exito", user: { ...userData, admin: true, user_type: "admin" } })
        }
        if(user_type === "client"){
            const response = await client.query(query2,[user_id])

            if (response.rowCount === 0) return res.status(400).json({ msg: "No se pudo encontrar el usuario" })
            const is_verified = response.rows[0].is_verified

            if(is_verified){
                const userData = response.rows
                await client.query(query4, [dayjs(tomorrow).format("YYYY-MM-DD"), user_id])
                
                await client.query("COMMIT")
                return res.status(200).json({ msg: "Usuario logueado con exito", user: { ...userData, admin: false, user_type: "client" } })
            }else{
                const user_data = await client.query(query2_1, [user_id])
                if (user_data.rowCount === 0) return res.status(400).json({ msg: "No se pudo encontrar el usuario" })
                const userData = user_data.rows[0]
                await client.query("COMMIT")
                return res.status(200).json({ msg: "Usuario logueado con exito", user: { ...userData, admin: false, user_type: "client" } })
            }

             
            
        }

        return res.status(400).json({ msg: "El servidor no pudo identificar el tipo de sesión" })
    } catch (error) {
        console.log(error)
        return res.status(400).json({ msg: "No se pudo validar la sesión" })
    }finally{
        if(client) client.release() 
    }
}

module.exports = { getSession }