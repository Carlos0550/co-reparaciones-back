const { pool } = require("../config/database.js");

const saveBanner = async (req, res) => {
    const { banner_name } = req.body;
    const bannerImages = req.files;

    if (!bannerImages || bannerImages.length === 0) {
        return res.status(400).json({ msg: "Por favor ingrese al menos una imagen" });
    }

    const client = await pool.connect();

    const values = [];
    const query = `INSERT INTO banners(banner_name) VALUES ($1) RETURNING id;`;
    let query1 = `INSERT INTO banner_images(banner_id, image_name, image_type, image_size, image_data) VALUES `;

    bannerImages.forEach((image, index) => {
        values.push(`($1, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4}, $${index * 4 + 5})`);
    });

    query1 += values.join(', ');
    
    try {
        await client.query('BEGIN');  
        const response = await client.query(query, [banner_name || "Sin nombre"]);
        if (response.rowCount === 0) {
            await client.query('ROLLBACK'); 
            return res.status(400).json({ msg: "No se pudo guardar el banner" });
        }
        const banner_id = response.rows[0].id;
        console.log('Banner guardado con ID:', banner_id);

        await client.query(query1, [banner_id, ...bannerImages.map(image => [image.originalname, image.mimetype, image.size, image.buffer]).flat()]);

        await client.query('COMMIT'); 
        res.status(200).json({ msg: 'Banners guardados exitosamente' });
    } catch (error) {
        await client.query('ROLLBACK');  
        console.log('Error al guardar los banners:', error);
        res.status(500).json({ msg: 'Error al guardar los banners', error: error.message });
    } finally {
        client.release();
    }
};

const getBanners = async (req, res) => {
    const query = `
        SELECT 
        b.*, bi.*
        FROM banners b
        LEFT JOIN banner_images bi ON b.id = bi.banner_id
        ORDER BY b.id ASC
    `;

    let client = await pool.connect();
    try {
        const response = await client.query(query);
        if (response.rowCount === 0) {
            return res.status(404).json({ msg: "No se encontraron banners" });
        }

        const bannerImages = response.rows.map(image => {
            let imageBase64Url = null;

            if (image.image_data) {
                const base64Image = image.image_data.toString("base64");
                imageBase64Url = `data:${image.image_type};base64,${base64Image}`;
            }

            return {
                ...image,
                image_data: imageBase64Url
            };
        });

        const groupedBanners = bannerImages.reduce((acc, banner) => {
            if (!acc[banner.banner_id]) {
                acc[banner.banner_id] = {
                    banner_id: banner.banner_id,
                    banner_name: banner.banner_name,
                    images: []
                };
            }

            if (banner.image_data) { 
                acc[banner.banner_id].images.push({
                    image_name: banner.image_name,
                    image_type: banner.image_type,
                    image_size: banner.image_size,
                    image_data: banner.image_data
                });
            }

            return acc;
        }, {});

        const result = Object.values(groupedBanners);

        return res.status(200).json({
            msg: "Banners encontrados con éxito",
            banners: result
        });
    } catch (error) {
        console.log('Error al obtener los banners:', error);
        return res.status(500).json({
            msg: 'Error al obtener los banners',
            error: error.message
        });
    } finally {
        client.release();
    }
};

const deleteBanner = async(req,res) => {

    const { banner_id } = req.params
    if(!banner_id) return res.status(400).json({ msg: "El servidor no pudo eliminar el banner seleccionado. Por favor intente nuevamente" })

    const query1 = `DELETE FROM banner_images WHERE banner_id = $1`
    const query2 = `DELETE FROM banners WHERE id = $1`

    let client;
    try {
        client = await pool.connect()
        await client.query('BEGIN')
        await client.query(query1, [banner_id])
        await client.query(query2, [banner_id])
        await client.query('COMMIT')
        return res.status(200).json({ msg: "Banner eliminado con éxito" })
    } catch (error) {
        client.query('ROLLBACK')
        console.log('Error al eliminar el banner:', error);
        return res.status(500).json({ msg: 'Error al eliminar el banner', error: error.message });
    } finally {
        if(client) client.release();
    }
}

const editBanners = async (req, res) => {
    const { banner_name, imagesWithEdit } = req.body;
    const bannerImages = req.files;
    const {banner_id} = req.params

    const query1 = `UPDATE banners SET banner_name = $1 WHERE id = $2`
    const query2 = `DELETE FROM banner_images WHERE image_name = ANY($1) AND banner_id = $2`
    let query3 = `INSERT INTO banner_images(banner_id, image_name, image_type, image_size, image_data) VALUES`
    const query4 = `SELECT image_name, id FROM banner_images WHERE banner_id = $1`

    let client;
    try {
        client = await pool.connect()
        await client.query("BEGIN")

        const imagesInBd = await client.query(query4, [banner_id])
        const imagesInBdNames = imagesInBd.rows.map(image => image.image_name)

        const imagesWithEditParsed = JSON.parse(imagesWithEdit);

        const imagesToKeep = imagesWithEditParsed.map(image => image.editing === true ? image.image_name : "").filter(image => image !== "");
        const imagesToDelete = imagesInBdNames.filter(img => !imagesToKeep.includes(img))
        const imagesToInsert = bannerImages.filter(img => !imagesWithEditParsed.some(i => i.image_name === img.originalname && i.editing))
        
        if(imagesToDelete.length > 0){
            const result =await client.query(query2, [imagesToDelete, banner_id])
            
            if(result.rowCount === 0) throw new Error("Ocurrió un error al eliminar las imagenes antiguas.")
        }
        const values = []
        if(imagesToInsert.length > 0){
            imagesToInsert.map((_, idx) => {
                values.push(`
                    ($1, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4}, $${idx * 4 + 5})
            `)
            })

            query3 += values.join(", ")
            const result1 = await client.query(query3,[banner_id, ...imagesToInsert.map(image => [image.originalname, image.mimetype, image.size, image.buffer]).flat()])
            if(result1.rowCount === 0) throw new Error("Ocurrio un error al insertar las nuevas imagenes")
        }
        const result2 = await client.query(query1, [banner_name, banner_id])

        if(result2.rowCount === 0) throw new Error("Ocurrio un error al actualizar el banner")

        await client.query('COMMIT')
        return res.status(200).json({ msg: "Banner actualizado conxito" })
    } catch (error) {
        console.log(error)
        await client.query('ROLLBACK')
        return res.status(500).json({ msg: "Error al actualizar el banner", error: error.message })
    }finally{
        if(client) client.release()
    }
}

module.exports = { saveBanner, getBanners, deleteBanner, editBanners };