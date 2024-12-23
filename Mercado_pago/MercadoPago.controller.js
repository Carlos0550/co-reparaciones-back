
const { MercadoPagoConfig, Preference } = require("mercadopago");


const mercadoPago = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

const createPayment = async (req, res) => {
    const { products } = req.body

    if(!products) return res.status(400).json({ msg: "El servidor no recibió correctamente la información del producto" })
    
    try {
        const preference = new Preference(mercadoPago)
        const parsedProducts = JSON.parse(products).map(element => {
            return {
                id: element.id,
                title: element.name,
                unit_price: Number(element.unit_price),
                quantity: Number(element.quantity)
            }})
        console.log(parsedProducts)

        const response = await preference.create({
            body: {
                items: parsedProducts,
                back_urls: {
                    success: "http://localhost:5173/payment-success", 
                    failure: "https://co-reparaciones-front.vercel.app/payment-failure",  
                    pending: "https://co-reparaciones-front.vercel.app/payment-pending"  
                },
                auto_return: "approved",
              }
        });
        
        res.json({
            init_point: response.init_point,
        });
    } catch (error) {
        console.error("Error al crear el pago:", error);
        res.status(500).json({
            msg: "Error interno del servidor al crear el pago",
        });
    }
};


module.exports = { createPayment };
