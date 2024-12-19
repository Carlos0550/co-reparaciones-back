require("dotenv").config()
const cripto = require("crypto")

const ALGORITHM = "aes-256-ctr"
const secretKey = process.env.secret_crypt_key
const iv_length = 16

const encriptar = (data) => {
    try {
        const iv = cripto.randomBytes(iv_length)
        const cipher = cripto.createCipheriv(ALGORITHM, Buffer.from(secretKey), iv)
        let encriptado = cipher.update(data);
        encriptado = Buffer.concat([encriptado, cipher.final()]);
        return iv.toString('hex') + ':' + encriptado.toString('hex');
    } catch (error) {
        console.log(error)
    }
}

const desencriptar = (textoEncriptado) => {
    try {
        const partes = textoEncriptado.split(':');
        if (partes.length !== 2) {
            console.error('El texto encriptado no tiene el formato correcto');
            return null;
          }
        const iv = Buffer.from(partes[0], 'hex');
        const contenidoEncriptado = Buffer.from(partes[1], 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(secretKey), iv);
        let desencriptado = decipher.update(contenidoEncriptado);
        desencriptado = Buffer.concat([desencriptado, decipher.final()]);
        return desencriptado.toString();
    } catch (error) {
        console.log(error)
    }
  };
  
  module.exports = { encriptar, desencriptar };