const { app, express } = require("./config");
const Puerto = 3001;
const cors = require("cors");

app.use(express.json());
app.use(cors());

app.listen(Puerto, () => {
  console.log(`Servidor escuchando en el puerto ${Puerto}`);
});

const routerProveedor = require("./rutas/Proveedor.js");
const routerProductos = require("./rutas/Productos.js");
const routerClientes = require("./rutas/Clientes.js");
const routerUsuario = require("./rutas/Usuarios.js");
//const routerCompras = require("./rutas/Compras.js");
const routerFactura = require("./rutas/Factura.js");
const routerCarritoFactura = require("./rutas/CarroFactura.js");

app.use("/Clientes", routerClientes);
app.use("/Proveedor", routerProveedor);
app.use("/Productos", routerProductos);
app.use("/Usuarios", routerUsuario);
//app.use("/Compras", routerCompras);
app.use("/Factura", routerFactura);
app.use("/Factura", routerCarritoFactura);
