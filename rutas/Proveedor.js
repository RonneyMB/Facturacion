const { db, express } = require("../config");
const routerProveedor = express.Router();
const Joi = require("joi");
//validamos el json por ensima
// const schema = Joi.object({
//   cod: Joi.number().required(),
//   nombre: Joi.string().required(),
//   descripcion: Joi.string().required(),
//   cantidad: Joi.number().required(),
//   precio: Joi.number().required(),
//   tipo: Joi.string().required(),
//   medicion: Joi.string().required(),
//   stockmin: Joi.number().required(),
//   stockmax: Joi.number().required(),
// });
// const { error } = schema.validate(req.body);
// if (error) {
//   return res.status(400).send({
//     res: false,
//     msg: `Validation error: ${error.details[0].message}`,
//   });
// }

routerProveedor.post("/Registrar", async (req, res) => {
  //Extraigo las propiedades del cuerpo de la solicitud directamente al desestructurarlas

  console.log(req.body);
  const { rif, nombre, direccion, correo, tipoRif, ultimoNumero, tlf } =
    req.body;
  const estado = true;

  try {
    const querysql =
      "INSERT INTO proveedor (rif, nombre, direccion, correo, tipoRif, ultimoNumero, tlf, estado) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?)";
    const [result] = await db.execute(querysql, [
      rif,
      nombre,
      direccion,
      correo,
      tipoRif,
      ultimoNumero,
      tlf,
      estado,
    ]);
    res.send({ res: true, msg: "Registro exitoso" });
    // Obtener el ID autoincremental const proveedorId = result.
    console.log({ res: true, msg: "Registro exitoso" });
    const proveedorId = result.insertId;
    console.log(proveedorId);
  } catch (error) {
    console.error("Error al registrar en la base de datos:", error.stack);
    res.status(500).send({ res: false, msg: "Error al registrar" });
  }
});
routerProveedor.get("/Datos", async (req, res) => {
  try {
    const querysql = "SELECT * FROM proveedor ORDER BY id";
    const [result] = await db.execute(querysql);
    //este es un condicional corto
    const msg2 =
      result.length > 0
        ? "se encontraron registros"
        : "no se ha realizado ningún registro";

    console.log({ res: result, msg: msg2 });

    res.status(500).send({ res: result, msg: msg2 });
  } catch (error) {
    console.error("Error al registrar en la base de datos:", error.stack);
    res.status(500).send({ res: false, msg: "Error al mostrar datos" });
  }
});

routerProveedor.put("/Actualizar", async (req, res) => {
  const schema = Joi.object({
    id: Joi.number().required(),
    rif: Joi.number().optional(),
    nombre: Joi.string().optional(),
    direccion: Joi.string().optional(),
    correo: Joi.string().email().optional(),
    tipoRif: Joi.string().optional(),
    ultimoNumero: Joi.number().optional(),
    tlf: Joi.number().optional(),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).send({ res: false, msg: error.details[0].message });
  }

  const { id, rif, nombre, direccion, correo, tipoRif, ultimoNumero, tlf } =
    value;

  // Verificar si las variables no están vacías
  const fieldsToUpdate = [];
  const valuesToUpdate = [];

  if (rif) {
    fieldsToUpdate.push("rif = ?");
    valuesToUpdate.push(rif);
  }
  if (nombre) {
    fieldsToUpdate.push("nombre = ?");
    valuesToUpdate.push(nombre);
  }
  if (direccion) {
    fieldsToUpdate.push("direccion = ?");
    valuesToUpdate.push(direccion);
  }
  if (correo) {
    fieldsToUpdate.push("correo = ?");
    valuesToUpdate.push(correo);
  }
  if (tipoRif) {
    fieldsToUpdate.push("tipoRif = ?");
    valuesToUpdate.push(tipoRif);
  }
  if (ultimoNumero) {
    fieldsToUpdate.push("ultimoNumero = ?");
    valuesToUpdate.push(ultimoNumero);
  }
  if (tlf) {
    fieldsToUpdate.push("tlf = ?");
    valuesToUpdate.push(tlf);
  }

  valuesToUpdate.push(id); // Añadir ID al final

  try {
    if (fieldsToUpdate.length > 0) {
      const querysql = `UPDATE proveedor SET ${fieldsToUpdate.join(
        ", "
      )} WHERE proveedor.id = ?`;
      await db.execute(querysql, valuesToUpdate);
      res.send({ res: true, msg: "Registro actualizado exitosamente" });
    } else {
      res.status(400).send({
        res: false,
        msg: "No se proporcionaron campos para actualizar",
      });
    }
  } catch (error) {
    console.error("Error al actualizar en la base de datos:", error.stack);
    res.status(500).send({ res: false, msg: "Error al actualizar" });
  }
});

routerProveedor.patch("/Estado", async (req, res) => {
  const { id, estado, token } = req.body;
  let msg =
    estado === true
      ? "Se ha activado un proveedor"
      : "Se ha desactivado un proveedor";

  try {
    const querysql = "UPDATE proveedor SET estado=? WHERE proveedor.id = ?";

    const [result] = await db.execute(querysql, [estado, id]);

    res.status(500).send({ res: true, msg });
  } catch (error) {
    console.error("Error al registrar en la base de datos:", error.stack);
    res
      .status(500)
      .send({ res: false, msg: "Ha ocurrido un error inesperado" });
  }
});
routerProveedor.delete("/Eliminar/:id", async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(403).send({
      res: false,
      msg: "Acceso denegado. Token no proporcionado o incorrecto.",
    });
  }

  const token = authHeader.split(" ")[1];

  // Aquí puedes agregar lógica para validar el token
  if (!validarToken(token)) {
    return res
      .status(403)
      .send({ res: false, msg: "Acceso denegado. Token inválido." });
  }

  try {
    const querysql = "DELETE FROM proveedor WHERE id = ?";
    await db.execute(querysql, [id]);

    res.send({ res: true, msg: "proveedor eliminado exitosamente" });
  } catch (error) {
    console.error(
      "Error al eliminar el proveedor en la base de datos:",
      error.stack
    );
    res
      .status(500)
      .send({ res: false, msg: "Ha ocurrido un error inesperado" });
  }
});

// Función ficticia para validar el token
function validarToken(token) {
  // Lógica de validación del token
  return token === "tu_token_secreto";
}

module.exports = routerProveedor;
// 1)proveedor
// 2)materia prima
// 3)produto fabricable
// 4)materia fabricable
// 5)multi uso
// 6)herramientas
