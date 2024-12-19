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
app.use(cors());
app.use(express.json());

(async()=>{
    await checkConnection()
})()

app.use('/api/admins', adminsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes)
app.use("/api/promotions", promotionsRouter);
app.use("/api/banners", bannersRouter)
app.use("/api/colors", colorsRouter)

// setInterval(() => {
//     const argentinaTime = dayjs().tz("America/Buenos_Aires")
//     console.log(dayjs(argentinaTime).format("YYYY-MM-DD HH:mm:ss"));   
// }, 1000);

cron.schedule("*/30 * * * *", async() => {
    const argentinaTime = dayjs().tz("America/Buenos_Aires")
    console.log(dayjs(argentinaTime).format("YYYY-MM-DD HH:mm:ss"));    
    console.log("Ejecutando tarea programada");

    const query1 = `UPDATE promotions SET promotion_state = true WHERE promotion_starts <= $1`
    const query2 = `UPDATE promotions SET promotion_state = false WHERE promotion_ends <= $1`

    let client;
    try {
        client = await pool.connect()

        const response1 = await client.query(query1, [dayjs(argentinaTime).format("YYYY-MM-DD")])
        const response2 = await client.query(query2, [dayjs(argentinaTime).format("YYYY-MM-DD")])
        console.log("Filas actualizasdas", response1.rowCount, response2.rowCount)
        if (response1.rowCount === 0 && response2.rowCount === 0) {
            console.log("No se activó ni desactivó ninguna promoción.");
        }
    } catch (error) {
        console.log(error)
    }finally{
        if(client) client.release()
    }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
