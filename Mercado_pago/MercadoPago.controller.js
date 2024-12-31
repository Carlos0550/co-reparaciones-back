
const { MercadoPagoConfig, Preference } = require("mercadopago");

const mercadoPago = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});


const createPayment = async (req, res) => {
    const { products, client_data } = req.body
    
    if(!products || !client_data) return res.status(400).json({ msg: "El servidor no recibió correctamente la información del producto" })
    

    try {
        const parsedClientData = JSON.parse(client_data)
        const preference = new Preference(mercadoPago)
        const parsedProducts = JSON.parse(products).map(element => {
            return {
                id: element.id,
                title: element.name,
                unit_price: Number(element.unit_price),
                quantity: Number(element.quantity)
            }})
    //https://co-reparaciones-front.vercel.app/
        const response = await preference.create({
            body: {
                items: parsedProducts,
                back_urls: {
                    success: "http://localhost:5173/payment-success", 
                    failure: "http://localhost:5173/payment-failure",  
                    pending: "http://localhost:5173/payment-pending"  
                },
                auto_return: "approved",
                payer: {
                    name: parsedClientData[0].user_fullname,
                    email: parsedClientData[0].user_email,
                    phone: {
                      area_code: "+54",
                      number: parsedClientData[0].user_phone || "1234567890",
                    },
                    identification: {
                      type: 'DNI',
                      number: parsedClientData[0].dni,
                    },
                    address: {
                      zip_code: parsedClientData[0].postal_code || "",
                      street_name: parsedClientData[0].first_address || "",
                    },
                  },
              }
        });
        console.log(response)
        if(response){ 
            return res.status(200).json({
            init_point: response.init_point,
        })};
        
    } catch (error) {
        console.error("Error al crear el pago:", error);
        res.status(500).json({
            msg: "Error interno del servidor al crear el pago",
        });
    }
};


module.exports = { createPayment };
