const { pool } = require("../config/database.js")

const savePromotion = async(req,res) => {
    const { 
        promotion_name,
        promotion_description,
        promotion_start_date,
        promotion_end_date,
        promotion_type,
        promotion_value,
        promotion_products,
        product_id,
        promotion_discount

     } = req.body
    const promotion_images = req.files

    if(!promotion_name || promotion_images?.length === 0 || !promotion_type || !promotion_start_date || !promotion_end_date) return res.status(400).json({ msg: "Faltan datos importantes" })

    if(promotion_type === "single" && !product_id) return res.status(400).json({ msg: "Faltan datos importantes" })
    if(promotion_type === "multiple" && (!promotion_products || !promotion_value)) return res.status(400).json({ msg: "Faltan datos importantes" })
    
    let client;
    const query1 = `
        INSERT INTO promotions(promotion_name, promotion_starts, promotion_ends, promotion_state, promotion_type) VALUES($1, $2, $3, $4, $5) RETURNING id
    `
    const query2 = `
        INSERT INTO promotions_data(product_id, promotion_id, promotions_description, promotion_products_array, promotion_discount) VALUES($1,$2, $3, $4, $5)
    `
    const query3 = `
        INSERT INTO promotions_images(
            promotion_id,
            image_name,
            image_type,
            image_size,
            image_data
        ) VALUES($1, $2, $3, $4, $5)
    `

    try {
        client = await pool.connect()
        await client.query("BEGIN")

        const response1 = await client.query(query1,[promotion_name, promotion_start_date, promotion_end_date, false, promotion_type])

        if(response1.rowCount === 0) throw new Error("No se pudo registrar la promocion")
        console.log("Promocion insertada con exito")
        const promotion_id = response1.rows[0].id
        

        if(promotion_type === "single"){
            const response2 = await client.query(query2,[product_id, promotion_id,promotion_description || "", null, promotion_discount])
            if(response2.rowCount === 0) throw new Error("No se pudo registrar los datos de la promocion")
            console.log("Datos de la Promocion simple insertados con exito")
        }else{
            const response2 = await client.query(query2, [null, promotion_id,promotion_description || "", promotion_products, promotion_discount])  
            if(response2.rowCount === 0) throw new Error("No se pudo registrar los datos de la promocion")
            console.log("Datos de la Promocion multiple insertados con exito")
        }

        const imagesInsertPromises = promotion_images.map(image => {
            const imageValues = [
                promotion_id,
                image.originalname,
                image.mimetype,
                image.size,
                image.buffer
            ]

            return client.query(query3, imageValues).catch(err => {
                console.log(err)
                throw new Error("No se pudieron registrar las imagenes de la promocion")
            })
        })

        const imagesResponses = await Promise.all(imagesInsertPromises) 
        const totalInsertedImages = imagesResponses.reduce((acc, imgRes)=>  acc + imgRes.rowCount ,0)
        if(totalInsertedImages !== promotion_images.length) throw new Error("No se pudieron registrar las imagenes de la promocion")
        console.log("Imagenes de la promocion insertadas con exito")

        await client.query("COMMIT")
        res.status(200).json({msg: "Promocion registrada con exito"})
    } catch (error) {
        console.error(error)
        await client.query("ROLLBACK")
        res.status(500).json({msg: error.message || "Error interno del servidor al registrar la promocion"})
    }finally{
        if(client) client.release()
    }
}

const getPromotions = async(req,res) => {
    const query1 = `
        SELECT 
        p.id AS promotion_id, 
        pd.id AS promotion_data_id, 
        pi.id AS image_id, 
        p.*, 
        pd.*, 
        pi.*
    FROM promotions p
    LEFT JOIN promotions_data pd ON p.id = pd.promotion_id
    LEFT JOIN promotions_images pi ON p.id = pi.promotion_id;

    `
    const client = await pool.connect()
    try {
        const response = await client.query(query1)

        if(response.rowCount === 0) return res.status(404).json({msg: "No hay promociones registradas"})

         const promotions = response.rows.map(promotion => {
            let imageBase64Url = null;
            
            if (promotion.image_data) {
                const base64Image = promotion.image_data.toString("base64");
                imageBase64Url = `data:${promotion.image_type};base64,${base64Image}`;
            }

            return {
                ...promotion,
                image: imageBase64Url
            }
        });

    
        const groupedPromotions = promotions.reduce((acc, promotion) => {
            if (!acc[promotion.promotion_id]) {
                acc[promotion.promotion_id] = {
                    promotion_id: promotion.promotion_id,
                    promotion_name: promotion.promotion_name,
                    promotion_starts: promotion.promotion_starts,
                    promotion_ends: promotion.promotion_ends,
                    promotion_state: promotion.promotion_state,
                    promotion_type: promotion.promotion_type,
                    promotion_discount: promotion.promotion_discount,
                    promotion_data: {
                        promotion_data_id: promotion.promotion_data_id,
                        promotion_description: promotion.promotions_description,
                        promotion_products_array: JSON.parse(promotion.promotion_products_array),
                        product_id: promotion.product_id
                    },
                    images: []
                }
            }

            if (promotion.image_id) {
                acc[promotion.promotion_id].images.push({
                    image_id: promotion.image_id,
                    image_name: promotion.image_name,
                    image_type: promotion.image_type,
                    image_size: promotion.image_size,
                    image: promotion.image
                });
            }

            return acc;
        }, {});

        const result = Object.values(groupedPromotions);
        return res.status(200).json({promotions: result})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg: "Error interno del servidor al obtener las promociones"})
    }finally{
        if(client) client.release()
    }
}

const deletePromotion = async(req,res) => {
    const { promotion_id } = req.params;

    if(!promotion_id) return res.status(400).json({msg: "Faltan datos importantes"})

    const client = await pool.connect()
    try {
        await client.query("BEGIN")
        const response1 = await Promise.all([
            client.query(`DELETE FROM promotions_images WHERE promotion_id = $1;`, [promotion_id]),
            client.query(`DELETE FROM promotions_data WHERE promotion_id = $1;`, [promotion_id]),
            client.query(`DELETE FROM promotions WHERE id = $1;`, [promotion_id]),
        ])

        if(response1.some(res => res.rowCount === 0)){
            throw new Error("Algo salio mal al eliminar la promocion, por favor, recargue esta seccion e intente nuevamente.") 
        }

        await client.query("COMMIT")
        res.status(200).json({msg: "Promocion eliminada con exito"})
    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        res.status(500).json({msg: error.message || "Error interno del servidor al eliminar la promocion"})
    }finally{
        if(client) client.release()
    }
}

const editPromotion = async(req,res) => {
    const { 
        promotion_name,
        promotion_description,
        promotion_start_date,
        promotion_end_date,
        promotion_type,
        promotion_value,
        promotion_products,
        product_id,
        imagesWithEdit,
        promotion_state,
        promotion_discount
     } = req.body
     const { promotion_id } = req.params
    const promotion_images = req.files

    console.log("Promocion: ", req.body)
    if(!promotion_name || !promotion_id || !promotion_type || !promotion_start_date || !promotion_end_date) return res.status(400).json({ msg: "Faltan datos importantes" })

    if(promotion_type === "single" && !product_id) return res.status(400).json({ msg: "Faltan datos importantes" })
    if(promotion_type === "multiple" && (!promotion_products || !promotion_value)) return res.status(400).json({ msg: "Faltan datos importantes" })
    
    let client;
    
    try {
        client = await pool.connect()
        await client.query("BEGIN")
        
        const imagesList = await client.query(`SELECT image_name FROM promotions_images WHERE promotion_id = $1;`, [promotion_id]);
        const existentImages = imagesList.rows.map(row => row.image_name);

        console.log("Images Existentes en esta promo: ", existentImages.length)

        const parsedImages = JSON.parse(imagesWithEdit);
        const imagesToKeep = parsedImages.map(image => image.editing === true ? image.image_name : "").filter(image => image !== "");
        console.log("Imagenes a Skipear: ", imagesToKeep.length)
        const imagesToDelete = existentImages.filter(img => !imagesToKeep.includes(img))
        console.log("Imagenes a borrar: ", imagesToDelete.length)
        const newImages = promotion_images.filter(img => !parsedImages.some(i => i.image_name === img.originalname && i.editing))
        console.log("Images nuevas: ", newImages.length)
        if(imagesToDelete.length > 0) {
            const resultDelete = await client.query(
                `DELETE FROM promotions_images WHERE image_name = ANY($1) AND promotion_id = $2;`, 
                [imagesToDelete, promotion_id]
            );
            
            if(resultDelete.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({ msg: "Ocurrio un error inesperado y no se pudo actualizar la promocion." });
            }
        }

        if(newImages.length > 0) {
            const insertQueries = promotion_images.map(image => client.query(`
                INSERT INTO promotions_images (promotion_id, image_name, image_data, image_type, image_size) 
                VALUES ($1, $2, $3, $4, $5);`, 
                [promotion_id, image.originalname, image.buffer, image.mimetype, image.size]
            ));
            const resultInsertImage = await Promise.all(insertQueries);
            const someInsertFalied = resultInsertImage.some(result => result.rowCount === 0);

            if(someInsertFalied) {
                await client.query("ROLLBACK");
                return res.status(400).json({ msg: "Ocurrio un error inesperado y no se pudo actualizar la promocion." });
            }
        }

        const stateOfPromotion = promotion_state === "true" ? true : false
        console.log("Tipo de promoción: ",promotion_type)
        const resultUpdate1 = await client.query(
                `UPDATE promotions SET promotion_name = $1, promotion_starts = $2, promotion_ends = $3, promotion_state = $4, promotion_type = $5 WHERE id = $6;`,
            [promotion_name, promotion_start_date, promotion_end_date, stateOfPromotion, promotion_type, promotion_id])
        
        if(resultUpdate1.rowCount === 0) {
            throw new Error("Algo salio mal al editar la promocion, por favor, recargue esta seccion e intente nuevamente.")
        }

        const resultUpdate2 = await client.query(
            `UPDATE promotions_data SET product_id = $1, promotions_description = $2, promotion_products_array = $3, promotion_discount = $4 WHERE promotion_id = $5;`,
            [product_id || null, promotion_description, promotion_products || null, promotion_discount || 0, promotion_id]
        )

        if(resultUpdate2.rowCount === 0) {
            throw new Error("Algo salio mal al editar la promocion, por favor, recargue esta seccion e intente nuevamente.")
        }
        
        await client.query("COMMIT")
        res.status(200).json({msg: "Promocion editada con exito"})
    } catch (error) {
        console.log(error)
        await client.query("ROLLBACK")
        res.status(500).json({msg: error.message || "Error interno del servidor al editar la promocion"})
    }finally{
        if(client) client.release()
    }
    
}

module.exports = { 
    savePromotion,
    getPromotions,
    deletePromotion,
    editPromotion
 }