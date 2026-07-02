import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://tournaments.azurewebsites.net/costablancacupfutsal/1185?lang=es';
const CATEGORIAS = ['B10', 'B12', 'B14', 'B16', 'B19'];

function leerFilas(filas) {
  return filas
    .filter(celdas => celdas.length === 9)
    .map(celdas => ({
      num: celdas[0],
      hora: celdas[1],
      local: celdas[2],
      visitante: celdas[3],
      resultado: celdas[4] || null,
      campo: celdas[5],
      fase: celdas[6],
      categoria: celdas[7],
      grupo: celdas[8],
    }))
    .filter(p => p.num && p.categoria);
}

async function leerCategoria(page, categoria) {
  const boton = page.locator('label.e-btn').filter({
    hasText: new RegExp(`^${categoria}$`)
  });

  await boton.click();

  await page
    .locator('h4')
    .filter({ hasText: new RegExp(`^${categoria}$`) })
    .waitFor({ timeout: 15000 });

  await page.waitForFunction(
    cat => {
      const filas = Array.from(document.querySelectorAll('table.table-striped tbody tr'));
      return filas.some(tr => {
        if (tr.classList.contains('th-dark')) return false;
        const celdas = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
        return celdas.length === 9 && celdas[7] === cat;
      });
    },
    categoria,
    { timeout: 20000 }
  );

  const filas = await page.$$eval('table.table-striped tbody tr', (trs, cat) =>
    trs
      .filter(tr => !tr.classList.contains('th-dark'))
      .map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()))
      .filter(celdas => celdas.length === 9 && celdas[7] === cat),
    categoria
  );

  return leerFilas(filas);
}

(async () => {
  let datosAnteriores = { partidos: [] };

  if (fs.existsSync('resultados.json')) {
    try {
      datosAnteriores = JSON.parse(fs.readFileSync('resultados.json', 'utf8'));
    } catch {
      console.warn('⚠ No se pudo leer resultados.json anterior.');
    }
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

  const partidosPorCategoria = {};

  for (const categoria of CATEGORIAS) {
    try {
      const partidosCategoria = await leerCategoria(page, categoria);

      console.log(`✔ ${categoria}: ${partidosCategoria.length} partidos leídos`);

      if (partidosCategoria.length === 0) {
        throw new Error(`0 partidos leídos para ${categoria}`);
      }

      partidosPorCategoria[categoria] = partidosCategoria;
    } catch (error) {
      console.warn(`⚠ Error leyendo ${categoria}: ${error.message}`);
      console.warn(`⚠ Se conserva la versión anterior de ${categoria}`);

      partidosPorCategoria[categoria] = datosAnteriores.partidos.filter(
        p => p.categoria === categoria
      );
    }
  }

  await browser.close();

  const todosLosPartidos = CATEGORIAS.flatMap(
    categoria => partidosPorCategoria[categoria] || []
  );

  const salida = {
    actualizado: new Date().toISOString(),
    partidos: todosLosPartidos,
  };

  fs.writeFileSync('resultados.json', JSON.stringify(salida, null, 2));

  console.log(`Guardado resultados.json con ${todosLosPartidos.length} partidos en total.`);
})();
