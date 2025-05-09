import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
      import {
        getFirestore,
        collection,
        doc,
        getDoc,
        getDocs,
        updateDoc,
        addDoc,
        query,
        where,
        orderBy
      } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

      // Configuración de tu Firebase:
      const firebaseConfig = {
        apiKey: "AIzaSyBoBj8-oqIwAOJG7q4J3wigbmc",
        authDomain: "gleedb-d9478.firebaseapp.com",
        projectId: "gleedb-d9478",
        storageBucket: "gleedb-d9478.firebasestorage.app",
        messagingSenderId: "722495997438",
        appId: "1:722495997438:web:19fd9152263a4651feacaf"
      };

      const app = initializeApp(firebaseConfig);
      const db  = getFirestore(app);

      let currentUserData = null;
      let currentUserRole = null;  // "admin" / "normal"
      let currentTienda   = null;  // Si user normal

      /******************************************
       * Verificar login
       ******************************************/
      const loggedUsername = localStorage.getItem("loggedUser");
      if (!loggedUsername) {
        window.location.href = "login.html";
      } else {
        loadUserData(loggedUsername);
      }

      async function loadUserData(username) {
        try {
          const cUsuarios = collection(db, "usuarios");
          const qU        = query(cUsuarios, where("username", "==", username));
          const snap      = await getDocs(qU);

          if (snap.empty) throw new Error("Usuario no encontrado");
          snap.forEach(docSnap => {
            currentUserData = docSnap.data();
          });
          currentUserRole = currentUserData.rol;
          currentTienda   = currentUserData.tiendaAsignada || "";

          renderPanel();
        } catch (error) {
          Swal.fire("Error", error.message, "error").then(() => {
            window.location.href = "login.html";
          });
        }
      }

      function renderPanel() {
        document.getElementById("userInfo").innerHTML = `
          <p>Bienvenido, ${currentUserData.nombre} (${currentUserRole.toUpperCase()})</p>
          <p>${(currentUserRole === "normal") 
               ? "Tienda asignada: " + currentTienda 
               : "Acceso global (Admin)"}
          </p>
        `;
        document.getElementById("logoutBtn").addEventListener("click", () => {
          localStorage.removeItem("loggedUser");
          window.location.href = "login.html";
        });

        // Cargar combos
        loadProductOptions();
        loadMovementHistory();
        loadPendingTransfers();

        document.getElementById("movementType").addEventListener("change", onMovementTypeChange);
        document.getElementById("movementForm").addEventListener("submit", onMovementFormSubmit);
      }

      /******************************************
       * Cargar productos (opcional filtrar)
       ******************************************/
      async function loadProductOptions() {
        const productSelect = document.getElementById("productSelect");
        productSelect.innerHTML = "<option value=''>Cargando...</option>";

        try {
          const cProductos = collection(db, "productos");
          const snap       = await getDocs(cProductos);

          let opts = "<option value=''>Seleccione un producto</option>";
          snap.forEach(docSnap => {
            const prod = docSnap.data();
            const pId  = docSnap.id;
            
            if (currentUserRole.toLowerCase() === "admin") {
              // Muestra todos
              opts += `<option value="${pId}">${prod.nombre} - ${prod.codigo}</option>`;
            } else {
              // Normal => si deseas filtrar stock>0
              const st = (prod.stock && prod.stock[currentTienda]) ? prod.stock[currentTienda] : 0;
              if (st > 0) {
                opts += `<option value="${pId}">${prod.nombre} - ${prod.codigo}</option>`;
              }
            }
          });
          productSelect.innerHTML = opts;

          // Listener para actualizar stock label
          productSelect.addEventListener("change", updateStockLabel);
        } catch (error) {
          productSelect.innerHTML = "<option>Error</option>";
        }
      }

      function onMovementTypeChange() {
        const type = document.getElementById("movementType").value;
        const origenContainer  = document.getElementById("origenContainer");
        const destinoContainer = document.getElementById("destinoContainer");

        // Ocultar ambos
        origenContainer.classList.add("hidden");
        destinoContainer.classList.add("hidden");

        if (type === "traslado") {
          origenContainer.classList.remove("hidden");
          destinoContainer.classList.remove("hidden");
          if (currentUserRole.toLowerCase() === "normal") {
            setSelectValue("origenSelect", currentTienda);
            setSelectValue("destinoSelect", "BodegaX"); // Ajusta a tu BD
          } else {
            populateTiendasSelect("origenSelect");
            populateTiendasSelect("destinoSelect");
          }
        }
        else if (type === "entrada_compra") {
          origenContainer.classList.remove("hidden");
          if (currentUserRole.toLowerCase() === "admin") {
            populateTiendasSelect("origenSelect"); // Filtra? "bodega"? si lo deseas
          } else {
            setSelectValue("origenSelect", currentTienda);
          }
        }
        else {
          // "salida_venta","salida_ajuste_negativo","entrada_devolucion","reajuste"
          origenContainer.classList.remove("hidden");
          if (currentUserRole.toLowerCase() === "normal") {
            setSelectValue("origenSelect", currentTienda);
          } else {
            populateTiendasSelect("origenSelect");
          }
        }

        // Actualizar stock label si cambia la tienda
        const origenSelect = document.getElementById("origenSelect");
        if (origenSelect) {
          origenSelect.addEventListener("change", updateStockLabel);
        }
      }

      async function populateTiendasSelect(selectId) {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = "<option value=''>Cargando...</option>";

        try {
          const cTiendas = collection(db, "tiendas");
          const snap     = await getDocs(cTiendas);

          let opts = "<option value=''>Seleccione tienda</option>";
          snap.forEach(docSnap => {
            const td = docSnap.data();
            // Ponemos value = td.nombre
            opts += `<option value="${td.nombre}">${td.nombre}</option>`;
          });
          sel.innerHTML = opts;
        } catch (error) {
          sel.innerHTML = "<option>Error</option>";
        }
      }

      function setSelectValue(selectId, value) {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = `<option value="${value}">${value}</option>`;
      }

      // Actualizar la etiqueta #currentStockLabel
      async function updateStockLabel() {
        const prodId   = document.getElementById("productSelect").value;
        const stockLbl = document.getElementById("currentStockLabel");
        let originKey  = null;

        if (currentUserRole.toLowerCase() === "normal") {
          originKey = currentTienda;
        } else {
          const origSel = document.getElementById("origenSelect");
          if (!origSel) return;
          originKey = origSel.value || "";
        }
        if (!prodId || !originKey) {
          stockLbl.textContent = "";
          return;
        }

        try {
          const ref  = doc(db, "productos", prodId);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            stockLbl.textContent = "Producto no encontrado";
            return;
          }
          const pData = snap.data();
          const st = (pData.stock && pData.stock[originKey]) ? pData.stock[originKey] : 0;
          stockLbl.textContent = `Stock actual en '${originKey}': ${st}`;
        } catch (error) {
          stockLbl.textContent = "Error: " + error.message;
        }
      }

      async function onMovementFormSubmit(e) {
        e.preventDefault();
        const movementType = document.getElementById("movementType").value;
        const productId    = document.getElementById("productSelect").value;
        const quantity     = parseInt(document.getElementById("quantity").value);
        const motivo       = document.getElementById("motivo").value.trim();

        let origen = null, destino = null;
        if (movementType === "traslado") {
          origen  = document.getElementById("origenSelect").value;
          destino = document.getElementById("destinoSelect").value;
          if (!origen || !destino || origen === destino) {
            Swal.fire("Error", "Seleccione tienda de origen y destino (distintas).", "error");
            return;
          }
        } else if (movementType === "entrada_compra") {
          if (currentUserRole.toLowerCase() === "admin") {
            origen = document.getElementById("origenSelect").value || "";
            if (!origen) {
              Swal.fire("Error", "Seleccione la tienda de origen (bodega).", "error");
              return;
            }
          } else {
            origen = currentTienda;
          }
        } else {
          // salidas, reajuste
          if (currentUserRole.toLowerCase() === "normal") {
            origen = currentTienda;
          } else {
            origen = document.getElementById("origenSelect").value || "";
          }
          if (!origen) {
            Swal.fire("Error", "Seleccione la tienda de origen", "error");
            return;
          }
        }

        if (!productId) {
          Swal.fire("Error", "Seleccione un producto", "error");
          return;
        }
        if (isNaN(quantity) || quantity <= 0) {
          Swal.fire("Error", "Cantidad inválida", "error");
          return;
        }
        if (movementType === "reajuste" && !motivo) {
          Swal.fire("Error", "Motivo es obligatorio para reajustes", "error");
          return;
        }

        try {
          // Cargar producto
          const prodRef = doc(db, "productos", productId);
          const prodSnap= await getDoc(prodRef);
          if (!prodSnap.exists()) {
            Swal.fire("Error", "Producto no encontrado", "error");
            return;
          }
          const prodData = prodSnap.data();

          // Nombre del producto
          const productoNombre = prodData.nombre;

          // Stock en origen
          const currentStock = (prodData.stock && prodData.stock[origen]) ? prodData.stock[origen] : 0;

          // Validar si es salida
          if (["salida_venta","salida_ajuste_negativo","traslado"].includes(movementType) && quantity > currentStock) {
            Swal.fire("Error", "Stock insuficiente en origen", "error");
            return;
          }

          // Calcular newStock
          let newStock = currentStock;
          if (["entrada_compra","entrada_devolucion"].includes(movementType)) {
            newStock += quantity;
          } else if (["salida_venta","salida_ajuste_negativo","traslado"].includes(movementType)) {
            newStock -= quantity;
          } else if (movementType === "reajuste") {
            newStock = quantity;
          }

          // Destino
          let newDestStock = 0;
          if (movementType === "traslado") {
            let destSt = (prodData.stock && prodData.stock[destino]) ? prodData.stock[destino] : 0;
            newDestStock = destSt + quantity;
          }

          // Resumen
          let resumen = `
            <p><strong>Producto:</strong> ${productoNombre}</p>
            <p><strong>Tipo:</strong> ${movementType}</p>
            <p><strong>Cantidad:</strong> ${quantity}</p>
            <p><strong>Origen:</strong> ${origen}</p>
          `;
          if (movementType === "traslado") {
            resumen += `<p><strong>Destino:</strong> ${destino}</p>`;
          }
          resumen += `<p><strong>Motivo:</strong> ${motivo || "N/A"}</p>`;

          const conf = await Swal.fire({
            title: "Confirmar Movimiento",
            html: resumen,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Confirmar"
          });
          if (!conf.isConfirmed) return;

          // Actualizar stock
          let stockUpdate = { ...prodData.stock };
          stockUpdate[origen] = newStock;
          if (movementType === "traslado") {
            stockUpdate[destino] = newDestStock;
          }
          await updateDoc(prodRef, { stock: stockUpdate });

          // Registrar en "movimientos"
          const cMov = collection(db, "movimientos");
          let movData = {
            tipo: movementType,
            productoId: productId,
            productoNombre: productoNombre, // guardamos el nombre
            cantidad: (movementType === "reajuste") ? Math.abs(newStock - currentStock) : quantity,
            origen: origen,
            destino: (movementType === "traslado") ? destino : null,
            fecha: new Date(),
            usuario: currentUserData.username,
            estado: (movementType === "traslado") ? "pendiente" : "completado",
            motivo: motivo
          };
          await addDoc(cMov, movData);

          Swal.fire("Movimiento registrado", "", "success");
          // Refrescar combos y tablas
          loadProductOptions(); // por si cambió stock
          loadMovementHistory();
          loadPendingTransfers();
        } catch (error) {
          Swal.fire("Error", error.message, "error");
        }
      }

      /**********************************************
       * Historial
       **********************************************/
      async function loadMovementHistory() {
        const histContainer = document.getElementById("historyContent");
        histContainer.innerHTML = "<p>Cargando historial...</p>";

        try {
          let qMov = query(collection(db, "movimientos"), orderBy("fecha", "desc"));
          if (currentUserRole.toLowerCase() === "normal") {
            qMov = query(
              collection(db, "movimientos"),
              where("origen", "==", currentTienda),
              orderBy("fecha", "desc")
            );
          }
          const snap = await getDocs(qMov);

          let html = `<table class="table table-bordered">
            <thead class="table-light">
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
          `;
          snap.forEach(docSnap => {
            const mov = docSnap.data();
            const fechaStr = mov.fecha?.toDate
              ? mov.fecha.toDate().toLocaleString()
              : new Date(mov.fecha).toLocaleString();
            html += `
              <tr>
                <td>${fechaStr}</td>
                <td>${mov.tipo}</td>
                <td>${mov.productoNombre || mov.productoId}</td>
                <td>${mov.cantidad}</td>
                <td>${mov.origen || ""}</td>
                <td>${mov.destino || ""}</td>
                <td>${mov.estado || "completado"}</td>
              </tr>
            `;
          });
          html += "</tbody></table>";
          histContainer.innerHTML = html;
        } catch (error) {
          histContainer.innerHTML = "<p>Error al cargar historial.</p>";
        }
      }

      /**********************************************
       * Traslados Pendientes
       **********************************************/
      async function loadPendingTransfers() {
        const pendContainer = document.getElementById("pendingTransfersContent");
        pendContainer.innerHTML = "<p>Cargando traslados pendientes...</p>";

        try {
          let qPend = query(
            collection(db, "movimientos"),
            where("tipo", "==", "traslado"),
            where("estado", "in", ["pendiente", "en_transito"]),
            orderBy("fecha", "desc")
          );
          if (currentUserRole.toLowerCase() === "normal") {
            qPend = query(
              collection(db, "movimientos"),
              where("tipo", "==", "traslado"),
              where("estado", "in", ["pendiente", "en_transito"]),
              where("origen", "==", currentTienda),
              orderBy("fecha", "desc")
            );
          }
          const snap = await getDocs(qPend);

          let html = `<table class="table table-bordered">
            <thead class="table-light">
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
          `;
          snap.forEach(docSnap => {
            const mov = docSnap.data();
            const fechaStr = mov.fecha?.toDate
              ? mov.fecha.toDate().toLocaleString()
              : new Date(mov.fecha).toLocaleString();
            html += `
              <tr>
                <td>${fechaStr}</td>
                <td>${mov.productoNombre || mov.productoId}</td>
                <td>${mov.cantidad}</td>
                <td>${mov.origen || ""}</td>
                <td>${mov.destino || ""}</td>
                <td>${mov.estado}</td>
              </tr>
            `;
          });
          html += "</tbody></table>";
          pendContainer.innerHTML = html;
        } catch (error) {
          pendContainer.innerHTML = "<p>Error al cargar traslados pendientes.</p>";
        }
      }
      