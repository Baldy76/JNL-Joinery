// Initialize database
const db = localforage.createInstance({ name: "DNL_DB" });

// --- VIEW NAVIGATION (iOS Style) ---
function switchTab(tabId) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    // Show selected view
    document.getElementById(`view-${tabId}`).classList.add('active');
    
    // Update tab styling
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.add('opacity-50');
        btn.classList.remove('opacity-100', 'text-[#5c4033]');
    });
    event.currentTarget.classList.remove('opacity-50');
    event.currentTarget.classList.add('opacity-100', 'text-[#5c4033]');

    if(tabId === 'dashboard') loadQuotes();
}

// --- CALCULATIONS ---
document.querySelectorAll('.calc-trigger').forEach(input => {
    input.addEventListener('input', calculateTotal);
});

function calculateTotal() {
    const mat = parseFloat(document.getElementById('costMaterials').value) || 0;
    const fuel = parseFloat(document.getElementById('costFuel').value) || 0;
    const misc = parseFloat(document.getElementById('costMisc').value) || 0;
    const lab = parseFloat(document.getElementById('costLabour').value) || 0;
    
    const total = mat + fuel + misc + lab;
    document.getElementById('displayTotal').innerText = `£${total.toFixed(2)}`;
    return total;
}

// --- SAVE & PDF LOGIC ---
async function saveAndGenerate() {
    const name = document.getElementById('custName').value;
    const desc = document.getElementById('jobDesc').value;
    const total = calculateTotal();

    if (!name) return alert("Please enter a customer name.");

    const quoteData = {
        id: `DNL-${Math.floor(Math.random() * 10000)}`,
        date: new Date().toLocaleDateString(),
        customer: name,
        description: desc,
        breakdown: {
            materials: parseFloat(document.getElementById('costMaterials').value) || 0,
            fuel: parseFloat(document.getElementById('costFuel').value) || 0,
            misc: parseFloat(document.getElementById('costMisc').value) || 0,
            labour: parseFloat(document.getElementById('costLabour').value) || 0
        },
        total: total
    };

    // Save to Phone/iPad Database
    await db.setItem(quoteData.id, quoteData);
    
    // Clear form
    document.querySelectorAll('input, textarea').forEach(el => el.value = '');
    calculateTotal();
    
    // Generate PDF and switch to dashboard
    generatePDF(quoteData);
    switchTab('dashboard');
}

// --- DASHBOARD (LOAD QUOTES) ---
async function loadQuotes() {
    const list = document.getElementById('quoteList');
    list.innerHTML = '';
    
    let keys = await db.keys();
    if (keys.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-center mt-10">No quotes saved yet.</p>';
        return;
    }

    for (let key of keys) {
        const quote = await db.getItem(key);
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center";
        card.innerHTML = `
            <div>
                <h4 class="font-bold text-gray-800">${quote.customer}</h4>
                <p class="text-xs text-gray-500">${quote.date} | ${quote.id}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-[#4a3728]">£${quote.total.toFixed(2)}</p>
                <button onclick="reprintPDF('${quote.id}')" class="text-xs text-blue-500 mt-1">Download PDF</button>
            </div>
        `;
        list.appendChild(card);
    }
}

async function reprintPDF(id) {
    const quote = await db.getItem(id);
    generatePDF(quote);
}

// --- ADMIN / CLEAR DB ---
async function clearDatabase() {
    if(confirm("Are you sure? This will delete all saved quotes from this device.")) {
        await db.clear();
        loadQuotes();
        alert("Database cleared.");
    }
}

// --- PDF GENERATOR ---
function generatePDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Brand Colors
    const brandDark = [74, 55, 40]; // #4a3728
    
    // Header
    doc.setFillColor(...brandDark);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("D.N.L JOINERY & FENCING", 20, 22);

    // Meta details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`QUOTE REF: ${data.id}`, 150, 50);
    doc.text(`DATE: ${data.date}`, 150, 55);

    // Customer Info
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("PREPARED FOR:", 20, 50);
    doc.setFont("helvetica", "normal");
    doc.text(data.customer, 20, 57);
    doc.setFontSize(10);
    doc.text(data.description, 20, 64, { maxWidth: 100 });

    // Table Header
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(20, 85, 190, 85);
    doc.setFont("helvetica", "bold");
    doc.text("ITEM DESCRIPTION", 20, 92);
    doc.text("COST", 170, 92);
    doc.line(20, 96, 190, 96);

    // Table Rows
    let y = 106;
    doc.setFont("helvetica", "normal");
    
    const items = [
        ["Materials", data.breakdown.materials],
        ["Fuel & Travel", data.breakdown.fuel],
        ["Misc. Expenses", data.breakdown.misc],
        ["Labour", data.breakdown.labour]
    ];

    items.forEach(item => {
        if (item[1] > 0) { // Only print if cost > 0
            doc.text(item[0], 20, y);
            doc.text(`£${item[1].toFixed(2)}`, 170, y);
            y += 10;
        }
    });

    // Total Section
    doc.line(140, y + 5, 190, y + 5);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL DUE:", 130, y + 15);
    doc.text(`£${data.total.toFixed(2)}`, 170, y + 15);

    // Footer
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for choosing D.N.L Joinery. We appreciate your business.", 105, 280, null, null, "center");

    // Save File
    doc.save(`DNL_Quote_${data.customer.replace(/\s+/g, '_')}.pdf`);
}

// Initial load
window.onload = loadQuotes;
