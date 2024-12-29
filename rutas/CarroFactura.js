const { db, express } = require("../config");
const routerCarritoFactura = express.Router();
const Decimal = require("decimal.js");
const Joi = require("joi");

function validarToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(401).send({ res: false, msg: "Token no proporcionado" });
  }
  jwt.verify(token, "secreto", (err, decoded) => {
    // Reemplaza 'secreto' con tu clave secreta
    if (err) {
      return res.status(401).send({ res: false, msg: "Token inválido" });
    }
    req.usuarioId = decoded.id;
    next();
  });
}
function autorizarRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.role)) {
      return res.status(403).send({ res: false, msg: "Permiso denegado" });
    }
    next();
  };
}
//router.post("/adminEndpoint", validarToken, autorizarRoles("administrador"), async (req, res)

routerCarritoFactura.post("/RegistrarCarrito", async (req, res) => {
  // Definir esquema de validación
  const esquemaCarrito = Joi.object({
    usuario: Joi.number().integer().required(),
    producto: Joi.number().integer().required(),
    cantidad: Joi.number().required(),
    cliente: Joi.number().integer().required(),
  });

  // Validar datos
  const { error, value } = esquemaCarrito.validate(req.body);

  if (error) {
    // Enviar error de validación
    return res.status(400).send({ res: false, msg: error.details[0].message });
  }

  const { usuario, producto, cantidad, cliente } = value;
  let attempt = 0;
  let registered = false;

  while (attempt < 5 && !registered) {
    let connection;

    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // Verificar estado del producto, cliente y usuario
      const [productRows] = await connection.execute(
        "SELECT estado, version, cantidad FROM producto WHERE id = ?",
        [producto]
      );
      if (productRows.length === 0 || !productRows[0].estado) {
        throw new Error("Producto no encontrado o inactivo");
      }

      const [clienteRows] = await connection.execute(
        "SELECT estado FROM cliente WHERE id = ?",
        [cliente]
      );
      if (clienteRows.length === 0 || !clienteRows[0].estado) {
        throw new Error("Cliente no encontrado o inactivo");
      }

      const [usuarioRows] = await connection.execute(
        "SELECT estado FROM usuario WHERE id = ?",
        [usuario]
      );
      if (usuarioRows.length === 0 || !usuarioRows[0].estado) {
        throw new Error("Usuario no encontrado o inactivo");
      }

      const currentVersion = productRows[0].version;
      const currentCantidad = new Decimal(productRows[0].cantidad);

      const [carritoRows] = await connection.execute(
        "SELECT SUM(cantidadCarrito) as totalCarrito FROM carritofactura WHERE producto = ?",
        [producto]
      );
      const totalCarrito = new Decimal(carritoRows[0].totalCarrito || 0);

      // Verificar que la cantidad sea suficiente
      const totalRequired = new Decimal(cantidad).plus(totalCarrito);
      if (currentCantidad.minus(totalRequired).isNegative()) {
        throw new Error("Cantidad insuficiente en el inventario");
      }

      // Actualizar cantidad y versión del producto
      const newVersion = currentVersion + 1;
      const updateProductQuery =
        "UPDATE producto SET cantidad = ?, version = ? WHERE id = ? AND version = ?";
      const [updateResult] = await connection.execute(updateProductQuery, [
        currentCantidad.minus(cantidad).toString(),
        newVersion,
        producto,
        currentVersion,
      ]);

      if (updateResult.affectedRows === 0) {
        attempt++;
        console.log(
          `Intento ${attempt} fallido: La versión del producto ha cambiado`
        );
        await connection.rollback();
        continue;
      }

      // Registrar en carritofactura
      const insertCarritoQuery =
        "INSERT INTO carritofactura (usuario, producto, cantidadCarrito, cliente) VALUES (?, ?, ?, ?)";
      await connection.execute(insertCarritoQuery, [
        usuario,
        producto,
        cantidad,
        cliente,
      ]);

      await connection.commit();
      registered = true;
      res.send({ res: true, msg: "Registro exitoso" });
      console.log({ res: true, msg: "Registro exitoso" });
    } catch (error) {
      console.error("Error al registrar en la base de datos:", error.stack);
      if (attempt === 4) {
        res.status(500).send({
          res: false,
          msg: "No se pudo registrar. Por favor, inténtelo más tarde.",
        });
      }
    } finally {
      if (connection) connection.release();
    }
  }
});

routerCarritoFactura.get("/DatosCarrito/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [usuarioRows] = await db.execute(
      "SELECT estado FROM usuario WHERE id = ?",
      [id]
    );
    if (usuarioRows.length === 0 || !usuarioRows[0].estado) {
      throw new Error("Usuario no encontrado o inactivo");
    }
    const querysql =
      "SELECT * FROM carritofactura carro JOIN cliente c ON carro.cliente = c.id WHERE carro.usuario =?  AND estado =true";
    const [result] = await db.execute(querysql, [id]);
    //este es un condicional corto
    const msg2 =
      result.length > 0
        ? "se encontraron registros"
        : "no se ha realizado ningún registro";

    console.log({ res: result, msg: msg2 });

    res.status(500).send({ res: result, msg: msg2 });
  } catch (error) {
    console.error("se encontraron registros", error.stack);
    res.status(500).send({ res: false, msg: "Error al mostrar datos" });
  }
});

routerCarritoFactura.put("/ActualizarCarrito", async (req, res) => {
  const schema = Joi.object({
    id: Joi.number().integer().required(),
    cantidad: Joi.number().required(),
  });

  // Validar datos
  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).send({ res: false, msg: error.details[0].message });
  }

  const { id, usuario, producto, cantidad, cliente } = value;

  // Verificar si las variables no están vacías
  const fieldsToUpdate = [];
  const valuesToUpdate = [];

  if (cantidad) {
    fieldsToUpdate.push("cantidad = ?");
    valuesToUpdate.push(cantidad);
  }

  valuesToUpdate.push(id); // Añadir ID al final

  try {
    if (fieldsToUpdate.length > 0) {
      const querysql = `UPDATE carritofactura SET ${fieldsToUpdate.join(
        ", "
      )} WHERE id = ?`;
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

routerCarritoFactura.delete(
  "/EliminarProductoCarrito/:id",
  async (req, res) => {
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
      const querysql = "DELETE FROM carritofactura WHERE id = ?";
      await db.execute(querysql, [id]);

      res.send({ res: true, msg: "Producto removido exitosamente" });
    } catch (error) {
      console.error(
        "Error al Producto removido en la base de datos:",
        error.stack
      );
      res
        .status(500)
        .send({ res: false, msg: "Ha ocurrido un error inesperado" });
    }
  }
);
routerCarritoFactura.delete("/VaciarCarritoUsuario/:id", async (req, res) => {
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
    const querysql = "DELETE FROM carritofactura WHERE usuario = ?";
    await db.execute(querysql, [id]);

    res.send({ res: true, msg: "Se ha vaciado el carrito" });
  } catch (error) {
    console.error(
      "Error al Vaciar el carrito en la base de datos:",
      error.stack
    );
    res
      .status(500)
      .send({ res: false, msg: "Ha ocurrido un error inesperado" });
  }
});
module.exports = routerCarritoFactura;
