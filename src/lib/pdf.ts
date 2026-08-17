// Gera um PDF em UMA página, com largura A4 (210mm) e altura ajustada ao conteúdo.
// Import dinâmico: html2canvas + jsPDF só carregam ao chamar (evita inflar bundle inicial).
export async function saveElementAsPdf(element: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: element.scrollWidth,
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
