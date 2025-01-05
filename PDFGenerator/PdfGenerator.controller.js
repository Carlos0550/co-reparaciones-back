const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require("fs");
const path = require("path");

const generatePdfReceipt = async (req, res) => {
    const { client_info, cart_items } = req.body;

    if (!client_info || !cart_items) {
        return res.status(400).json({ msg: 'Los datos del cliente y el carrito de compras son obligatorios.' });
    }

    const clientData = JSON.parse(client_info);
    const cartItems = JSON.parse(cart_items);

    try {
        const pdfDoc = await PDFDocument.create();
        const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const margin = 50;
        const lineHeight = 15;
        const baseHeight = 300; 
        const dynamicHeight = lineHeight * cartItems.length + margin * 2;
        const totalHeight = baseHeight + dynamicHeight + 10 ;

        const page = pdfDoc.addPage([600, totalHeight]);
        const { width, height } = page.getSize();
        let y = height - margin;

        const logoPath = path.resolve(__dirname, "../Img_logo/logo.jpeg");
        const logoBytes = fs.readFileSync(logoPath);
        const logoImage = await pdfDoc.embedJpg(logoBytes);
        const logoDims = logoImage.scale(0.15); 
        page.drawImage(logoImage, { 
            x: width - margin - logoDims.width, 
            y: height - margin - logoDims.height, 
            width: logoDims.width, 
            height: logoDims.height 
        });

        y -= 60; 
        page.drawText('Co-Reparaciones', { x: margin, y, size: 22, color: rgb(0, 0.2, 0.6), font: timesRomanFont });
        y -= 30;

        page.drawText('Recibo de Compra', { x: margin, y, size: 18, color: rgb(0, 0, 0), font: timesRomanFont });
        y -= 40;

        page.drawText(`Fecha: ${new Date().toLocaleDateString()}`, { x: margin, y, size: 12, font: timesRomanFont });
        y -= 20;

        page.drawText(`Cliente: ${clientData[0].user_fullname}`, { x: margin, y, size: 12, font: timesRomanFont });
        y -= lineHeight;
        page.drawText(`Correo: ${clientData[0].user_email}`, { x: margin, y, size: 12, font: timesRomanFont });
        y -= lineHeight;
        page.drawText(`Teléfono: ${clientData[0].user_phone || "Sin información"}`, { x: margin, y, size: 12, font: timesRomanFont });
        y -= lineHeight;

        const address = `${clientData[0].first_address || ''} ${clientData[0].second_address || ''} ${clientData[0].postal_code || ''}, ${clientData[0].province || ''}`;
        page.drawText(`Domicilio: ${address.trim() || "Sin información"}`, { x: margin, y, size: 12, font: timesRomanFont });
        y -= 30;

        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 1,
            color: rgb(0.85, 0.85, 0.85)
        });
        y -= 20;

        page.drawText('Artículos:', { x: margin, y, size: 14, font: timesRomanFont });
        y -= 20;

        cartItems.forEach((item) => {
            const text = `x${item.quantity} ${item.product_name} - $${item.product_price}`;
            page.drawText(text, { x: margin, y, size: 12, font: timesRomanFont });
            y -= lineHeight;
        });

        const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.product_price, 0);
        const total = parseFloat(subtotal).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
        y -= 10;
        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 1,
            color: rgb(0.85, 0.85, 0.85)
        });
        y -= 20;

        page.drawText(`Total a pagar: ${total}`, { x: margin, y, size: 14, color: rgb(0, 0.5, 0), font: timesRomanFont });
        y -= 20;

        page.drawText("Gracias por tu compra, recuerda volver a la página y seleccionar 'Ir al Whatsapp' para enviar tu recibo, si no lo ves, aqui debajo ", { x: margin, y, size: 10, color: rgb(0, 0, 0), font: timesRomanFont });
        y -= 15
        page.drawText("encontrarás nuestra información de contácto.", { x: margin, y, size: 10, color: rgb(0, 0, 0), font: timesRomanFont })
        
        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 1,
            color: rgb(0.85, 0.85, 0.85)
        });
        y -= 20;
        
        page.drawText('Co-Reparaciones | Cristianocampo@Reparaciones | 3764100978', { x: margin, y, size: 10, font: timesRomanFont, color: rgb(0.5, 0.5, 0.5) });

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
