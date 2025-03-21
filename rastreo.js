import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Variable global para almacenar la instancia de DataTable
let dtInstance;

// Determinar el rol del usuario (admin o sucursal) según localStorage
const loggedUserRole = (localStorage.getItem("loggedUserRole") || "").toLowerCase();
const isAdmin = loggedUserRole === "admin";

// Función para convertir de "YYYY-MM-DD" a "dd/mm/yyyy" (si se requiere)
function convertirFecha(inputDate) {
  const parts = inputDate.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Para pruebas, forzamos la fecha por defecto a "2025-03-20"
// En producción, se puede usar new Date().toISOString().substring(0,10)
const defaultDate = "2025-03-20";

// Al cargar el DOM, establecer la fecha por defecto en el filtro y en el formulario
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("filtroFecha").value = defaultDate;
  const fechaGeneracionInput = document.getElementById("fechaGeneracion");
  if (fechaGeneracionInput) {
    fechaGeneracionInput.value = defaultDate;
  }
  loadGuias(defaultDate);
});

// Función para cargar y renderizar las guías según la fecha de generación
export async function loadGuias(filterDate = "") {
  try {
    const guiasRef = collection(db, "guias");
    let q;
    if (filterDate) {
      // Se asume que el campo "fechaGeneracion" en Firestore está en formato "YYYY-MM-DD"
      q = query(guiasRef, where("fechaGeneracion", "==", filterDate));
      console.log("Filtrando por fechaGeneracion:", filterDate);
    } else {
      q = query(guiasRef);
      console.log("Cargando todas las guías");
    }
    const snapshot = await getDocs(q);
    console.log("Documentos obtenidos:", snapshot.size);
    snapshot.forEach((docSnap) => {
      console.log("Guía:", docSnap.data());
    });
    const tableBody = document.getElementById("tablaGuiasBody");
    if (!tableBody) {
      console.error("Elemento 'tablaGuiasBody' no encontrado en el DOM.");
      return;
    }
    tableBody.innerHTML = "";
    if (snapshot.empty) {
      document.getElementById("mensajeSinGuias").style.display = "block";
    } else {
      document.getElementById("mensajeSinGuias").style.display = "none";
      snapshot.forEach((docSnap) => {
        const guia = { id: docSnap.id, ...docSnap.data() };
        const tr = document.createElement("tr");
        // Definir acciones según rol:
        // Para admin: ver, editar, anular y eliminar.
        // Para sucursal: solo ver.
        let actionsHtml = `<button class="btn btn-info btn-sm" data-action="ver" data-id="${guia.id}">Ver</button>`;
        if (isAdmin) {
          actionsHtml += `
            <button class="btn btn-primary btn-sm" data-action="editar" data-id="${guia.id}">Editar</button>
            <button class="btn btn-warning btn-sm" data-action="anular" data-id="${guia.id}">Anular</button>
            <button class="btn btn-danger btn-sm" data-action="eliminar" data-id="${guia.id}">Eliminar</button>
          `;
        }
        // Cada fila tiene exactamente 5 columnas:
        // 1. Número de Guía
        // 2. Estado
        // 3. Fecha de generación
        // 4. Fecha de uso (vacía por el momento)
        // 5. Acciones
        tr.innerHTML = `
          <td>${guia.numeroGuia || ""}</td>
          <td>${guia.estado || ""}</td>
          <td>${guia.fechaGeneracion || ""}</td>
          <td>${guia.fechaUso || ""}</td>
          <td>${actionsHtml}</td>
        `;
        tr.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", () => {
            handleAccion(btn.getAttribute("data-action"), guia);
          });
        });
        tableBody.appendChild(tr);
      });
    }
    // Reinicializar DataTable (si ya existe, destruirlo)
    if ($.fn.DataTable.isDataTable("#tablaGuias")) {
      $("#tablaGuias").DataTable().destroy();
    }
    dtInstance = $("#tablaGuias").DataTable({
      pageLength: 10,
      lengthMenu: [[5, 10, 25, 30], [5, 10, 25, 30]],
      language: {
        search: "Buscar:",
        lengthMenu: "Mostrar _MENU_ registros",
        zeroRecords: "No se encontraron resultados",
        info: "Mostrando página _PAGE_ de _PAGES_",
        infoEmpty: "No hay registros disponibles",
        infoFiltered: "(filtrado de _MAX_ registros totales)",
      },
    });
  } catch (error) {
    console.error("Error al cargar las guías:", error);
  }
}

// Filtro personalizado para DataTables basado en la columna "fechaGeneracion" (índice 2)
$.fn.dataTable.ext.search.push(function (settings, data, dataIndex) {
  const filtroFecha = document.getElementById("filtroFecha").value;
  const fechaRegistro = data[2] || "";
  if (!filtroFecha) {
    return true;
  }
  return fechaRegistro === filtroFecha;
});

// Actualizar la tabla cuando se cambia el filtro de fecha
document.getElementById("filtroFecha").addEventListener("change", () => {
  if (dtInstance) {
    dtInstance.draw();
  }
  loadGuias(document.getElementById("filtroFecha").value);
});

// Función para manejar las acciones de la tabla de guías
async function handleAccion(action, guia) {
  if (action === "ver") {
    Swal.fire("Ver Guía", JSON.stringify(guia, null, 2), "info");
  } else if (action === "editar" && isAdmin) {
    Swal.fire("Editar", "Función de editar no implementada.", "info");
  } else if (action === "anular" && isAdmin) {
    Swal.fire("Anular", "Función de anular no implementada.", "info");
  } else if (action === "eliminar" && isAdmin) {
    Swal.fire({
      title: "Confirmar eliminación",
      text: "¿Estás seguro de eliminar esta guía?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(db, "guias", guia.id));
          Swal.fire("Eliminada", "La guía ha sido eliminada", "success");
          loadGuias(document.getElementById("filtroFecha").value);
        } catch (error) {
          console.error("Error al eliminar la guía:", error);
          Swal.fire("Error", "No se pudo eliminar la guía", "error");
        }
      }
    });
  }
}

// Manejar el envío del formulario para agregar una nueva guía (modal)
document.getElementById("formGuiaModal").addEventListener("submit", async (e) => {
  e.preventDefault();
  const numeroGuia = document.getElementById("numeroGuia").value;
  const fechaGeneracion = document.getElementById("fechaGeneracion").value;
  const cliente = document.getElementById("cliente").value;
  const direccion = document.getElementById("direccion").value;
  const codigoAutorizacion = document.getElementById("codigoAutorizacion").value;
  const estado = "Pendiente";
  
  // Usamos la fechaGeneracion como fecha de generación y también como fechaEnvio (por ahora)
  const nuevaGuia = {
    numeroGuia,
    fechaGeneracion,
    estado,
    fechaEnvio: fechaGeneracion,
    cliente,
    direccion,
    codigoAutorizacion,
  };
  
  try {
    await addDoc(collection(db, "guias"), nuevaGuia);
    Swal.fire("Éxito", "Guía ingresada correctamente", "success");
    const modalElement = document.getElementById("modalIngresarGuia");
    const modal = bootstrap.Modal.getInstance(modalElement);
    modal.hide();
    document.getElementById("formGuiaModal").reset();
    // Restablecer la fecha en el formulario a la fecha por defecto
    document.getElementById("fechaGeneracion").value = defaultDate;
    loadGuias(document.getElementById("filtroFecha").value);
  } catch (error) {
    console.error("Error al agregar la guía:", error);
    Swal.fire("Error", "No se pudo agregar la guía", "error");
  }
});

// Abrir modal para ingresar nueva guía al hacer clic en el botón
document.getElementById("btnIngresarGuia").addEventListener("click", () => {
  const modalElement = document.getElementById("modalIngresarGuia");
  const modal = new bootstrap.Modal(modalElement);
  modal.show();
});

// Inicializar la carga de guías al cargar la página
window.addEventListener("DOMContentLoaded", () => {
  loadGuias(document.getElementById("filtroFecha").value);
});
