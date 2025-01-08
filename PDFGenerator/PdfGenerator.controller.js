const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require("fs");
const path = require("path");
const fontkit = require('fontkit');
const { pool } = require("../config/database.js"); // Cliente postgres de la base de datos
const dayjs = require("dayjs");
const generatePdfReceipt = async (req, res) => {
    const { client_info, cart_items } = req.body;
    if (!cart_items) {
        return res.status(400).json({ msg: 'Los datos del cliente y el carrito de compras son obligatorios.' });
    }

    let clientData;
    if (client_info) {
        try {
            clientData = JSON.parse(client_info);
        } catch (error) {
            console.log(error);
        }
    }
    const cartItems = JSON.parse(cart_items);

    try {
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const notoSansPath = path.resolve(__dirname, "./Fonts/NotoSans.ttf");
        const notoSansBytes = fs.readFileSync(notoSansPath);
        const notoSansFont = await pdfDoc.embedFont(notoSansBytes);
        
        const margin = 50;
        const lineHeight = 15;
        const baseHeight = 300;
        let dynamicHeight = lineHeight * cartItems.length + margin * 2;
        let totalHeight = baseHeight + dynamicHeight + 20;

        let page = pdfDoc.addPage([600, totalHeight]);
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

        page.drawText(`Fecha: ${dayjs().format('DD/MM/YYYY')}`, { x: margin, y, size: 12, font: timesRomanFont });
        y -= 20;

        if (clientData && Object.keys(clientData[0]).length > 0) {
            page.drawText(`Cliente: ${clientData[0].user_fullname}`, { x: margin, y, size: 12, font: timesRomanFont });
            y -= lineHeight;
            page.drawText(`Correo: ${clientData[0].user_email}`, { x: margin, y, size: 12, font: timesRomanFont });
            y -= lineHeight;
            page.drawText(`Teléfono: ${clientData[0].user_phone || "Sin información"}`, { x: margin, y, size: 12, font: timesRomanFont });
            y -= lineHeight;

            const address = `${clientData[0].first_address || ''} ${clientData[0].second_address || ''} ${clientData[0].postal_code || ''}, ${clientData[0].province || ''}`;
            page.drawText(`Domicilio: ${address.trim() || "Sin información"}`, { x: margin, y, size: 12, font: timesRomanFont });
            y -= 30;
        }
        y-= 10;
        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 1,
            color: rgb(0.85, 0.85, 0.85)
        });
        y -= 20;

        page.drawText('Artículos:', { x: margin, y, size: 14, font: timesRomanFont });
        y -= 20;

        const checkNewPage = () => {
            if (y <= margin) {
                page = pdfDoc.addPage([600, totalHeight]);
                y = page.getHeight() - margin;
            }
        };

        for (const item of cartItems) {
            if (item.item_type === 'promotion') {
                const promoQuery = `
                    SELECT pd.promotion_products_array, pd.product_id, p.promotion_type, p.promotion_name
                    FROM promotions_data pd
                    JOIN promotions p ON pd.promotion_id = p.id
                    WHERE pd.promotion_id = $1
                `;

                const promoResult = await pool.query(promoQuery, [item.id]);
                if (promoResult.rows.length > 0) {
                    const promotion = promoResult.rows[0];
                    const { promotion_type, promotion_products_array, product_id, promotion_name } = promotion;

                    if (promotion_type === 'single' && product_id) {
                        const productQuery = `
                            SELECT product_name, product_price 
                            FROM products 
                            WHERE id = $1
                        `;
                        const productResult = await pool.query(productQuery, [product_id]);

                        if (productResult.rows.length > 0) {
                            const product = productResult.rows[0];
                            const promoName = promotion_name;
                            const productText = `x1 ${product.product_name} - ${parseFloat(product.product_price).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}`;
                            checkNewPage();
                            page.drawText(promoName, { x: margin, y, size: 15, font: notoSansFont });
                            y -= 20;
                            checkNewPage();
                            page.drawText(productText, { x: margin, y, size: 12, font: notoSansFont });
                            y -= 25;
                        }
                    } else if (promotion_type === 'multiple' && promotion_products_array) {
                        const products = JSON.parse(promotion_products_array);
                        const promoName = promotion_name;
                        checkNewPage();
                        page.drawText(promoName, { x: margin, y, size: 15, font: notoSansFont });
                        y -= 20;
                        products.forEach(product => {
                            checkNewPage();
                            const productText = `x${product.quantity} ${product.name} - ${parseFloat(product.price).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}`;
                            page.drawText(productText, { x: margin, y, size: 12, font: notoSansFont });
                            y -= 25;
                        });
                    }
                }
            } else if (item.item_type === 'product') {
                const productText = `x${item.quantity} ${item.product_name} - ${parseFloat(item.product_price).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}`;
                checkNewPage();
                page.drawText(productText, { x: margin, y, size: 12, font: notoSansFont });
                y -= lineHeight;
            }
        }

        const subtotal = cartItems.reduce((sum, item) => {
            if (item.item_type === 'product') {
                return sum + (item.quantity * item.product_price);
            } else if (item.item_type === 'promotion') {
                return sum + (item.quantity * item.price);
            }
            return sum;
        }, 0);

        const total = parseFloat(subtotal).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
        checkNewPage();
        y -= 10;
        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 1,
            color: rgb(0.85, 0.85, 0.85)
        });
        y -= 20;

        checkNewPage();
        page.drawText(`Total a pagar: ${total}`, { x: margin, y, size: 14, color: rgb(0, 0.5, 0), font: timesRomanFont });
        y -= 20;

        page.drawText("Gracias por tu compra, recuerda volver a la página y seleccionar 'Ir al Whatsapp' para enviar tu recibo, si no lo ves, aqui debajo ", { x: margin, y, size: 10, color: rgb(0, 0, 0), font: timesRomanFont });
        y -= 20;
        page.drawText("encontrarás nuestra información de contácto.", { x: margin, y, size: 10, color: rgb(0, 0, 0), font: timesRomanFont });
        y -= 10;
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
