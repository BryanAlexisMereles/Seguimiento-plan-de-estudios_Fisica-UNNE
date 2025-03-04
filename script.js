let profesorado = {};
let licenciatura = {};
let progresoProfesorado =
  JSON.parse(localStorage.getItem("progresoProfesorado")) || {};
let progresoLicenciatura =
  JSON.parse(localStorage.getItem("progresoLicenciatura")) || {};
let filtroActivo = "todas";
let profesoradoCompleted = false;
let licenciaturaCompleted = false;

async function cargarDatos() {
  try {
    const responseProf = await fetch("profesorado.json");
    profesorado = await responseProf.json();
    const responseLic = await fetch("licenciatura.json");
    licenciatura = await responseLic.json();
    renderizarMaterias();
    actualizarProgreso();
    aplicarFiltroActivo();
  } catch (error) {
    console.error("Error al cargar los archivos JSON:", error);
  }
}

function actualizarEstado(materiaId, estado, carrera) {
  if (carrera === "profesorado") {
    progresoProfesorado[materiaId] = estado;
    localStorage.setItem(
      "progresoProfesorado",
      JSON.stringify(progresoProfesorado)
    );
  } else {
    progresoLicenciatura[materiaId] = estado;
    localStorage.setItem(
      "progresoLicenciatura",
      JSON.stringify(progresoLicenciatura)
    );
  }
  actualizarMateria(materiaId);
  actualizarProgreso();
  aplicarFiltroActivo();
}

function hacerEquivalencia(materiaId) {
  progresoProfesorado[materiaId] = "aprobada";
  progresoLicenciatura[materiaId] = "aprobada";
  localStorage.setItem(
    "progresoProfesorado",
    JSON.stringify(progresoProfesorado)
  );
  localStorage.setItem(
    "progresoLicenciatura",
    JSON.stringify(progresoLicenciatura)
  );
  actualizarMateria(materiaId);
  actualizarProgreso();
  aplicarFiltroActivo();
}

function verificarCorrelativas(materiaId, materiasCarrera, progresoCarrera) {
  const materia = materiasCarrera[materiaId];
  const { correlativas } = materia;

  let puedeCursar = true;
  let puedeRendir = true;

  if (correlativas.cursar) {
    for (const req of correlativas.cursar) {
      if (req.id) {
        const estadoMateria = progresoCarrera[req.id] || "pendiente";
        if (
          (req.cond === "aprobada" && estadoMateria !== "aprobada") ||
          (req.cond === "regularizada" && estadoMateria === "pendiente")
        ) {
          puedeCursar = false;
          break;
        }
      } else if (req.modulo) {
        const aprobadasModulo = Object.keys(progresoCarrera).filter(
          (id) =>
            progresoCarrera[id] === "aprobada" &&
            materiasCarrera[id].modulo === req.modulo
        ).length;
        if (aprobadasModulo < req.aprobadas) {
          puedeCursar = false;
          break;
        }
      } else if (req.modulos) {
        const aprobadasModulos = Object.keys(progresoCarrera).filter(
          (id) =>
            progresoCarrera[id] === "aprobada" &&
            req.modulos.includes(materiasCarrera[id].modulo)
        ).length;
        if (aprobadasModulos < req.aprobadas) {
          puedeCursar = false;
          break;
        }
      }
    }
  }

  if (correlativas.aprobar) {
    for (const req of correlativas.aprobar) {
      if (req.id) {
        const estadoMateria = progresoCarrera[req.id] || "pendiente";
        if (
          (req.cond === "aprobada" && estadoMateria !== "aprobada") ||
          (req.cond === "regularizada" && estadoMateria === "pendiente")
        ) {
          puedeRendir = false;
          break;
        }
      } else if (req.modulo) {
        const aprobadasModulo = Object.keys(progresoCarrera).filter(
          (id) =>
            progresoCarrera[id] === "aprobada" &&
            materiasCarrera[id].modulo === req.modulo
        ).length;
        if (aprobadasModulo < req.aprobadas) {
          puedeRendir = false;
          break;
        }
      } else if (req.modulos) {
        const aprobadasModulos = Object.keys(progresoCarrera).filter(
          (id) =>
            progresoCarrera[id] === "aprobada" &&
            req.modulos.includes(materiasCarrera[id].modulo)
        ).length;
        if (aprobadasModulos < req.aprobadas) {
          puedeRendir = false;
          break;
        }
      }
    }
  }

  if (!puedeCursar) puedeRendir = false;

  return { puedeCursar, puedeRendir };
}

function lanzarConfeti(texto = "¡Felicidades!") {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });

  const congratsModal = document.getElementById("congrats-modal");
  congratsModal.textContent = texto;
  congratsModal.classList.add("active");

  setTimeout(() => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#27ae60", "#f39c12", "#007bff"],
    });
  }, 300);

  setTimeout(() => {
    congratsModal.classList.remove("active");
  }, 3000);
}

function actualizarProgreso() {
  const totalProf = Object.keys(profesorado.materias).filter(
    (id) => !profesorado.materias[id].nombre.toLowerCase().includes("optativa")
  ).length;
  const aprobadasProf = Object.keys(progresoProfesorado).filter(
    (id) =>
      progresoProfesorado[id] === "aprobada" &&
      !profesorado.materias[id].nombre.toLowerCase().includes("optativa")
  ).length;
  const regularizadasProf = Object.keys(progresoProfesorado).filter(
    (id) =>
      progresoProfesorado[id] === "regularizada" &&
      !profesorado.materias[id].nombre.toLowerCase().includes("optativa")
  ).length;
  const porcentajeAprobadasProf = (aprobadasProf / totalProf) * 100;
  const porcentajeRegularProf =
    ((aprobadasProf + regularizadasProf) / totalProf) * 100;

  const materiasObligatoriasLic = Object.keys(licenciatura.materias).filter(
    (id) => !licenciatura.materias[id].nombre.toLowerCase().includes("optativa")
  );
  const totalObligatoriasLic = materiasObligatoriasLic.length;

  const optativasDepartamento = Object.keys(licenciatura.materias).filter(
    (id) => licenciatura.materias[id].modulo === "optativas-departamento"
  );
  const puntosDepartamento = optativasDepartamento.reduce((total, id) => {
    if (progresoLicenciatura[id] === "aprobada") {
      return total + (licenciatura.materias[id].puntos || 0);
    }
    return total;
  }, 0);
  const completadoDepartamento = puntosDepartamento >= 90 ? 1 : 0;

  const optativasExtraDepartamento = Object.keys(licenciatura.materias).filter(
    (id) => licenciatura.materias[id].modulo === "optativas-extra-departamento"
  );
  const puntosExtraDepartamento = optativasExtraDepartamento.reduce(
    (total, id) => {
      if (progresoLicenciatura[id] === "aprobada") {
        return total + (licenciatura.materias[id].puntos || 0);
      }
      return total;
    },
    0
  );
  const completadoExtraDepartamento = puntosExtraDepartamento >= 100 ? 1 : 0;

  const totalLic = totalObligatoriasLic + 1 + 1;
  const aprobadasObligatoriasLic = materiasObligatoriasLic.filter(
    (id) => progresoLicenciatura[id] === "aprobada"
  ).length;
  const regularizadasObligatoriasLic = materiasObligatoriasLic.filter(
    (id) => progresoLicenciatura[id] === "regularizada"
  ).length;

  const aprobadasLic =
    aprobadasObligatoriasLic +
    completadoDepartamento +
    completadoExtraDepartamento;
  const regularizadasLic =
    aprobadasObligatoriasLic +
    regularizadasObligatoriasLic +
    completadoDepartamento +
    completadoExtraDepartamento;

  const porcentajeAprobadasLic = (aprobadasLic / totalLic) * 100;
  const porcentajeRegularLic = (regularizadasLic / totalLic) * 100;

  document.getElementById(
    "barra-aprobada-prof"
  ).style.width = `${porcentajeAprobadasProf}%`;
  document.getElementById(
    "barra-regular-prof"
  ).style.width = `${porcentajeRegularProf}%`;
  document.getElementById(
    "barra-aprobada-lic"
  ).style.width = `${porcentajeAprobadasLic}%`;
  document.getElementById(
    "barra-regular-lic"
  ).style.width = `${porcentajeRegularLic}%`;

  const userName = localStorage.getItem("userName") || "Usuario";
  document.getElementById(
    "progreso-profesorado-title"
  ).textContent = `Profesorado de ${userName}:`;
  document.getElementById(
    "progreso-licenciatura-title"
  ).textContent = `Licenciatura de ${userName}:`;

  document.getElementById(
    "porcentaje-prof"
  ).textContent = `Aprobadas: ${aprobadasProf}/${totalProf} (${porcentajeAprobadasProf.toFixed(
    2
  )}%) | Regularizadas + Aprobadas: ${
    aprobadasProf + regularizadasProf
  }/${totalProf} (${porcentajeRegularProf.toFixed(2)}%)`;
  document.getElementById(
    "porcentaje-lic"
  ).textContent = `Aprobadas: ${aprobadasLic}/${totalLic} (${porcentajeAprobadasLic.toFixed(
    2
  )}%) | Regularizadas + Aprobadas: ${regularizadasLic}/${totalLic} (${porcentajeRegularLic.toFixed(
    2
  )}%) | Optativas Depart.: ${puntosDepartamento}/90 | Optativas Extra: ${puntosExtraDepartamento}/100`;

  const newProfesoradoCompleted = porcentajeAprobadasProf >= 100;
  const newLicenciaturaCompleted =
    porcentajeAprobadasLic >= 100 &&
    puntosDepartamento >= 90 &&
    puntosExtraDepartamento >= 100;

  const nombre = document.getElementById("user-name-input").value;
  console.log(nombre);
  if (newProfesoradoCompleted && !profesoradoCompleted) {
    lanzarConfeti(`¡Felicidades Prof. ${nombre}!`);
    profesoradoCompleted = true;
  }
  if (newLicenciaturaCompleted && !licenciaturaCompleted) {
    lanzarConfeti(`¡Felicidades Lic. ${nombre}!`);
    licenciaturaCompleted = true;
  }

  const titleElement = document.getElementById("page-title");
  if (newProfesoradoCompleted && newLicenciaturaCompleted) {
    titleElement.textContent = `Felicidades Lic. Prof. ${userName}`;
  } else if (newProfesoradoCompleted) {
    titleElement.textContent = `Felicidades Profesor/a ${userName}`;
  } else if (newLicenciaturaCompleted) {
    titleElement.textContent = `Felicidades Licenciado/a ${userName}`;
  } else {
    titleElement.textContent = "Seguimiento de Materias - Física UNNE";
  }
}

function renderizarMaterias() {
  const contenedor = document.getElementById("listaMaterias");
  contenedor.innerHTML = "";

  const mostrarProfesorado =
    document.getElementById("filtro-profesorado").checked;
  const mostrarLicenciatura = document.getElementById(
    "filtro-licenciatura"
  ).checked;

  const todasMaterias = new Set([
    ...Object.keys(profesorado.materias),
    ...Object.keys(licenciatura.materias),
  ]);

  todasMaterias.forEach((id) => {
    const materiaDiv = document.createElement("div");
    materiaDiv.id = `materia-${id}`;
    contenedor.appendChild(materiaDiv);
    actualizarMateria(id, mostrarProfesorado, mostrarLicenciatura);
  });
}

function actualizarMateria(
  id,
  mostrarProfesorado = document.getElementById("filtro-profesorado").checked,
  mostrarLicenciatura = document.getElementById("filtro-licenciatura").checked
) {
  const enProfesorado = id in profesorado.materias;
  const enLicenciatura = id in licenciatura.materias;
  const esCompartida = enProfesorado && enLicenciatura;

  const mostrarMateria =
    (mostrarProfesorado && enProfesorado) ||
    (mostrarLicenciatura && enLicenciatura);
  if (!mostrarMateria) return;

  const materiaProf = enProfesorado ? profesorado.materias[id] : null;
  const materiaLic = enLicenciatura ? licenciatura.materias[id] : null;
  const estadoProf = progresoProfesorado[id] || "pendiente";
  const estadoLic = progresoLicenciatura[id] || "pendiente";

  const { puedeCursar: puedeCursarProf, puedeRendir: puedeRendirProf } =
    enProfesorado
      ? verificarCorrelativas(id, profesorado.materias, progresoProfesorado)
      : { puedeCursar: false, puedeRendir: false };
  const { puedeCursar: puedeCursarLic, puedeRendir: puedeRendirLic } =
    enLicenciatura
      ? verificarCorrelativas(id, licenciatura.materias, progresoLicenciatura)
      : { puedeCursar: false, puedeRendir: false };

  const nombre = (materiaProf || materiaLic).nombre;
  const año = (materiaProf || materiaLic).año;
  const periodo = (materiaProf || materiaLic).periodo;

  let moduloTexto = "";
  if (esCompartida && materiaProf.modulo === materiaLic.modulo) {
    moduloTexto = materiaProf.modulo;
  } else if (esCompartida) {
    moduloTexto = `Profesorado: ${materiaProf.modulo} | Licenciatura: ${materiaLic.modulo}`;
  } else if (enProfesorado) {
    moduloTexto = materiaProf.modulo;
  } else {
    moduloTexto = materiaLic.modulo;
  }

  const correlativasCursarProf =
    enProfesorado && materiaProf.correlativas.cursar
      ? materiaProf.correlativas.cursar
          .map((req) =>
            req.id
              ? `${profesorado.materias[req.id].nombre} (${req.cond})`
              : req.modulo
              ? `Módulo ${req.modulo}: ${req.aprobadas} materias aprobadas`
              : `Módulos ${req.modulos.join(", ")}: ${
                  req.aprobadas
                } materias aprobadas`
          )
          .join(", ")
      : "No tiene requisitos para cursar.";
  const correlativasAprobarProf =
    enProfesorado && materiaProf.correlativas.aprobar
      ? materiaProf.correlativas.aprobar
          .map((req) =>
            req.id
              ? `${profesorado.materias[req.id].nombre} (${req.cond})`
              : req.modulo
              ? `Módulo ${req.modulo}: ${req.aprobadas} materias aprobadas`
              : `Módulos ${req.modulos.join(", ")}: ${
                  req.aprobadas
                } materias aprobadas`
          )
          .join(", ")
      : "No tiene requisitos para aprobar.";
  const correlativasCursarLic =
    enLicenciatura && materiaLic.correlativas.cursar
      ? materiaLic.correlativas.cursar
          .map((req) =>
            req.id
              ? `${licenciatura.materias[req.id].nombre} (${req.cond})`
              : req.modulo
              ? `Módulo ${req.modulo}: ${req.aprobadas} materias aprobadas`
              : `Módulos ${req.modulos.join(", ")}: ${
                  req.aprobadas
                } materias aprobadas`
          )
          .join(", ")
      : "No tiene requisitos para cursar.";
  const correlativasAprobarLic =
    enLicenciatura && materiaLic.correlativas.aprobar
      ? materiaLic.correlativas.aprobar
          .map((req) =>
            req.id
              ? `${licenciatura.materias[req.id].nombre} (${req.cond})`
              : req.modulo
              ? `Módulo ${req.modulo}: ${req.aprobadas} materias aprobadas`
              : `Módulos ${req.modulos.join(", ")}: ${
                  req.aprobadas
                } materias aprobadas`
          )
          .join(", ")
      : "No tiene requisitos para aprobar.";

  const materiaDiv = document.getElementById(`materia-${id}`);
  let estadoFinal = "pendiente";
  if (esCompartida) {
    if (estadoProf === "aprobada" && estadoLic === "aprobada") {
      estadoFinal = "aprobada";
    } else if (
      (estadoProf === "aprobada" && estadoLic !== "aprobada") ||
      (estadoLic === "aprobada" && estadoProf !== "aprobada")
    ) {
      estadoFinal = "equivalencia-pendiente";
    } else if (estadoProf === "regularizada" || estadoLic === "regularizada") {
      estadoFinal = "regularizada";
    } else {
      estadoFinal = "pendiente";
    }
  } else if (enProfesorado) {
    estadoFinal = estadoProf;
  } else if (enLicenciatura) {
    estadoFinal = estadoLic;
  }
  materiaDiv.className = `materia ${estadoFinal}`;

  let estadosHTML = "";
  if (esCompartida) {
    estadosHTML = `
        <div class="estado">
          Estado (Profesorado):
          <select onchange="actualizarEstado('${id}', this.value, 'profesorado')">
            <option value="pendiente" ${
              estadoProf === "pendiente" ? "selected" : ""
            }>Pendiente</option>
            <option value="regularizada" ${
              estadoProf === "regularizada" ? "selected" : ""
            }>Regularizada</option>
            <option value="aprobada" ${
              estadoProf === "aprobada" ? "selected" : ""
            }>Aprobada</option>
          </select>
        </div>
        <div class="estado">
          Estado (Licenciatura):
          <select onchange="actualizarEstado('${id}', this.value, 'licenciatura')">
            <option value="pendiente" ${
              estadoLic === "pendiente" ? "selected" : ""
            }>Pendiente</option>
            <option value="regularizada" ${
              estadoLic === "regularizada" ? "selected" : ""
            }>Regularizada</option>
            <option value="aprobada" ${
              estadoLic === "aprobada" ? "selected" : ""
            }>Aprobada</option>
          </select>
        </div>
      `;
  } else if (enProfesorado) {
    estadosHTML = `
        <div class="estado">
          Estado (Profesorado):
          <select onchange="actualizarEstado('${id}', this.value, 'profesorado')">
            <option value="pendiente" ${
              estadoProf === "pendiente" ? "selected" : ""
            }>Pendiente</option>
            <option value="regularizada" ${
              estadoProf === "regularizada" ? "selected" : ""
            }>Regularizada</option>
            <option value="aprobada" ${
              estadoProf === "aprobada" ? "selected" : ""
            }>Aprobada</option>
          </select>
        </div>
      `;
  } else {
    estadosHTML = `
        <div class="estado">
          Estado (Licenciatura):
          <select onchange="actualizarEstado('${id}', this.value, 'licenciatura')">
            <option value="pendiente" ${
              estadoLic === "pendiente" ? "selected" : ""
            }>Pendiente</option>
            <option value="regularizada" ${
              estadoLic === "regularizada" ? "selected" : ""
            }>Regularizada</option>
            <option value="aprobada" ${
              estadoLic === "aprobada" ? "selected" : ""
            }>Aprobada</option>
          </select>
        </div>
      `;
  }

  let mensajesCursar = [];
  if (puedeCursarProf && estadoProf !== "aprobada")
    mensajesCursar.push("Profesorado");
  if (puedeCursarLic && estadoLic !== "aprobada")
    mensajesCursar.push("Licenciatura");
  let mensajesRendir = [];
  if (puedeRendirProf && estadoProf !== "aprobada")
    mensajesRendir.push("Profesorado");
  if (puedeRendirLic && estadoLic !== "aprobada")
    mensajesRendir.push("Licenciatura");

  materiaDiv.innerHTML = `
      <h3>${nombre} (${id})</h3>
      <p>Año: ${año} - Período: ${periodo}</p>
      <p>Módulo: ${moduloTexto}</p>
      ${estadosHTML}
      <div class="correlativas">
        ${
          enProfesorado
            ? `<p><strong>Para cursar (Profesorado):</strong> ${correlativasCursarProf}</p>`
            : ""
        }
        ${
          enProfesorado
            ? `<p><strong>Para aprobar (Profesorado):</strong> ${correlativasAprobarProf}</p>`
            : ""
        }
        ${
          enLicenciatura
            ? `<p><strong>Para cursar (Licenciatura):</strong> ${correlativasCursarLic}</p>`
            : ""
        }
        ${
          enLicenciatura
            ? `<p><strong>Para aprobar (Licenciatura):</strong> ${correlativasAprobarLic}</p>`
            : ""
        }
      </div>
      ${
        mensajesCursar.length > 0
          ? `<p class="cursar"> ¡Puedes cursar esta materia en ${mensajesCursar.join(
              " y "
            )}!</p>`
          : ""
      }
      ${
        mensajesRendir.length > 0
          ? `<p class="rendir"> ¡Puedes rendir esta materia en ${mensajesRendir.join(
              " y "
            )}!</p>`
          : ""
      }
      ${
        esCompartida &&
        ((estadoProf === "aprobada" && estadoLic !== "aprobada") ||
          (estadoLic === "aprobada" && estadoProf !== "aprobada"))
          ? `<button class="equivalencia" onclick="hacerEquivalencia('${id}')">Hacer equivalencia</button>`
          : ""
      }
    `;
}

function actualizarClaseBotones() {
  const botones = document.querySelectorAll(".filtros button");
  botones.forEach((btn) => btn.classList.remove("filtro-activo"));
  const botonActivo = document.getElementById(`filtro-${filtroActivo}`);
  if (botonActivo) {
    botonActivo.classList.add("filtro-activo");
  } else {
    console.error(`No se encontró el botón con ID: filtro-${filtroActivo}`);
  }
}

function aplicarFiltroActivo() {
  switch (filtroActivo) {
    case "todas":
      mostrarTodas();
      break;
    case "disponibles":
      mostrarDisponibles();
      break;
    case "rendir":
      mostrarRendir();
      break;
    case "equivalencias":
      mostrarEquivalencias();
      break;
    case "aprobadas":
      mostrarAprobadas();
      break;
    case "regulares":
      mostrarRegulares();
      break;
  }
  actualizarClaseBotones();
}

function mostrarTodas() {
  filtroActivo = "todas";
  const mostrarProfesorado =
    document.getElementById("filtro-profesorado").checked;
  const mostrarLicenciatura = document.getElementById(
    "filtro-licenciatura"
  ).checked;

  document.querySelectorAll(".materia").forEach((m) => {
    const id = m.id.replace("materia-", "");
    const enProfesorado = id in profesorado.materias;
    const enLicenciatura = id in licenciatura.materias;
    m.style.display =
      (mostrarProfesorado && enProfesorado) ||
      (mostrarLicenciatura && enLicenciatura)
        ? "block"
        : "none";
  });
  actualizarClaseBotones();
}

function mostrarDisponibles() {
  filtroActivo = "disponibles";
  const mostrarProfesorado =
    document.getElementById("filtro-profesorado").checked;
  const mostrarLicenciatura = document.getElementById(
    "filtro-licenciatura"
  ).checked;

  document.querySelectorAll(".materia").forEach((m) => {
    const esCompartida = m.querySelectorAll(".estado").length === 2;
    const id = m.id.replace("materia-", "");
    const enProfesorado = id in profesorado.materias;
    const enLicenciatura = id in licenciatura.materias;

    const mostrarMateria =
      (mostrarProfesorado && enProfesorado) ||
      (mostrarLicenciatura && enLicenciatura);
    if (!mostrarMateria) {
      m.style.display = "none";
      return;
    }

    const estadoProf = progresoProfesorado[id] || "pendiente";
    const estadoLic = progresoLicenciatura[id] || "pendiente";
    const { puedeCursar: puedeCursarProf } = enProfesorado
      ? verificarCorrelativas(id, profesorado.materias, progresoProfesorado)
      : { puedeCursar: false };
    const { puedeCursar: puedeCursarLic } = enLicenciatura
      ? verificarCorrelativas(id, licenciatura.materias, progresoLicenciatura)
      : { puedeCursar: false };

    const mostrarProf =
      puedeCursarProf &&
      estadoProf !== "aprobada" &&
      estadoProf !== "regularizada";
    const mostrarLic =
      puedeCursarLic &&
      estadoLic !== "aprobada" &&
      estadoLic !== "regularizada";

    m.style.display =
      (esCompartida && (mostrarProf || mostrarLic)) ||
      (!esCompartida && (mostrarProf || mostrarLic))
        ? "block"
        : "none";
  });
  actualizarClaseBotones();
}

function mostrarRendir() {
  filtroActivo = "rendir";
  const mostrarProfesorado =
    document.getElementById("filtro-profesorado").checked;
  const mostrarLicenciatura = document.getElementById(
    "filtro-licenciatura"
  ).checked;

  document.querySelectorAll(".materia").forEach((m) => {
    const esCompartida = m.querySelectorAll(".estado").length === 2;
    const id = m.id.replace("materia-", "");
    const enProfesorado = id in profesorado.materias;
    const enLicenciatura = id in licenciatura.materias;

    const mostrarMateria =
      (mostrarProfesorado && enProfesorado) ||
      (mostrarLicenciatura && enLicenciatura);
    if (!mostrarMateria) {
      m.style.display = "none";
      return;
    }

    const estadoProf = progresoProfesorado[id] || "pendiente";
    const estadoLic = progresoLicenciatura[id] || "pendiente";
    const { puedeRendir: puedeRendirProf } = enProfesorado
      ? verificarCorrelativas(id, profesorado.materias, progresoProfesorado)
      : { puedeRendir: false };
    const { puedeRendir: puedeRendirLic } = enLicenciatura
      ? verificarCorrelativas(id, licenciatura.materias, progresoLicenciatura)
      : { puedeRendir: false };

    const mostrarProf = puedeRendirProf && estadoProf !== "aprobada";
    const mostrarLic = puedeRendirLic && estadoLic !== "aprobada";

    m.style.display =
      (esCompartida && (mostrarProf || mostrarLic)) ||
      (!esCompartida && (mostrarProf || mostrarLic))
        ? "block"
        : "none";
  });
  actualizarClaseBotones();
}

function mostrarEquivalencias() {
  filtroActivo = "equivalencias";
  const mostrarProfesorado =
    document.getElementById("filtro-profesorado").checked;
  const mostrarLicenciatura = document.getElementById(
    "filtro-licenciatura"
  ).checked;

  document.querySelectorAll(".materia").forEach((m) => {
    const esCompartida = m.querySelectorAll(".estado").length === 2;
    const id = m.id.replace("materia-", "");
    const enProfesorado = id in profesorado.materias;
    const enLicenciatura = id in licenciatura.materias;

    const mostrarMateria =
      (mostrarProfesorado && enProfesorado) ||
      (mostrarLicenciatura && enLicenciatura);
    if (!mostrarMateria) {
      m.style.display = "none";
      return;
    }

    const botonEquivalencia = m.querySelector(".equivalencia");
    m.style.display = esCompartida && botonEquivalencia ? "block" : "none";
  });
  actualizarClaseBotones();
}

function mostrarAprobadas() {
  filtroActivo = "aprobadas";
  const mostrarProfesorado =
    document.getElementById("filtro-profesorado").checked;
  const mostrarLicenciatura = document.getElementById(
    "filtro-licenciatura"
  ).checked;

  document.querySelectorAll(".materia").forEach((m) => {
    const esCompartida = m.querySelectorAll(".estado").length === 2;
    const id = m.id.replace("materia-", "");
    const enProfesorado = id in profesorado.materias;
    const enLicenciatura = id in licenciatura.materias;

    const mostrarMateria =
      (mostrarProfesorado && enProfesorado) ||
      (mostrarLicenciatura && enLicenciatura);
    if (!mostrarMateria) {
      m.style.display = "none";
      return;
    }

    const estadoProf = progresoProfesorado[id] || "pendiente";
    const estadoLic = progresoLicenciatura[id] || "pendiente";
    m.style.display =
      (esCompartida &&
        (estadoProf === "aprobada" || estadoLic === "aprobada")) ||
      (!esCompartida && (estadoProf === "aprobada" || estadoLic === "aprobada"))
        ? "block"
        : "none";
  });
  actualizarClaseBotones();
}

function mostrarRegulares() {
  filtroActivo = "regulares";
  const mostrarProfesorado =
    document.getElementById("filtro-profesorado").checked;
  const mostrarLicenciatura = document.getElementById(
    "filtro-licenciatura"
  ).checked;

  document.querySelectorAll(".materia").forEach((m) => {
    const esCompartida = m.querySelectorAll(".estado").length === 2;
    const id = m.id.replace("materia-", "");
    const enProfesorado = id in profesorado.materias;
    const enLicenciatura = id in licenciatura.materias;

    const mostrarMateria =
      (mostrarProfesorado && enProfesorado) ||
      (mostrarLicenciatura && enLicenciatura);
    if (!mostrarMateria) {
      m.style.display = "none";
      return;
    }

    const estadoProf = progresoProfesorado[id] || "pendiente";
    const estadoLic = progresoLicenciatura[id] || "pendiente";
    m.style.display =
      (esCompartida &&
        (estadoProf === "regularizada" || estadoLic === "regularizada") &&
        !(estadoProf === "aprobada" || estadoLic === "aprobada")) ||
      (!esCompartida &&
        ((estadoProf === "regularizada" && estadoLic !== "aprobada") ||
          (estadoLic === "regularizada" && estadoProf !== "aprobada")))
        ? "block"
        : "none";
  });
  actualizarClaseBotones();
}

function resetearProgreso() {
  if (
    confirm(
      "¿Estás seguro de que quieres resetear todo el progreso? Esta acción no se puede deshacer."
    )
  ) {
    progresoProfesorado = {};
    progresoLicenciatura = {};
    localStorage.removeItem("progresoProfesorado");
    localStorage.removeItem("progresoLicenciatura");
    profesoradoCompleted = false;
    licenciaturaCompleted = false;
    renderizarMaterias();
    actualizarProgreso();
    aplicarFiltroActivo();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const recordar = localStorage.getItem("recordarFiltros") === "true";
  if (recordar) {
    const profChecked = localStorage.getItem("filtroProfesorado") === "true";
    const licChecked = localStorage.getItem("filtroLicenciatura") === "true";
    document.getElementById("filtro-profesorado").checked = profChecked;
    document.getElementById("filtro-licenciatura").checked = licChecked;
    document.getElementById("recordar-filtros").checked = true;
  } else {
    document.getElementById("filtro-profesorado").checked = true;
    document.getElementById("filtro-licenciatura").checked = true;
    document.getElementById("recordar-filtros").checked = false;
  }

  const userNameInput = document.getElementById("user-name-input");
  const savedName = localStorage.getItem("userName");
  if (savedName) userNameInput.value = savedName;
  userNameInput.addEventListener("input", () => {
    localStorage.setItem("userName", userNameInput.value);
    actualizarProgreso();
  });

  const themeCheckbox = document.getElementById("theme-checkbox");
  const currentTheme = localStorage.getItem("theme") || "dark";
  themeCheckbox.checked = currentTheme === "light";
  document.body.classList.add(currentTheme + "-theme");

  themeCheckbox.addEventListener("change", () => {
    const newTheme = themeCheckbox.checked ? "light" : "dark";
    document.body.classList.remove("dark-theme", "light-theme");
    document.body.classList.add(newTheme + "-theme");
    localStorage.setItem("theme", newTheme);
  });

  document.getElementById("filtro-todas").addEventListener("click", () => {
    filtroActivo = "todas";
    aplicarFiltroActivo();
  });
  document
    .getElementById("filtro-disponibles")
    .addEventListener("click", () => {
      filtroActivo = "disponibles";
      aplicarFiltroActivo();
    });
  document.getElementById("filtro-rendir").addEventListener("click", () => {
    filtroActivo = "rendir";
    aplicarFiltroActivo();
  });
  document
    .getElementById("filtro-equivalencias")
    .addEventListener("click", () => {
      filtroActivo = "equivalencias";
      aplicarFiltroActivo();
    });
  document.getElementById("filtro-aprobadas").addEventListener("click", () => {
    filtroActivo = "aprobadas";
    aplicarFiltroActivo();
  });
  document.getElementById("filtro-regulares").addEventListener("click", () => {
    filtroActivo = "regulares";
    aplicarFiltroActivo();
  });

  document
    .getElementById("filtro-profesorado")
    .addEventListener("change", aplicarFiltroActivo);
  document
    .getElementById("filtro-licenciatura")
    .addEventListener("change", aplicarFiltroActivo);

  document
    .getElementById("recordar-filtros")
    .addEventListener("change", (e) => {
      const recordar = e.target.checked;
      localStorage.setItem("recordarFiltros", recordar);
      if (recordar) {
        const profChecked =
          document.getElementById("filtro-profesorado").checked;
        const licChecked = document.getElementById(
          "filtro-licenciatura"
        ).checked;
        localStorage.setItem("filtroProfesorado", profChecked);
        localStorage.setItem("filtroLicenciatura", licChecked);
      } else {
        localStorage.removeItem("filtroProfesorado");
        localStorage.removeItem("filtroLicenciatura");
      }
    });

  cargarDatos();
});
