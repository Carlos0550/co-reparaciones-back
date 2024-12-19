const { pool } = require("../config/database.js");

const editPageColors = async (req, res) => {
    const {
        headerColor,
        footerColor,
        contentColor,
        titleColor,
        subtitleColor,
        paragraphColor
    } = req.body

    if(!headerColor && !footerColor && !contentColor && !titleColor && !subtitleColor && !paragraphColor) return res.status(400).json({ msg: "Algunos datos obligatorios no fueron proporcionados" })
    const color_id = 1
    const query1 = `
        UPDATE color_settings SET header_color = $1, footer_color = $2, maincontent_color = $3, title_color = $4, subtitle_color = $5, paragraphs_color = $6 WHERE id = $7;`

    let client;
    try {
        client = await pool.connect()
        await client.query("BEGIN")
        await client.query(query1, [headerColor, footerColor, contentColor, titleColor, subtitleColor, paragraphColor, color_id])
        await client.query("COMMIT")
        return res.status(200).json({ msg: "Colores actualizados con exito" })
    } catch (error) {
        await client.query("ROLLBACK")
        console.error(error)
        return res.status(500).json({ msg: "Error al actualizar los colores de la pagina" })
    } finally {
        if (client) client.release()
    }
}

const getPageColors = async (req, res) => {
    const query1 = `
    SELECT * FROM color_settings WHERE id = 1;
    `

    let client;
    try {
        client = await pool.connect()
        const result = await client.query(query1)
        console.log(result.rows)
        return res.status(200).json({
            headerColor: result.rows[0]?.header_color,
            footerColor: result.rows[0]?.footer_color,
            contentColor: result.rows[0]?.maincontent_color,
            titleColor: result.rows[0]?.title_color,
            subtitleColor: result.rows[0]?.subtitle_color,
            paragraphColor: result.rows[0]?.paragraphs_color
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ msg: "Error al obtener los colores de la pagina" })
    } finally {
        if (client) client.release()
    }
}

module.exports = { editPageColors, getPageColors }