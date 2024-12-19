const { pool } = require("../config/database.js");

const saveProduct = async(req,res)=> {
    console.log("Me ejecuto en save product")
    const {  product_name, product_description, product_price, product_category, product_stock } = req.body;
    const images = req.files

    const query1 =  `
        INSERT INTO products(product_name, product_description, product_category, product_price, stock) VALUES($1, $2, $3, $4, $5) RETURNING id;
    `
    const query2 = `
            INSERT INTO product_images (product_id, image_name, image_type, image_size, image_data)
            VALUES ($1, $2, $3, $4, $5);
    `;

    let client;
    try {
        client = await pool.connect()
        await client.query("BEGIN")

        const response = await client.query(query1, [product_name, product_description, product_category, product_price, product_stock])

        if(response.rowCount === 0){
            await client.query("ROLLBACK")
            return res.status(400).json({ msg: "No se pudo registrar el producto" })
        }

        const product_id = response.rows[0].id
        console.log('Producto insertado con ID:', product_id);

        const imageInsertPromises = images.map(image => {
            const imageValues = [
                product_id,
                image.originalname,
                image.mimetype,
                image.size,
                image.buffer
            ];

            return client.query(query2, imageValues);
        });

        const imageResponses = await Promise.all(imageInsertPromises);
        const totalInsertedImages = imageResponses.reduce((acc, imgRes) => acc + imgRes.rowCount, 0);
        if (totalInsertedImages !== images.length) {
            await client.query("ROLLBACK");
            return res.status(400).json({ msg: "No se pudieron registrar todas las imágenes" });
        }

        await client.query("COMMIT")
        return res.status(200).json({ msg: "Producto registrado con exito" })
    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        return res.status(500).json({ msg: "Error interno del servidor al registrar el producto" })
    }finally{
        if(client) client.release()
    }
}

const getProducts = async(req,res) => {
    const query = `
        SELECT p.*, pi.image_name, pi.image_type, pi.image_size, pi.image_data
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        ORDER BY p.id ASC
    `;

    let client = await pool.connect();
    try {
        const response = await client.query(query);

        if (response.rowCount === 0) {
            return res.status(404).json({ msg: "No hay productos registrados" });
        }

        const products = response.rows;

        const productsWithImages = products.reduce((acc, product) => {
            if (!acc[product.id]) {
                acc[product.id] = { ...product, images: [] };
            }

            if (Buffer.isBuffer(product.image_data)) {

                const imageBase64 = product.image_data.toString("base64");

                acc[product.id].images.push({
                    image_name: product.image_name,
                    image_type: product.image_type,
                    image_size: product.image_size,
                    image_data:`data:${product.image_type};base64,${imageBase64}`,
                });
            } else {
                console.error(`Image data for product ${product.id} is not a valid Buffer.`);
            }

            return acc;
        }, {});
        const finalProducts = Object.values(productsWithImages);
        return res.status(200).json({ products: finalProducts });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ msg: "Error interno del servidor al encontrar los productos" });
    } finally {
        if (client) client.release();
    }
};

const updateProduct = async (req, res) => {
    const { product_name, product_description, product_price, product_category, imagesWithEdit, product_stock } = req.body;
    const images = req.files; 
    const { product_id } = req.params;

    if (!product_id) return res.status(400).json({ msg: "Faltan datos importantes" });

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN")
        const imagesList = await client.query(`SELECT image_name FROM product_images WHERE product_id = $1;`, [product_id]);
        const existentImages = imagesList.rows.map(row => row.image_name);

        const imagesWithEditParsed = JSON.parse(imagesWithEdit);
        const imagesToKeep = imagesWithEditParsed.map(image => image.editing === true ? image.image_name : "").filter(image => image !== "");

        const imagesToDelete = existentImages.filter(img => !imagesToKeep.includes(img));

        const newImages = images.filter(img => !imagesWithEditParsed.some(i => i.image_name === img.originalname && i.editing));

        if(imagesToDelete.length > 0) {
            const resultDelete = await client.query(
                `DELETE FROM product_images WHERE image_name = ANY($1) AND product_id = $2;`, 
                [imagesToDelete, product_id]
            );
            
            if(resultDelete.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({ msg: "Ocurrió un error inesperado y no se pudo actualizar el producto." });
            }
        }

        if(newImages.length > 0){
            const insertQueries = newImages.map(image => client.query(`
                INSERT INTO product_images (product_id, image_name, image_data, image_type, image_size) 
                VALUES ($1, $2, $3, $4, $5);`, 
                [product_id, image.originalname, image.buffer, image.mimetype, image.size]
            ));
            const resultInsertImage = await Promise.all(insertQueries);
            const someInsertFalied = resultInsertImage.some(result => result.rowCount === 0);
            
            if(someInsertFalied){
                await client.query("ROLLBACK")
                return res.status(400).json({msg: "Ocurrió un error inesperado y no se pudo actualizar el producto."})
            }
        }

        

        const resultUpdateProduct = await client.query(`
            UPDATE products SET 
                product_name = $1, 
                product_description = $2, 
                product_price = $3, 
                product_category = $4,
                stock = $5
            WHERE id = $6;`, 
            [product_name, product_description, product_price, product_category, product_stock, product_id]
        );

        if(resultUpdateProduct.rowCount === 0){
            await client.query("ROLLBACK")
            return res.status(400).json({msg: "Ocurrió un error inesperado y no se pudo actualizar el producto."})
        }

        await client.query("COMMIT")
        res.status(200).json({ msg: "Producto actualizado con éxito" });

    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        res.status(500).json({ msg: "Error en el servidor", error });
    } finally {
        if (client) client.release();
    }
};

const deleteProduct = async(req,res) => {
    const { product_id } = req.params;

    if (!product_id) return res.status(400).json({ msg: "Faltan datos importantes" });

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");
        const result1 = await client.query(`DELETE FROM product_images WHERE product_id = $1;`, [product_id]);

        if (result1.rowCount === 0){
            await client.query("ROLLBACK")
            return res.status(400).json({ msg: "No se pudo eliminar el producto" });
        }

        const result2 = await client.query(`DELETE FROM products WHERE id = $1;`, [product_id]);

        if (result2.rowCount === 0){
            await client.query("ROLLBACK")
            return res.status(400).json({ msg: "No se pudo eliminar el producto" });
        }

        await client.query("COMMIT")
        res.status(200).json({ msg: "Producto eliminado con exito" });
    } catch (error) {
        console.log(error)
        res.status(500).json({ msg: "Error interno del servidor al eliminar el producto" });
    } finally {
        if (client) client.release();
    }
}


module.exports = {
    saveProduct, getProducts, updateProduct, deleteProduct
}