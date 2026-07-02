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
  let datosAnteriores = { partidos: [] };

  if (fs.existsSync('resultados.json')) {
    datosAnteriores = JSON.parse(fs.readFileSync('resultados.json', 'utf8'));
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });

  const partidosPorCategoria = {};

  for (const categoria of CATEGORIAS) {
    const boton = page.locator('label.e-btn').filter({
      hasText: new RegExp(`^${categoria}$`)
    });

    await boton.click();

    await page
      .locator('h4')
      .filter({ hasText: new RegExp(`^${categoria}$`) })
      .waitFor({ timeout: 10000 });

    await page.waitForTimeout(2000);

    const filas = await page.$$eval('table.table-striped tbody tr', trs =>
      trs
        .filter(tr => !tr.classList.contains('th-dark'))
        .map(tr =>
          Array.from(tr.querySelectorAll('td')).map(td =>
            td.textContent.trim()
          )
        )
    );

    const partidosCategoria = leerFilas(filas);

    console.log(`✔ ${categoria}: ${partidosCategoria.length} partidos leídos`);

    if (partidosCategoria.length === 0) {
      console.warn(`⚠ No se han leído partidos para ${categoria}. Se conserva la versión anterior.`);
      partidosPorCategoria[categoria] = datosAnteriores.partidos.filter(
        p => p.categoria === categoria
      );
      continue;
    }

    partidosPorCategoria[categoria] = partidosCategoria;
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

  console.log(
    `Guardado resultados.json con ${todosLosPartidos.length} partidos en total.`
  );
})();
