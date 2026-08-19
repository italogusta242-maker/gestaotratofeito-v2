// Gera um PDF em UMA página, com largura A4 (210mm) e altura ajustada ao conteúdo.
// Import dinâmico: html2canvas + jsPDF só carregam ao chamar (evita inflar bundle inicial).

/** A4 em pixels @96dpi. Usado como piso quando o elemento é mais estreito. */
const A4_WIDTH_PX = 794;

export async function saveElementAsPdf(element: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // Se o elemento renderiza mais estreito que A4 (ex: numa view mobile, ou
  // porque o pai limita), forçamos janela de renderização em A4 pra ele
  // ocupar a página inteira. Sem isso, o conteúdo sai numa coluna estreita
  // e sobra margem branca.
  const larguraElemento = Math.max(element.offsetWidth, element.scrollWidth);
  const windowWidth = Math.max(larguraElemento, A4_WIDTH_PX);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth,
    width: windowWidth,
  });

  const pageWidthMm = 210;
  const pageHeightMm = (canvas.height * pageWidthMm) / canvas.width;

  const pdf = new jsPDF({
    orientation: pageHeightMm >= pageWidthMm ? "portrait" : "landscape",
    unit: "mm",
    format: [pageWidthMm, pageHeightMm],
  });

  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageWidthMm, pageHeightMm);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
