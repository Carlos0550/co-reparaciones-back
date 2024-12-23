const express = require('express');
const cors = require('cors');
const cron = require("node-cron")
const dayjs = require("dayjs")
const utc = require("dayjs/plugin/utc")
const timezone = require("dayjs/plugin/timezone")

dayjs.extend(utc)
dayjs.extend(timezone)
require('dotenv').config(); 

const app = express();
const {checkConnection, pool} = require('./config/database.js');

const adminsRoutes = require('./routes/admins.routes.js');
const categoriesRoutes = require("./routes/categories.routes.js")
const productsRoutes = require("./routes/products.routes.js")
const promotionsRouter = require("./routes/promotions.routes.js")
const bannersRouter = require("./routes/banners.routes.js")
const colorsRouter = require("./routes/pagecolors.routes.js")
const clientsRoutes = require("./routes/clients.routes.js")
app.use(cors());
app.use(express.json());

(async()=>{
    await checkConnection()
})()

app.get("/", (req, res) => {
    res.send("Servidor corriendo");
})

app.use('/api/admins', adminsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes)
app.use("/api/promotions", promotionsRouter);
app.use("/api/banners", bannersRouter)
app.use("/api/colors", colorsRouter)
app.use("/api/clients", clientsRoutes)
app.use("/api/checkout", require("./Mercado_pago/MercadoPago.routes.js"))

cron.schedule("*/30 * * * *", async() => {
    const argentinaTime = dayjs().tz("America/Buenos_Aires")
    console.log(dayjs(argentinaTime).format("YYYY-MM-DD"));    
    console.log("Ejecutando tarea programada");

    const query1 = `UPDATE promotions SET promotion_state = true WHERE DATE(promotion_starts) = $1`
    const query2 = `UPDATE promotions SET promotion_state = false WHERE DATE(promotion_ends) = $1`

    let client;
    try {
        client = await pool.connect()

        const response1 = await client.query(query1, [dayjs(argentinaTime).format("YYYY-MM-DD")])
        console.log("Filas actualizadas 1", response1.rowCount)
        const response2 = await client.query(query2, [dayjs(argentinaTime).format("YYYY-MM-DD")])
        console.log("Filas actualizadas 2", response2.rowCount)
        if (response1.rowCount === 0 && response2.rowCount === 0) {
            console.log("No se activó ni desactivó ninguna promoción.");
        }
    } catch (error) {
        console.log(error)
    }finally{
        if(client) client.release()
    }
});

app.get("/verify-session", async(req,res) => {
    const { user_id, user_type } = req.query
    if(!user_id || !user_type) return res.status(404).json({msg: "El servidor no pudo verificar la sesión del usuario."})
    
    const query1 = `SELECT session_timeout, authorized_session FROM admins WHERE id = $1`
    const query2 = `SELECT session_timeout FROM clients WHERE id = $1`

    let client;
    try {
        client = await pool.connect()

        if(user_type === "admin"){
            const response = await client.query(query1, [user_id])
            if(response.rowCount === 0) return res.status(400).json({msg: "El servidor no pudo verificar la sesión del usuario."})
            const userData = response.rows[0]
            if(dayjs().isAfter(dayjs(userData.session_timeout))) return res.status(400).json({msg: "La sesión del usuario ha caducado.", outOfDate: true})

            return res.status(200).json({msg: "El servidor pudo verificar la sesión del usuario.", outOfDate: false})
        }else{
            const response = await client.query(query2, [user_id])
            if(response.rowCount === 0) return res.status(404).json({msg: "El servidor no pudo verificar la sesión del usuario, quizas el usuario no exista.", outOfDate: false})
            const userData = response.rows[0]
            if(dayjs().isAfter(dayjs(userData.session_timeout))) return res.status(400).json({msg: "El servidor no pudo verificar la sesión del usuario.", outOfDate: true})

            return res.status(200).json({msg: "El servidor pudo verificar la sesión del usuario.", outOfDate: false})
        }
    } catch (error) {
        console.log(error)
        return res.status(400).json({msg: "El servidor no pudo verificar la sesión del usuario."})
    }
})


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
