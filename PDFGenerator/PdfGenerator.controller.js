const { PDFDocument, rgb } = require('pdf-lib');

const generatePdfReceipt = async (req, res) => {
    const { client_info, cart_items } = req.body;

    if (!client_info || !cart_items) {
        return res.status(400).json({ msg: 'Los datos del cliente y el carrito de compras son obligatorios.' });
    }

    console.log("client_info: ", client_info);
    console.log("cart_items: ", cart_items);

    const clientData = JSON.parse(client_info);
    const cartItems = JSON.parse(cart_items);

    try {
        const pdfDoc = await PDFDocument.create();

        const margin = 50;
        const lineHeight = 15;
        const baseHeight = 250; 
        const dynamicHeight = lineHeight * cartItems.length + margin * 2;
        const totalHeight = baseHeight + dynamicHeight;

        const page = pdfDoc.addPage([600, totalHeight]);

        const { width, height } = page.getSize();
        let y = height - margin;

        page.drawText('Co-Reparaciones', { x: margin, y, size: 22, color: rgb(0, 0.2, 0.6) });
        y -= 30;

        page.drawText('Recibo de Compra', { x: margin, y, size: 18, color: rgb(0, 0, 0) });
        y -= 40;

        page.drawText(`Cliente: ${clientData[0].user_fullname}`, { x: margin, y, size: 12 });
        y -= lineHeight;
        page.drawText(`Correo: ${clientData[0].user_email}`, { x: margin, y, size: 12 });
        y -= lineHeight;
        page.drawText(`Teléfono: ${clientData[0].user_phone || "Sin información"}`, { x: margin, y, size: 12 });
        y -= lineHeight;

        const address = `${clientData[0].first_address || ''} ${clientData[0].second_address || ''} ${clientData[0].postal_code || ''}, ${clientData[0].province || ''}`;
        page.drawText(`Domicilio: ${address.trim() || "Sin información"}`, { x: margin, y, size: 12 });
        y -= 30;

        page.drawText('Artículos:', { x: margin, y, size: 14 });
        y -= 20;

        cartItems.forEach((item) => {
            const text = `x${item.quantity} ${item.product_name} - $${item.product_price}`;
            page.drawText(text, { x: margin, y, size: 12 });
            y -= lineHeight;
        });

        const total = cartItems.reduce((sum, item) => sum + item.quantity * item.product_price, 0);
        page.drawText(`Total a pagar: $${total.toFixed(2)}`, { x: margin, y, size: 14, color: rgb(0, 0.5, 0) });

        const pdfBytes = await pdfDoc.save();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=recibo.pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al generar el recibo de compra' });
    }
};

module.exports = { generatePdfReceipt };
