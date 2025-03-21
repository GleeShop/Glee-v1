$(document).ready(function () {
    // Inicializar DataTable con opciones de paginación, búsqueda y lenguaje
    var table = $("#preventasTable").DataTable({
      pageLength: 10, // Muestra 10 registros por página
      language: {
        search: "Buscar:",
        lengthMenu: "Mostrar _MENU_ registros",
        zeroRecords: "No se encontraron resultados",
        info: "Mostrando página _PAGE_ de _PAGES_",
        infoEmpty: "No hay registros disponibles",
        infoFiltered: "(filtrado de _MAX_ registros totales)",
      },
    });
  
    // Agregar filtro personalizado para la columna "Fecha de venta inicial" (índice 10)
    $.fn.dataTable.ext.search.push(function (settings, data, dataIndex) {
      var filtroFecha = $("#filtroFecha").val();
      var fechaVentaInicial = data[10] || ""; // La columna 11 (índice 10)
      if (!filtroFecha) {
        return true;
      }
      // Compara las fechas en formato YYYY-MM-DD
      return fechaVentaInicial === filtroFecha;
    });
  
    // Evento para redibujar la tabla cuando se cambia el filtro de fecha
    $("#filtroFecha").on("change", function () {
      table.draw();
    });
  });
  