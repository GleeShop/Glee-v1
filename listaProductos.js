import { db } from "./firebase-config.js"; // Ajusta la ruta según tu proyecto
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

console.log("Verificando db =>", db);

// Variables globales
let products = [];
let selectedProductId = null;
let dtInstanceProducts = null; // Instancia de DataTable para la tabla de productos

// Se leen los datos del usuario desde localStorage
const loggedUser = localStorage.getItem("loggedUser") || "";
const loggedUserRole = (localStorage.getItem("loggedUserRole") || "").toLowerCase();
const loggedUserStore = localStorage.getItem("loggedUserStore") || "DefaultStore";

// Definición de permisos según rol:
// - Admin: todos los botones.
// - Usuarios con tienda: solo se permite crear producto.
let userPermissions = {
  crearProducto: false,
  editarProducto: false,
  eliminarProducto: false,
  modificarStock: false,
  cargarTexto: false
};

if (loggedUserRole === "admin") {
  userPermissions = {
    crearProducto: true,
    editarProducto: true,
    eliminarProducto: true,
    modificarStock: true,
    cargarTexto: true
  };
} else {
  userPermissions = {
    crearProducto: true,
    editarProducto: false,
    eliminarProducto: false,
    modificarStock: false,
    cargarTexto: false
  };
}
console.log("Permisos de productos:", userPermissions);

// Variable para el filtrado de tienda
let currentStore = "";
// Si el usuario no es admin, se fija la tienda del usuario
if (loggedUserRole !== "admin") {
  currentStore = loggedUserStore;
  document.getElementById("inventoryTitle").textContent = `Inventario de: ${currentStore}`;
} else {
  // Para admin se muestra el filtro de tienda
  document.getElementById("adminStoreFilter").style.display = "block";
  document.getElementById("inventoryTitle").textContent = "Inventario: Stock Total";
}

// Función para cargar tiendas en el select (solo para admin)
async function loadStoreFilter() {
  try {
    const qStores = query(collection(db, "tiendas"), orderBy("nombre"));
    const snapshot = await getDocs(qStores);
    const storeSelect = document.getElementById("storeSelect");
    storeSelect.innerHTML = "<option value=''>Inventario: Stock Total</option>";
    snapshot.forEach((docSnap) => {
      const store = docSnap.data();
      const option = document.createElement("option");
      option.value = store.nombre;
      option.textContent = store.nombre;
      storeSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar tiendas:", error);
  }
}

if (loggedUserRole === "admin") {
  document.addEventListener("DOMContentLoaded", () => {
    loadStoreFilter();
    document.getElementById("storeSelect").addEventListener("change", function () {
      currentStore = this.value;
      document.getElementById("inventoryTitle").textContent = currentStore
        ? `Inventario de: ${currentStore}`
        : "Inventario: Stock Total";
      // Al cambiar la tienda, se vuelve a renderizar la tabla (sin filtrar filas)
      renderProducts();
    });
  });
}

// Escucha en tiempo real la colección "productos"
function listenProducts() {
  const qProducts = query(collection(db, "productos"), orderBy("createdAt", "desc"));
  onSnapshot(
    qProducts,
    (snapshot) => {
      products = [];
      snapshot.forEach((docSnap) => {
        const prod = docSnap.data();
        prod.id = docSnap.id;
        products.push(prod);
      });
      renderProducts();
    },
    (error) => {
      console.error("Error en onSnapshot:", error);
      Swal.fire("Error", "No se pudieron obtener los productos: " + error.message, "error");
    }
  );
}

// Función para renderizar productos
function renderProducts() {
  const tbody = document.getElementById("productsBody");
  tbody.innerHTML = "";
  
  // Para usuarios con tienda (no admin), se muestran solo productos que tengan stock > 0 en su tienda.
  // Para admin se muestran TODOS los productos, sin filtrar filas.
  const filteredProducts = products.filter(prod => {
    if (loggedUserRole !== "admin") {
      const storeStock = prod.stock ? Number(prod.stock[currentStore] || 0) : 0;
      return storeStock > 0;
    }
    return true;
  });

  if (filteredProducts.length === 0) {
    tbody.innerHTML =
      "<tr><td colspan='6' class='text-center'>No hay productos disponibles</td></tr>";
    if ($.fn.DataTable.isDataTable("#productsTable")) {
      $("#productsTable").DataTable().destroy();
    }
    return;
  }
  
  filteredProducts.forEach((prod) => {
    const tr = document.createElement("tr");
    const displayedStock = getDisplayedStock(prod);
    tr.innerHTML = `
      <td>${prod.codigo}</td>
      <td>${prod.descripcion}</td>
      <td>${prod.color || ""}</td>
      <td>${prod.talla || ""}</td>
      <td>Q ${parseFloat(prod.precio).toFixed(2)}</td>
      <td>${displayedStock}</td>
    `;
    tr.addEventListener("click", () => {
      document.querySelectorAll("#productsBody tr").forEach((row) =>
        row.classList.remove("table-active")
      );
      tr.classList.add("table-active");
      selectedProductId = prod.id;
    });
    tbody.appendChild(tr);
  });
  
  // Inicializar DataTable para la tabla de productos con paginación personalizada:
  // Opciones: 5, 10, 15, 20, 25, 30; iniciando en 5
  if ($.fn.DataTable.isDataTable("#productsTable")) {
    $("#productsTable").DataTable().destroy();
  }
  dtInstanceProducts = $("#productsTable").DataTable({
    pageLength: 5,
    lengthMenu: [[5, 10, 15, 20, 25, 30], [5, 10, 15, 20, 25, 30]],
    language: {
      search: "Buscar:",
      lengthMenu: "Mostrar _MENU_ registros",
      zeroRecords: "No se encontraron resultados",
      info: "Mostrando página _PAGE_ de _PAGES_",
      infoEmpty: "No hay registros disponibles",
      infoFiltered: "(filtrado de _MAX_ registros totales)"
    }
  });
}

// Calcula el stock a mostrar según rol y tienda
function getDisplayedStock(product, store = currentStore) {
  if (!product.stock || typeof product.stock !== "object") {
    return product.stock || 0;
  }
  
  // Si se ha seleccionado una tienda, mostramos el stock de esa tienda
  if (store) {
    return product.stock[store] || 0;
  }
  
  // Si no se especifica tienda, admin ve stock total y otros el stock de currentStore
  if (loggedUserRole === "admin") {
    return Object.values(product.stock).reduce((sum, val) => sum + Number(val), 0);
  }
  
  return product.stock[currentStore] || 0;
}

/*********************************************
 * FUNCIONES CRUD PARA PRODUCTOS
 *********************************************/
async function crearProducto() {
  // Se solicita el color junto a los demás campos
  const { value: formValues } = await Swal.fire({
    title: "Crear Producto",
    html: `
      <input id="swal-input1" class="swal2-input" placeholder="Código">
      <input id="swal-input2" class="swal2-input" placeholder="Descripción">
      <input id="swal-input3" class="swal2-input" placeholder="Color">
      <input id="swal-input4" class="swal2-input" placeholder="Talla (opcional)">
      <input id="swal-input5" class="swal2-input" placeholder="Precio" type="number" min="0.01" step="0.01">
    `,
    focusConfirm: false,
    preConfirm: () => {
      const codigo = document.getElementById("swal-input1").value.trim();
      const descripcion = document.getElementById("swal-input2").value.trim();
      const color = document.getElementById("swal-input3").value.trim();
      const talla = document.getElementById("swal-input4").value.trim();
      const precio = parseFloat(document.getElementById("swal-input5").value);
      if (!codigo) {
        Swal.showValidationMessage("El código es obligatorio");
        return;
      }
      if (!descripcion) {
        Swal.showValidationMessage("La descripción es obligatoria");
        return;
      }
      if (!color) {
        Swal.showValidationMessage("El color es obligatorio");
        return;
      }
      if (isNaN(precio) || precio <= 0) {
        Swal.showValidationMessage("El precio debe ser mayor a 0");
        return;
      }
      return { codigo, descripcion, color, talla, precio };
    }
  });
  if (!formValues) return;
  try {
    // Al crear producto, si hay un filtro de tienda (currentStore), se asigna stock para esa tienda (inicialmente 0)
    let initialStock = {};
    if (currentStore) {
      initialStock[currentStore] = 0;
    }
    const newProduct = {
      codigo: formValues.codigo,
      descripcion: formValues.descripcion,
      color: formValues.color,
      talla: formValues.talla,
      precio: formValues.precio,
      stock: initialStock,
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, "productos"), newProduct);
    Swal.fire("Producto creado", "El producto se creó correctamente", "success");
  } catch (error) {
    Swal.fire("Error", "No se pudo crear el producto: " + error.message, "error");
  }
}

async function editarProducto() {
  if (!selectedProductId) {
    Swal.fire("Advertencia", "Selecciona un producto para editar", "warning");
    return;
  }
  const product = products.find((p) => p.id === selectedProductId);
  if (!product) {
    Swal.fire("Error", "Producto no encontrado", "error");
    return;
  }
  const { value: formValues } = await Swal.fire({
    title: "Editar Producto",
    html: `
      <input id="swal-input1" class="swal2-input" placeholder="Código" value="${product.codigo}">
      <input id="swal-input2" class="swal2-input" placeholder="Descripción" value="${product.descripcion}">
      <input id="swal-input3" class="swal2-input" placeholder="Color" value="${product.color || ''}">
      <input id="swal-input4" class="swal2-input" placeholder="Talla (opcional)" value="${product.talla || ''}">
      <input id="swal-input5" class="swal2-input" placeholder="Precio" type="number" min="0.01" step="0.01" value="${product.precio}">
    `,
    focusConfirm: false,
    preConfirm: () => {
      const codigo = document.getElementById("swal-input1").value.trim();
      const descripcion = document.getElementById("swal-input2").value.trim();
      const color = document.getElementById("swal-input3").value.trim();
      const talla = document.getElementById("swal-input4").value.trim();
      const precio = parseFloat(document.getElementById("swal-input5").value);
      if (!codigo) {
        Swal.showValidationMessage("El código es obligatorio");
        return;
      }
      if (!descripcion) {
        Swal.showValidationMessage("La descripción es obligatoria");
        return;
      }
      if (!color) {
        Swal.showValidationMessage("El color es obligatorio");
        return;
      }
      if (isNaN(precio) || precio <= 0) {
        Swal.showValidationMessage("El precio debe ser mayor a 0");
        return;
      }
      return { codigo, descripcion, color, talla, precio };
    }
  });
  if (!formValues) return;
  try {
    const updateData = {
      codigo: formValues.codigo,
      descripcion: formValues.descripcion,
      color: formValues.color,
      talla: formValues.talla,
      precio: formValues.precio
    };
    await updateDoc(doc(db, "productos", selectedProductId), updateData);
    Swal.fire("Producto editado", "El producto se actualizó correctamente", "success");
  } catch (error) {
    Swal.fire("Error", "No se pudo editar el producto: " + error.message, "error");
  }
}

async function eliminarProducto() {
  if (!selectedProductId) {
    Swal.fire("Advertencia", "Selecciona un producto para eliminar", "warning");
    return;
  }
  const product = products.find((p) => p.id === selectedProductId);
  if (!product) {
    Swal.fire("Error", "Producto no encontrado", "error");
    return;
  }
  const confirmResult = await Swal.fire({
    title: "¿Eliminar Producto?",
    text: `¿Estás seguro de eliminar "${product.descripcion}"?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  });
  if (!confirmResult.isConfirmed) return;
  try {
    await deleteDoc(doc(db, "productos", selectedProductId));
    Swal.fire("Eliminado", "El producto se eliminó correctamente", "success");
    selectedProductId = null;
  } catch (error) {
    Swal.fire("Error", "No se pudo eliminar el producto: " + error.message, "error");
  }
}

async function modificarStock() {
  if (!selectedProductId) {
    Swal.fire("Advertencia", "Selecciona un producto para modificar el stock", "warning");
    return;
  }
  const product = products.find((p) => p.id === selectedProductId);
  if (!product) {
    Swal.fire("Error", "Producto no encontrado", "error");
    return;
  }
  if (loggedUserRole === "admin" && !currentStore) {
    Swal.fire(
      "Tienda no seleccionada",
      "Debes elegir una tienda en el filtro para modificar stock",
      "info"
    );
    return;
  }
  const currentStock = getCurrentStock(product, currentStore);
  const { value: newStock } = await Swal.fire({
    title: "Modificar Stock",
    input: "number",
    inputLabel: `Ingresa el nuevo stock para la tienda: ${currentStore || "Global"}`,
    inputValue: currentStock,
    showCancelButton: true,
    inputValidator: (value) => {
      if ((!value && value !== 0) || isNaN(value)) {
        return "Debes ingresar un valor de stock";
      }
      if (value < 0) {
        return "El stock debe ser un número no negativo";
      }
    }
  });
  if (newStock !== undefined) {
    try {
      const updatedStock = product.stock && typeof product.stock === "object"
        ? { ...product.stock }
        : {};
      const storeKey = currentStore;
      updatedStock[storeKey] = Number(newStock);
      await updateDoc(doc(db, "productos", selectedProductId), { stock: updatedStock });
      Swal.fire("Stock actualizado", "El stock fue actualizado correctamente", "success");
      // Actualizamos la vista llamando a listenProducts para refrescar los datos
      listenProducts();
    } catch (error) {
      Swal.fire("Error", "No se pudo actualizar el stock: " + error.message, "error");
    }
  }
}

function getCurrentStock(product, store = currentStore) {
  if (!product.stock || typeof product.stock !== "object") {
    return product.stock || 0;
  }
  if (loggedUserRole === "admin") {
    if (!store) {
      // Sin filtro, se muestra la suma total de todos los stocks
      return Object.values(product.stock).reduce((sum, val) => sum + Number(val), 0);
    } else {
      // Con filtro, se muestra solo el stock de la tienda seleccionada
      return product.stock[store] || 0;
    }
  }
  return product.stock[currentStore] || 0;
}

/*********************************************
 * FUNCIONES CRUD PARA PRODUCTOS - CARGA MASIVA
 *********************************************/
async function cargarConCadenaTexto() {
  const { value: textData } = await Swal.fire({
    title: "Cargar Productos en Masa",
    html: `<textarea id="swal-textarea" class="swal2-textarea" placeholder="Ingresa los productos en formato CSV:&#10;Código,Descripción,Talla,Precio,Color,Stock (opcional)"></textarea>`,
    focusConfirm: false,
    preConfirm: () => {
      const text = document.getElementById("swal-textarea").value.trim();
      if (!text) {
        Swal.showValidationMessage("Debes ingresar datos para cargar");
        return;
      }
      return text;
    }
  });
  if (!textData) return;

  const lines = textData.split("\n").filter(line => line.trim() !== "");
  let productosNuevos = [];
  lines.forEach(line => {
    const parts = line.split(",").map(item => item.trim());
    if (parts.length < 5) {
      // Se requieren al menos 5 campos: Código, Descripción, Talla, Precio, Color
      return;
    }
    const codigo = parts[0];
    const descripcion = parts[1];
    const talla = parts[2];
    const precio = parseFloat(parts[3]);
    const color = parts[4];
    if (!codigo || !descripcion || isNaN(precio) || precio <= 0 || !color) {
      return;
    }
    let stock = {};
    if (parts.length >= 6) {
      const s = parseInt(parts[5]);
      stock = { [loggedUserStore]: isNaN(s) ? 0 : s };
    }
    const nuevoProducto = {
      codigo,
      descripcion,
      talla,
      precio,
      color,
      stock,
      createdAt: new Date().toISOString()
    };
    productosNuevos.push(nuevoProducto);
  });

  if (productosNuevos.length === 0) {
    Swal.fire("Atención", "No se encontraron productos válidos en los datos ingresados", "warning");
    return;
  }

  try {
    const promises = productosNuevos.map(async prod => {
      await addDoc(collection(db, "productos"), prod);
    });
    await Promise.all(promises);
    Swal.fire("Productos cargados", `${productosNuevos.length} productos fueron cargados correctamente`, "success");
  } catch (error) {
    Swal.fire("Error", "No se pudo cargar los productos: " + error.message, "error");
  }
}

/*********************************************
 * INICIALIZACIÓN DE LA PÁGINA Y ASIGNACIÓN DE EVENTOS
 *********************************************/
document.addEventListener("DOMContentLoaded", () => {
  listenProducts();
  // Se remueve el listener del buscador custom ya que se usará el buscador de DataTables.
  // document.getElementById("searchInput").addEventListener("input", renderProducts);

  const btnCrearProducto = document.getElementById("btnCrearProducto");
  const btnEditarProducto = document.getElementById("btnEditarProducto");
  const btnEliminarProducto = document.getElementById("btnEliminarProducto");
  const btnModificarStock = document.getElementById("btnModificarStock");
  const btnCargarTexto = document.getElementById("btnCargarTexto");

  if (loggedUserRole === "admin") {
    btnCrearProducto.style.display = "inline-block";
    btnEditarProducto.style.display = "inline-block";
    btnEliminarProducto.style.display = "inline-block";
    btnModificarStock.style.display = "inline-block";
    btnCargarTexto.style.display = "inline-block";
    btnCrearProducto.addEventListener("click", crearProducto);
    btnEditarProducto.addEventListener("click", editarProducto);
    btnEliminarProducto.addEventListener("click", eliminarProducto);
    btnModificarStock.addEventListener("click", modificarStock);
    btnCargarTexto.addEventListener("click", cargarConCadenaTexto);
  } else {
    btnCrearProducto.style.display = "inline-block";
    btnEditarProducto.style.display = "none";
    btnEliminarProducto.style.display = "none";
    btnModificarStock.style.display = "none";
    btnCargarTexto.style.display = "none";
    btnCrearProducto.addEventListener("click", crearProducto);
  }
});
