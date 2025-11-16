import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export const useChartExport = () => {
  /**
   * Exporte un graphique Chart.js en PDF
   * @param chartElement - L'élément DOM contenant le graphique
   * @param filename - Le nom du fichier PDF (sans extension)
   * @param title - Le titre à afficher en haut du PDF
   */
  const exportChartToPDF = async (
    chartElement: HTMLElement,
    filename: string,
    title: string
  ): Promise<void> => {
    try {
      // Capturer le graphique en tant qu'image avec html2canvas
      const canvas = await html2canvas(chartElement, {
        backgroundColor: null,
        scale: 2, // Haute résolution
        logging: false,
      })

      // Créer un nouveau PDF en format A4
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      // Calculer les dimensions pour s'adapter à la page
      const imgWidth = 280 // Largeur de l'image en mm (format paysage)
      const pageHeight = 210 // Hauteur de la page A4 en mode paysage
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight

      // Convertir le canvas en image data URL
      const imgData = canvas.toDataURL('image/png')

      // Ajouter le titre
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text(title, 148.5, 15, { align: 'center' })

      // Ajouter l'image
      let position = 25

      pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Si l'image est plus grande qu'une page, ajouter des pages supplémentaires
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Ajouter un footer avec la date d'export
      const totalPages = pdf.internal.pages.length - 1
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        const today = new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
        pdf.text(`Exporté le ${today}`, 148.5, 205, { align: 'center' })
      }

      // Télécharger le PDF
      pdf.save(`${filename}.pdf`)
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error)
      throw error
    }
  }

  return {
    exportChartToPDF,
  }
}
