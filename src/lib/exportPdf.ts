import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#09090b',
    scale: 2,
  })
  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()

  const imgWidth = pdfWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pdfHeight

  while (heightLeft > 0) {
    position -= pdfHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pdfHeight
  }

  pdf.save(filename)
}
