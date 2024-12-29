const { db, express } = require("../config");
const routerProductos = express.Router();
const Joi = require("joi");

routerProductos.post("/Registrar", async (req, res) => {
  //Extraigo las propiedades del cuerpo de la solicitud directamente al desestructurarlas
  //validamos el json por ensima
  const schema = Joi.object({
    cod: Joi.number().required(),
    nombre: Joi.string().required(),
    descripcion: Joi.string().required(),
    cantidad: Joi.number().required(),
    precio: Joi.number().required(),
    tipo: Joi.string().required(),
    medicion: Joi.string().required(),
    stockmin: Joi.number().required(),
    stockmax: Joi.number().required(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).send({
      res: false,
      msg: `Validation error: ${error.details[0].message}`,
    });
  }
  console.log(req.body);
  const {
    cod,
    nombre,
    descripcion,
    cantidad,
    precio,
    tipo,
    medicion,
    stockmin,
    stockmax,
  } = req.body;
  const estado = true;
  const version = 0;
  try {
    const querysql =
      "INSERT INTO producto (cod, nombre, descripcion, cantidad, precio, tipo, medicion, stockmin, stockmax, version, estado) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const [result] = await db.execute(querysql, [
      cod,
      nombre,
      descripcion,
      cantidad,
      precio,
      tipo,
      medicion,
      stockmin,
      stockmax,
      version,
      estado,
    ]);
    res.send({ res: true, msg: "Registro exitoso" });
    // Obtener el ID autoincremental const productoId = result.
    console.log({ res: true, msg: "Registro exitoso" });
    const productoId = result.insertId;
    console.log(productoId);
  } catch (error) {
    console.error("Error al registrar en la base de datos:", error.stack);
    res.status(500).send({ res: false, msg: "Error al registrar" });
  }
});
routerProductos.get("/Datos", async (req, res) => {
  try {
    const querysql = "SELECT * FROM producto ORDER BY id";
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
routerProductos.put("/Actualizar", async (req, res) => {
  const schema = Joi.object({
    id: Joi.number().required(),
    cod: Joi.number().optional(),
    nombre: Joi.string().optional(),
    descripcion: Joi.string().optional(),
    cantidad: Joi.number().optional(),
    precio: Joi.number().optional(),
    tipo: Joi.string().optional(),
    medicion: Joi.string().optional(),
    stockmin: Joi.number().optional(),
    stockmax: Joi.number().optional(),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).send({ res: false, msg: error.details[0].message });
  }

  const {
    id,
    cod,
    nombre,
    descripcion,
    cantidad,
    precio,
    tipo,
    medicion,
    stockmin,
    stockmax,
  } = value;

  const fieldsToUpdate = [];
  const valuesToUpdate = [];

  if (cod) {
    fieldsToUpdate.push("cod = ?");
    valuesToUpdate.push(cod);
  }
  if (nombre) {
    fieldsToUpdate.push("nombre = ?");
    valuesToUpdate.push(nombre);
  }
  if (descripcion) {
    fieldsToUpdate.push("descripcion = ?");
    valuesToUpdate.push(descripcion);
  }
  if (cantidad) {
    fieldsToUpdate.push("cantidad = cantidad + ?");
    valuesToUpdate.push(cantidad);
  }
  if (precio) {
    fieldsToUpdate.push("precio = ?");
    valuesToUpdate.push(precio);
  }
  if (tipo) {
    fieldsToUpdate.push("tipo = ?");
    valuesToUpdate.push(tipo);
  }
  if (medicion) {
    fieldsToUpdate.push("medicion = ?");
    valuesToUpdate.push(medicion);
  }
  if (stockmin) {
    fieldsToUpdate.push("stockmin = ?");
    valuesToUpdate.push(stockmin);
  }
  if (stockmax) {
    fieldsToUpdate.push("stockmax = ?");
    valuesToUpdate.push(stockmax);
  }

  let attempt = 0;
  let updated = false;

  while (attempt < 5 && !updated) {
    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // Obtener la versión actual y realizar la primera consulta
      const [rows] = await connection.execute(
        "SELECT version FROM producto WHERE id = ?",
        [id]
      );
      if (rows.length === 0) {
        throw new Error("Producto no encontrado");
      }

      const currentVersion = rows[0].version;
      const newVersion = currentVersion + 1;

      fieldsToUpdate.push("version = ?");
      valuesToUpdate.push(newVersion);
      valuesToUpdate.push(id); // Añadir ID al final
      valuesToUpdate.push(currentVersion); // Añadir versión actual al final

      if (fieldsToUpdate.length > 0) {
        const querysql = `UPDATE producto SET ${fieldsToUpdate.join(
          ", "
        )} WHERE id = ? AND version = ?`;
        const [result] = await connection.execute(querysql, valuesToUpdate);

        if (result.affectedRows === 0) {
          attempt++;
          console.log(
            `Intento ${attempt} fallido: La versión del producto ha cambiado`
          );
          await connection.rollback();
          continue;
        }

        // Puedes agregar más consultas aquí si lo necesitas
        // await connection.execute(otraConsulta, otrosValores);

        await connection.commit();
        updated = true;
        res.send({ res: true, msg: "Registro actualizado exitosamente" });
      } else {
        throw new Error("No se proporcionaron campos para actualizar");
      }
    } catch (error) {
      console.error("Error al actualizar en la base de datos:", error.stack);
      if (attempt === 4) {
        res.status(500).send({
          res: false,
          msg: "No se pudo actualizar. Por favor, inténtelo más tarde.",
        });
      }
    } finally {
      if (connection) connection.release();
    }
  }
});

routerProductos.patch("/Estado", async (req, res) => {
  const { id, estado, token } = req.body;
  let msg =
    estado === true
      ? "Se ha activado un producto"
      : "Se ha desactivado un producto";

  try {
    const querysql = "UPDATE producto SET estado=? WHERE producto.id = ?";

    const [result] = await db.execute(querysql, [estado, id]);

    res.status(500).send({ res: true, msg });
  } catch (error) {
    console.error("Error al registrar en la base de datos:", error.stack);
    res
      .status(500)
      .send({ res: false, msg: "Ha ocurrido un error inesperado" });
  }
});
routerProductos.delete("/Eliminar/:id", async (req, res) => {
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
    const querysql = "DELETE FROM producto WHERE id = ?";
    await db.execute(querysql, [id]);

    res.send({ res: true, msg: "producto eliminado exitosamente" });
  } catch (error) {
    console.error(
      "Error al eliminar el producto en la base de datos:",
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

module.exports = routerProductos;
// 1)producto
// 2)materia prima
// 3)produto fabricable
// 4)materia fabricable
// 5)multi uso
// 6)herramientas
