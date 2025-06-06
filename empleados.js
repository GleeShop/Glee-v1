import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Se lee el rol del usuario desde localStorage
const loggedUserRole = (localStorage.getItem("loggedUserRole") || "").toLowerCase();
const isAdmin = loggedUserRole === "admin";

let empleados = [];
const empleadosBody = document.getElementById("empleadosBody");
const empleadosThead = document.getElementById("empleadosThead");
const empleadoModal = new bootstrap.Modal(document.getElementById("empleadoModal"));

// Ajustar la cabecera de la tabla según rol
function renderHeader() {
  if (isAdmin) {
    empleadosThead.innerHTML = `
      <tr>
        <th>Código</th>
        <th>Nombre</th>
        <th>Tienda</th>
        <th>Estado</th>
        <th>Acciones</th>
      </tr>
    `;
  } else {
    empleadosThead.innerHTML = `
      <tr>
        <th>Nombre</th>
        <th>Tienda</th>
      </tr>
    `;
  }
}

// Cargar las tiendas en el select del modal
async function loadTiendas() {
  try {
    const tiendasRef = collection(db, "tiendas");
    const q = query(tiendasRef, orderBy("nombre"));
    const snapshot = await getDocs(q);
    const select = document.getElementById("empleadoTienda");
    select.innerHTML = "<option value=''>Seleccione tienda</option>";
    snapshot.forEach((docSnap) => {
      const tienda = docSnap.data();
      const option = document.createElement("option");
      option.value = tienda.nombre;
      option.textContent = tienda.nombre;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar tiendas:", error);
  }
}

// Escuchar la colección "empleados" en tiempo real
function listenEmpleados() {
  const empleadosRef = collection(db, "empleados");
  onSnapshot(
    empleadosRef,
    (snapshot) => {
      empleados = [];
      snapshot.forEach((docSnap) => {
        let emp = docSnap.data();
        emp.id = docSnap.id;
        if (emp.enabled === undefined) emp.enabled = true;
        empleados.push(emp);
      });
      renderEmpleados();
    },
    (error) => {
      console.error("Error en onSnapshot empleados:", error);
      Swal.fire("Error", "No se pudieron cargar los empleados: " + error.message, "error");
    }
  );
}

// Renderizar la lista de empleados en la tabla
function renderEmpleados() {
  empleadosBody.innerHTML = "";
  if (empleados.length === 0) {
    empleadosBody.innerHTML = `<tr><td colspan="${isAdmin ? 5 : 2}" class="text-center">No hay empleados registrados</td></tr>`;
    return;
  }
  empleados.forEach((emp) => {
    const tr = document.createElement("tr");
    if (isAdmin) {
      tr.innerHTML = `
        <td>${emp.codigo}</td>
        <td>${emp.nombre}</td>
        <td>${emp.tienda || ""}</td>
        <td>${emp.enabled ? "Activo" : "Inactivo"}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editEmpleado('${emp.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEmpleado('${emp.id}')">Eliminar</button>
          <button class="btn btn-sm btn-warning" onclick="toggleEmpleado('${emp.id}', ${emp.enabled})">
            ${emp.enabled ? "Deshabilitar" : "Habilitar"}
          </button>
        </td>
      `;
    } else {
      // Para usuarios de rol sucursal: solo se muestran Nombre y Tienda
      tr.innerHTML = `
        <td>${emp.nombre}</td>
        <td>${emp.tienda || ""}</td>
      `;
    }
    empleadosBody.appendChild(tr);
  });
}

// Manejo del formulario (solo admin)
document.getElementById("empleadoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("empleadoId").value;
  const codigo = document.getElementById("empleadoCodigo").value.trim();
  const nombre = document.getElementById("empleadoNombre").value.trim();
  const tienda = document.getElementById("empleadoTienda").value;
  if (!codigo.match(/^[A-Za-z0-9]{3}$/)) {
    Swal.fire("Error", "El código debe tener 3 caracteres alfanuméricos.", "error");
    return;
  }
  if (!nombre || !tienda) {
    Swal.fire("Error", "Complete todos los campos.", "error");
    return;
  }
  const empleadoData = { codigo, nombre, tienda, enabled: true };
  try {
    if (id) {
      await updateDoc(doc(db, "empleados", id), empleadoData);
      Swal.fire("Éxito", "Empleado actualizado.", "success");
    } else {
      await addDoc(collection(db, "empleados"), empleadoData);
      Swal.fire("Éxito", "Empleado creado.", "success");
    }
    empleadoModal.hide();
  } catch (error) {
    console.error("Error al guardar empleado:", error);
    Swal.fire("Error", "Error al guardar empleado: " + error.message, "error");
  }
});

// Funciones globales para editar, eliminar y toggle (solo admin)
window.editEmpleado = function (id) {
  if (!isAdmin) return;
  const emp = empleados.find(e => e.id === id);
  if (!emp) return;
  document.getElementById("empleadoId").value = emp.id;
  document.getElementById("empleadoCodigo").value = emp.codigo;
  document.getElementById("empleadoNombre").value = emp.nombre;
  document.getElementById("empleadoTienda").value = emp.tienda;
  document.getElementById("empleadoModalLabel").textContent = "Editar Empleado";
  empleadoModal.show();
};

window.deleteEmpleado = async function (id) {
  if (!isAdmin) return;
  const result = await Swal.fire({
    title: "¿Está seguro?",
    text: "Esta acción eliminará el empleado de forma permanente.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  });
  if (!result.isConfirmed) return;
  try {
    await deleteDoc(doc(db, "empleados", id));
    Swal.fire("Éxito", "Empleado eliminado.", "success");
  } catch (error) {
    console.error("Error al eliminar empleado:", error);
    Swal.fire("Error", "Error al eliminar empleado: " + error.message, "error");
  }
};

window.toggleEmpleado = async function (id, currentStatus) {
  if (!isAdmin) return;
  try {
    await updateDoc(doc(db, "empleados", id), { enabled: !currentStatus });
    Swal.fire("Éxito", "Estado del empleado actualizado.", "success");
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    Swal.fire("Error", "Error al actualizar estado: " + error.message, "error");
  }
};

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  loadTiendas();
  listenEmpleados();
  renderHeader();
  if (isAdmin) {
    document.getElementById("btnCrearEmpleado").style.display = "inline-block";
    document.getElementById("btnCrearEmpleado").addEventListener("click", () => {
      document.getElementById("empleadoForm").reset();
      document.getElementById("empleadoId").value = "";
      document.getElementById("empleadoModalLabel").textContent = "Crear Empleado";
      empleadoModal.show();
    });
  }
});
