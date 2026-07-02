// scrape.js
// Robot que entra en la web del Costa Blanca Futsal Cup, recorre cada
// categoría (B10, B12, B14, B16, B19) y guarda todos los partidos
// (con su resultado, si ya se ha jugado) en resultados.json.

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
    }));
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });

  const todosLosPartidos = [];

  for (const categoria of CATEGORIAS) {
    // Pulsa el botón de la categoría (coincidencia exacta, p.ej. "B12" y no "G12")
    const boton = page.locator('label.e-btn').filter({ hasText: new RegExp(`^${categoria}$`) });
    await boton.click();

    // Espera a que el encabezado confirme que cambió de categoría
    await page.locator('h4').filter({ hasText: new RegExp(`^${categoria}$`) }).waitFor({ timeout: 10000 });
    await page.waitForTimeout2000); // pequeño margen para que la tabla termine de pintarse

    const filas = await page.$$eval('table.table-striped tbody tr', trs =>
      trs
        .filter(tr => !tr.classList.contains('th-dark')) // descarta las filas de separador de fecha
        .map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()))
    );

    leerFilas(filas).forEach(p => todosLosPartidos.push(p));
    console.log(`✔ ${categoria}: ${leerFilas(filas).length} if (leerFilas(filas).length === 0) {
  throw new Error(`No se han leído partidos para ${categoria}`);
}partidos leídos`);
  }

  await browser.close();

  const salida = {
    actualizado: new Date().toISOString(),
    partidos: todosLosPartidos,
  };

  fs.writeFileSync('resultados.json', JSON.stringify(salida, null, 2));
  console.log(`Guardado resultados.json con ${todosLosPartidos.length} partidos en total.`);
})();
