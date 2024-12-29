const { db, express } = require("../config");
const routerFactura = express.Router();
const Decimal = require("decimal.js");
const Joi = require("joi");
const obtenerFechaYHoraActual = () => {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  const horas = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  const segundos = String(fecha.getSeconds()).padStart(2, "0");

  const fechaActual = `${anio}-${mes}-${dia} ${horas}:${minutos}:${segundos}`;
  const horaActual = `${horas}:${minutos}:${segundos}`;
  console.log(fechaActual);
  console.log(horaActual);
  return [fechaActual, horaActual];
};
const RevisarCarrito = async (user) => {
  try {
    const querysql =
      "SELECT cf1.*, (SELECT COUNT(DISTINCT cf2.cliente) FROM carritofactura cf2 WHERE cf2.usuario = cf1.usuario) AS clientes_distintos, c.nombre AS cNombre, c.cedulaRif AS cedulaRif, c.tipo AS cTipo, c.estado AS cEstado, p.nombre AS pNombre, p.tipo AS pTipo,p.cantidad AS cantidad, p.precio AS precio, p.estado AS pEstado FROM carritofactura cf1 JOIN cliente c ON cf1.cliente = c.id JOIN producto p ON cf1.producto = p.id WHERE cf1.usuario = ? AND c.id = cf1.cliente";
    const [result] = await db.execute(querysql, [user]);
    return result;
  } catch (error) {
    console.error("Error al consultar el Carrito:", error.stack);
    return false;
  }
};
// facturas
const clientesDistintos = (carritofactura) => {
  // Usar un objeto para rastrear clientes únicos
  const uniqueClients = {};
  const filteredCarritofactura = carritofactura.filter((record) => {
    if (!uniqueClients[record.cliente]) {
      uniqueClients[record.cliente] = true;
      return true; // Mantener el registro
    }
    return false;
    // Filtrar el duplicado
  });
};
const EliminarFactura = async (factura, res) => {
  try {
    const querysql = "DELETE FROM factura WHERE id = ?";
    await db.execute(querysql, [factura]);
    return true; // Retorna true si la ejecución del SQL fue correcta
  } catch (error) {
    console.error("Error al eliminar datos:", error.stack);
    return false; // Retorna false en caso de error
  }
};
const DetallesFactura = async (factura, datos) => {
  try {
    if (!Array.isArray(datos) || datos.some((d) => d.includes(undefined))) {
      throw new Error("Datos incompletos o incorrectos");
    }

    const values = datos
      .map(
        ([producto, cantidad, precioUnidad]) =>
          `(${factura}, ${producto}, ${cantidad}, ${precioUnidad})`
      )
      .join(",");

    const querysql = `
      INSERT INTO detallesfactura (factura, producto, cantidad, precioUnidad) VALUES ${values}
    `;

    await db.execute(querysql);
    return true;
  } catch (error) {
    console.error("Error al crear detallesfactura:", error);
    return false;
  }
};

const ValidarReferencia = (valor, pago) => {};
const CalcularTotalSinIva = (valor) => {
  let precio = new Decimal(0); // Inicializar con Decimal

  for (let i = 0; i < valor.length; i++) {
    if (typeof valor[i] === "object" && valor[i].precio > 0) {
      // Utilizar Decimal para los cálculos con objetos
      precio = precio.plus(
        new Decimal(valor[i].precio).times(valor[i].cantidadCarrito)
      );
    } else if (typeof valor[i] === "number" && valor[i] > 0) {
      // Utilizar Decimal para los cálculos con números
      precio = precio.plus(new Decimal(valor[i]));
    }
  }

  return precio.toNumber(); // Convertir de vuelta a número normal
};
const CalcularDineroRecibido = (valor) => {
  let precio = new Decimal(0); // Inicializar con Decimal

  for (let i = 0; i < valor.length; i++) {
    if (typeof valor[i] === "object" && valor[i] > 0) {
      // Utilizar Decimal para los cálculos con objetos
      precio = precio.plus(new Decimal(valor[i]));
    } else if (typeof valor[i] === "number" && valor[i] > 0) {
      // Utilizar Decimal para los cálculos con números
      precio = precio.plus(new Decimal(valor[i]));
    }
  }

  return precio.toNumber(); // Convertir de vuelta a número normal
};
const RestarStock = async (datos) => {
  if (!datos.length) {
    console.error("Error: No hay datos para procesar");
    return false;
  }

  const ids = [...new Set(datos.map(([producto]) => producto))].join(",");
  const cases = datos
    .map(
      ([producto, cantidadCarrito]) =>
        `WHEN ${producto} THEN cantidad - ${cantidadCarrito}`
    )
    .join(" ");

  const condiciones = datos
    .map(
      ([producto, cantidadCarrito]) =>
        `(id = ${producto} AND cantidad >= ${cantidadCarrito})`
    )
    .join(" OR ");

  if (!ids || !cases || !condiciones) {
    console.error("Error: Datos insuficientes o incorrectos");
    return false;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const querysqlVerificar = `
      SELECT id, cantidad FROM producto 
      WHERE id IN (${ids}) AND (${condiciones});
    `;
    console.log("querysqlVerificar:", querysqlVerificar);

    const [rowsVerificar] = await connection.execute(querysqlVerificar);
    console.log(rowsVerificar);
    if (rowsVerificar.length !== datos.length) {
      throw new Error("Stock insuficiente para uno o más productos.");
    }

    const querysqlActualizar = `
      UPDATE producto 
      SET cantidad = CASE id ${cases} END
      WHERE id IN (${ids});
    `;
    console.log("querysqlActualizar:", querysqlActualizar);

    await connection.execute(querysqlActualizar);

    await connection.commit();
    return true;
  } catch (error) {
    console.error("Error al actualizar el stock:", error);
    await connection.rollback();
    return false;
  } finally {
    connection.release();
  }
};

const DevolverStock = async (datos) => {
  const ids = datos.map(([producto]) => producto.id).join(",");
  const cases = datos
    .map(
      ([producto, cantidadCarrito]) =>
        `WHEN ${producto.id} THEN producto.cantidad + ${cantidadCarrito}`
    )
    .join(" ");

  const querysql = `
    START TRANSACTION;

    -- Bloquear las filas de los productos
    SELECT cantidad FROM producto WHERE producto.id IN (${ids}) FOR UPDATE;

    -- Actualizar las cantidades de los productos
    UPDATE producto 
    SET producto.cantidad = CASE producto.id ${cases} END
    WHERE producto.id IN (${ids});

    COMMIT;
  `;

  try {
    await db.execute(querysql);
    return true;
  } catch (error) {
    console.error("Error al actualizar el stock:", error);
    await db.execute("ROLLBACK;");
    return false;
  }
};
const transformarYConsolidarDatos = (datos) => {
  const consolidado = {};

  datos.forEach(({ producto, cantidadCarrito, precio }) => {
    if (!consolidado[producto]) {
      consolidado[producto] = {
        cantidadCarrito: new Decimal(cantidadCarrito),
        precio,
      };
    } else {
      consolidado[producto].cantidadCarrito = consolidado[
        producto
      ].cantidadCarrito.plus(new Decimal(cantidadCarrito));
    }
  });

  return Object.entries(consolidado).map(
    ([producto, { cantidadCarrito, precio }]) => [
      parseInt(producto),
      cantidadCarrito.toNumber(),
      precio,
    ]
  );
};

const VerificarStock = (datos) => {
  for (const { cantidad, cantidadCarrito } of datos) {
    const restante = new Decimal(cantidad).minus(cantidadCarrito);
    if (restante.isNegative() && restante !== undefined) {
      return false;
    }
  }
  return true;
};
const CalcularTotalConIva = (valor, iva) => {
  const numero = new Decimal(valor);
  // Porcentaje a sumar
  const porcentaje = new Decimal(iva);
  // Convertir el porcentaje a decimal
  const factorPorcentaje = porcentaje.dividedBy(100);
  // Calcular el incremento
  const incremento = numero.times(factorPorcentaje);
  // Sumar el incremento al número inicial let resultado
  const resultado = numero.plus(incremento);
  // Retornar el resultado como cadena para evitar problemas de precisión
  return resultado.toString();
};
const RegistrarFormasDePago = async (factura, datos) => {
  console.log("datos", datos);
  try {
    const values = datos
      .map(
        ([forma, dinero, referencia]) =>
          `(${factura}, ${forma}, ${dinero}, ${referencia})`
      )
      .join(",");

    const querysql = `
      INSERT INTO pagofactura (factura, forma, cantidad, referencia) VALUES ${values}
    `;

    await db.execute(querysql);
    return true;
  } catch (error) {
    console.error("Error al registrar formas de pago:", error);
    return false;
  }
};
const LimpiarCarrito = async (id) => {
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
};
async function handleRollback(res, facturaId, mensajeError) {
  const eliminacionExitosa = await EliminarFactura(facturaId);
  res.send({
    res: false,
    msg: eliminacionExitosa
      ? mensajeError
      : `${mensajeError} y no se pudo eliminar los datos. El código de la factura es: ${facturaId}`,
  });
}
async function handleRollbackStock(res, facturaId, mensajeError, stock) {
  const Devolver = await DevolverStock(stock);

  const eliminacionExitosa = await EliminarFactura(facturaId);

  let msg = "";

  if (eliminacionExitosa == false) {
    msg += `hubo un error al elminar la factura cod:${facturaId}`;
  } else {
    msg += `${mensajeError} y no se pudo eliminar los datos. El código de la factura es: ${facturaId}`;
  }
  if (Devolver == false) {
    msg += `, además hubo un error al devolver los productos al inventario datos:${stock}`;
  }
  res.send({
    res: false,
    msg,
  });
}
routerFactura.post("/Crear", async (req, res) => {
  let idBorrar = 0;
  try {
    //? se resiven todos los datos
    const { forma, referencia } = req.body;
    let sobrante = "";

    // Asegúrate de que `dinero` sea un array de números decimales
    const dinero = Array.isArray(req.body.dinero)
      ? req.body.dinero.map((d) => new Decimal(parseFloat(d)))
      : [new Decimal(parseFloat(req.body.dinero))];
    const [fecha, hora] = obtenerFechaYHoraActual();
    const estado = true;
    const iva = 16;
    const datos = await RevisarCarrito(1);
    const clientesD = clientesDistintos(datos); // Extraer clientes distintos (comentario original)
    //?validaciones correspondientes
    // Comprobar el stock
    if (!VerificarStock(datos)) {
      return res.send("Se está solicitando más productos de los que se tienen");
    }
    // el id del usuario se debe extraer de jwt
    const PrecioTotal = CalcularTotalSinIva(datos);
    const { cliente, usuario } = datos[0];
    //Los arrays no tienen la misma longitud
    if (
      forma.length !== referencia.length ||
      referencia.length !== dinero.length
    ) {
      return res.send({
        msg: "Hubo un problema con las formas de pago, debes tener la misma cantidad de formas de pago, referencias y montos de dinero",
        res: false,
      });
    }
    //? verificar montos

    const PrecioTotalConIva = new Decimal(
      CalcularTotalConIva(PrecioTotal, iva)
    );

    const DineroIngresado = new Decimal(CalcularDineroRecibido(dinero));

    if (!DineroIngresado.equals(PrecioTotalConIva)) {
      const Inconsistencia = PrecioTotalConIva.minus(DineroIngresado);

      if (DineroIngresado.gt(PrecioTotalConIva)) {
        sobrante = `Se deben devolver: ${Inconsistencia.toString()}.Bs`;
      } else if (DineroIngresado.lt(PrecioTotalConIva)) {
        return res.send({
          msg: `Faltan : ${Inconsistencia.toString()}.Bs`,
          res: false,
        });
      }
    }

    //? se ejecutan las solicitudes a base de datos

    const querysql = `
      INSERT INTO factura (cliente, usuario, fecha, hora, iva, PrecioTotal, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const queryValues = [
      cliente,
      usuario,
      fecha,
      hora,
      iva,
      PrecioTotal,
      estado,
    ];

    const [result] = await db.execute(querysql, queryValues);
    console.log("Resultado de la inserción de factura:", result);

    idBorrar = result.insertId;

    // Crear detalles factura
    const transformDatos = transformarYConsolidarDatos(datos);

    const registroCompleto = await DetallesFactura(
      result.insertId,
      transformDatos
    );

    if (!registroCompleto) {
      await handleRollback(
        res,
        result.insertId,
        "Hubo un error al crear la Factura"
      );
      return;
    }

    const factura = result.insertId;

    const datosFormasDePago = forma.map((f, index) => [
      f,
      dinero[index],
      referencia[index],
    ]);
    const FormasDePago = await RegistrarFormasDePago(
      factura,
      datosFormasDePago
    );

    if (!FormasDePago) {
      await handleRollback(
        res,
        result.insertId,
        "Hubo un error al registrar las formas de pago"
      );
      return;
    }

    console.log("FormasDePago listos");

    // Restar stock
    const reducirStock = await RestarStock(transformDatos);
    if (!reducirStock) {
      await handleRollback(
        res,
        result.insertId,
        "Hubo un error al restar el stock"
      );
      return;
    }

    res.send({ res: true, msg: "Registro exitoso", sobrante });
    console.log({ res: true, msg: "Registro exitoso", idBorrar });
  } catch (error) {
    console.error("Error al registrar en la base de datos:", error.stack);
    await EliminarFactura(idBorrar);
    if (!res.headersSent) {
      res.status(500).send({ res: false, msg: "Error al registrar" });
    }
  }
});

routerFactura.get("/Pagos", async (req, res) => {
  try {
    const estado = true;
    const querysql = "SELECT * FROM formaspago WHERE estado = ?";

    const [result] = await db.execute(querysql, [estado]);
    if (result.length < 0) {
      res.status(500).send({ res: true, msg: "no se encontraron resultados" });
    }
    res.status(500).send({ res: true, msg: result });
  } catch (error) {
    console.error("Error al verificar las formas de pago:", error.stack);
    res.status(500).send({
      res: false,
      msg: "Ha ocurrido un error inesperado al verificar las formas de pago",
    });
  }
});
routerFactura.patch("/Estado", async (req, res) => {
  const { id, estado, token } = req.body;
  let msg =
    estado === true
      ? "Se ha activado un factura"
      : "Se ha desactivado un factura";

  try {
    const querysql = "UPDATE factura SET estado=? WHERE factura.id = ?";

    const [result] = await db.execute(querysql, [estado, id]);

    res.status(500).send({ res: true, msg });
  } catch (error) {
    console.error("Error al registrar en la base de datos:", error.stack);
    res
      .status(500)
      .send({ res: false, msg: "Ha ocurrido un error inesperado" });
  }
});

routerFactura.delete("/Eliminar/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const querysql = "DELETE FROM factura WHERE id = ?";
    await db.execute(querysql, [id]);

    res.send({ res: true, msg: "Se ha eliminado la factura" });
  } catch (error) {
    console.error(
      "Error al eliminar factura en la base de datos:",
      error.stack
    );
    res
      .status(500)
      .send({ res: false, msg: "Ha ocurrido un error inesperado" });
  }
});

module.exports = routerFactura;
// 1)carritofactura
// 2)materia prima
// 3)produto fabricable
// 4)materia fabricable
// 5)multi uso
// 6)herramientas
