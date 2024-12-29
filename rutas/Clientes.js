const { db, express } = require("../config");
const routerClientes = express.Router();
const Joi = require("joi");
routerClientes.post("/Registrar", async (req, res) => {
  //Extraigo las propiedades del cuerpo de la solicitud directamente al desestructurarlas
  // (const { nombre, cedulaRif, tipo, ultimoNumero, token } = req.body;).
  const { nombre, cedulaRif, direccion, tlf, tipo, ultimoNumero, token } =
    req.body;
  const estado = true;
  //const facturaId = result.insertId;
  try {
    const querysql =
      "INSERT INTO cliente (nombre, cedulaRif, direccion , tlf, tipo, ultimoNumero, estado) VALUES (?, ?, ?, ?, ?,?,?)";
    const [result] = await db.execute(querysql, [
      nombre,
      cedulaRif,
      direccion,
      tlf,
      tipo,
      ultimoNumero,
      estado,
    ]);
    res.send({ res: true, msg: "Registro exitoso" });
    // Obtener el ID autoincremental const clienteId = result.
    console.log({ res: true, msg: "Registro exitoso" });
    const clienteId = result.insertId;
    console.log(clienteId);
  } catch (error) {
    console.error("Error al registrar en la base de datos:", error.stack);
    res.status(500).send({ res: false, msg: "Error al registrar" });
  }
});
routerClientes.get("/Datos", async (req, res) => {
  try {
    const querysql = "SELECT * FROM cliente ORDER BY id";
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

routerClientes.put("/Actualizar", async (req, res) => {
  const schema = Joi.object({
    id: Joi.number().required(),
    nombre: Joi.string().optional(),
    cedulaRif: Joi.number().optional(),
    direccion: Joi.string().optional(),
    tlf: Joi.string().optional(),
    tipo: Joi.string().optional(),
    ultimoNumero: Joi.number().optional(),
    token: Joi.string().optional(),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).send({ res: false, msg: error.details[0].message });
  }

  const { nombre, cedulaRif, direccion, tlf, tipo, ultimoNumero, id, token } =
    value;

  // Verificar si las variables no están vacías
  const fieldsToUpdate = [];
  const valuesToUpdate = [];

  if (nombre) {
    fieldsToUpdate.push("nombre = ?");
    valuesToUpdate.push(nombre);
  }
  if (cedulaRif) {
    fieldsToUpdate.push("cedulaRif = ?");
    valuesToUpdate.push(cedulaRif);
  }
  if (direccion) {
    fieldsToUpdate.push("direccion = ?");
    valuesToUpdate.push(direccion);
  }
  if (tlf) {
    fieldsToUpdate.push("tlf = ?");
    valuesToUpdate.push(tlf);
  }
  if (tipo) {
    fieldsToUpdate.push("tipo = ?");
    valuesToUpdate.push(tipo);
  }
  if (ultimoNumero) {
    fieldsToUpdate.push("ultimoNumero = ?");
    valuesToUpdate.push(ultimoNumero);
  }

  valuesToUpdate.push(id); // Añadir ID al final

  try {
    if (fieldsToUpdate.length > 0) {
      const querysql = `UPDATE cliente SET ${fieldsToUpdate.join(
        ", "
      )} WHERE cliente.id = ?`;
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

routerClientes.patch("/Estado", async (req, res) => {
  const { id, estado, token } = req.body;
  let msg =
    estado === true
      ? "Se ha activado un cliente"
      : "Se ha desactivado un cliente";

  try {
    const querysql = "UPDATE cliente SET estado=? WHERE cliente.id = ?";
    // const querysqlWithValues = `UPDATE cliente SET estado=${estado} WHERE cliente.id = ${id}`;

    //  Imprimir la consulta completa con los valores
    // console.log("Consulta SQL:", querysqlWithValues);

    const [result] = await db.execute(querysql, [estado, id]);

    res.status(500).send({ res: true, msg });
  } catch (error) {
    console.error("Error al registrar en la base de datos:", error.stack);
    res
      .status(500)
      .send({ res: false, msg: "Ha ocurrido un error inesperado" });
  }
});
routerClientes.delete("/Eliminar/:id", async (req, res) => {
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
    const querysql = "DELETE FROM cliente WHERE id = ?";
    await db.execute(querysql, [id]);

    res.send({ res: true, msg: "Cliente eliminado exitosamente" });
  } catch (error) {
    console.error(
      "Error al eliminar el cliente en la base de datos:",
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

module.exports = routerClientes;
