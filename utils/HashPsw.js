require("dotenv").config()
const bcrypt = require("bcryptjs")
const hashPassword = async(password) => {
    try {
        const hash = await bcrypt.hash(password, 10)
        return hash
    } catch (error) {
        console.log(error)
        return null
    }
}

const verifyHashPassword = async (password, hashAlmacenado) => {
    try {
      const isValid = await bcrypt.compare(password, hashAlmacenado);
      return isValid;
    } catch (error) {
      console.error('Error al verificar la contraseña:', error);
      return null
    }
  };

module.exports = {hashPassword, verifyHashPassword}