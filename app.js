async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const name = document.getElementById('custName').value;
    const desc = document.getElementById('jobDesc').value;
    const price = document.getElementById('jobPrice').value;

    if(!name || !price) {
        alert("Please enter at least a name and price.");
        return;
    }

    // PDF Branding
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Blue
    doc.text("DAVID'S JOINERY", 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 30);
    
    // Horizontal Line
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);

    // Content
    doc.setFontSize(14);
    doc.text("QUOTE FOR:", 20, 50);
    doc.setFont(undefined, 'bold');
    doc.text(name.toUpperCase(), 20, 57);

    doc.setFont(undefined, 'normal');
    doc.text("JOB DETAILS:", 20, 75);
    doc.setFontSize(11);
    doc.text(desc, 20, 82, { maxWidth: 170 });

    doc.setFontSize(16);
    doc.text(`TOTAL PRICE: £${price}`, 20, 120);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Thank you for choosing David's Joinery.", 20, 150);

    // Save File
    doc.save(`Quote_${name.replace(/\s+/g, '_')}.pdf`);
}
