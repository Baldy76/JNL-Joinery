// Version: 1.4 | Date: April 2026
const db = localforage.createInstance({ name: "DNL_DB" });

// --- VIEW NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.add('opacity-50');
        btn.classList.remove('opacity-100', 'text-[#5c4033]');
    });
    event.currentTarget.classList.remove('opacity-50');
    event.currentTarget.classList.add('opacity-100', 'text-[#5c4033]');

    if(tabId === 'dashboard') loadQuotes();
}

// --- SETTINGS (ADMIN) ---
async function loadSettings() {
    const settings = await db.getItem('dnl_settings');
    if(settings) {
        document.getElementById('bankName').value = settings.bankName || '';
        document.getElementById('bankSort').value = settings.bankSort || '';
        document.getElementById('bankAcc').value = settings.bankAcc || '';
    }
}

async function saveSettings() {
    const settings = {
        bankName: document.getElementById('bankName').value,
        bankSort: document.getElementById('bankSort').value,
        bankAcc: document.getElementById('bankAcc').value
    };
    await db.setItem('dnl_settings', settings);
    alert("Bank details saved successfully.");
}

// --- DYNAMIC MATERIALS LIST ---
function addMaterialRow() {
    const container = document.getElementById('materialsContainer');
    const row = document.createElement('div');
    row.className = 'flex space-x-2 material-row';
    row.innerHTML = `
        <input type="text" class="ios-input w-16 mat-qty" placeholder="Qty">
        <input type="text" class="ios-input flex-1 mat-desc" placeholder="Item (e.g. Posts)">
        <input type="number" class="ios-input w-24 mat-cost calc-trigger" placeholder="Cost £">
    `;
    container.appendChild(row);
    bindCalcTriggers();
}

function bindCalcTriggers() {
    document.querySelectorAll('.calc-trigger').forEach(input => {
        input.removeEventListener('input', calculateTotal);
        input.addEventListener('input', calculateTotal);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    for(let i=0; i<5; i++) { addMaterialRow(); }
    loadSettings();
});

// --- CALCULATIONS ---
function calculateTotal() {
    let matTotal = 0;
    document.querySelectorAll('.mat-cost').forEach(input => {
        matTotal += parseFloat(input.value) || 0;
    });
    
    const fuel = parseFloat(document.getElementById('costFuel').value) || 0;
    const misc = parseFloat(document.getElementById('costMisc').value) || 0;
    
    // Calculate Labour dynamically
    const hours = parseFloat(document.getElementById('labourHours').value) || 0;
    const rate = parseFloat(document.getElementById('labourRate').value) || 0;
    const labTotal = hours * rate;
    
    const total = matTotal + fuel + misc + labTotal;
    document.getElementById('displayTotal').innerText = `£${total.toFixed(2)}`;
    return total;
}

// --- SAVE & PDF LOGIC ---
async function saveAndGenerate() {
    const name = document.getElementById('custName').value;
    const desc = document.getElementById('jobDesc').value;
    const total = calculateTotal();
    const deposit = parseFloat(document.getElementById('quoteDeposit').value) || 0;
    const paymentMethod = document.getElementById('quotePaymentMethod').value;

    if (!name) return alert("Please enter a customer name.");

    const materialsList = [];
    let matTotalCost = 0;
    document.querySelectorAll('.material-row').forEach(row => {
        const qty = row.querySelector('.mat-qty').value;
        const mDesc = row.querySelector('.mat-desc').value;
        const cost = parseFloat(row.querySelector('.mat-cost').value) || 0;
        
        if (qty || mDesc || cost) {
            materialsList.push({ qty, desc: mDesc, cost });
            matTotalCost += cost;
        }
    });

    const hours = parseFloat(document.getElementById('labourHours').value) || 0;
    const rate = parseFloat(document.getElementById('labourRate').value) || 0;
    const labTotal = hours * rate;

    const quoteData = {
        id: `DNL-${Math.floor(Math.random() * 10000)}`,
        date: new Date().toLocaleDateString(),
        customer: name,
        description: desc,
        breakdown: {
            materialsList: materialsList,
            materials: matTotalCost,
            fuel: parseFloat(document.getElementById('costFuel').value) || 0,
            misc: parseFloat(document.getElementById('costMisc').value) || 0,
            labour: labTotal, // Kept for backwards compatibility
            labourHours: hours,
            labourRate: rate
        },
        total: total,
        deposit: deposit,
        paymentMethod: paymentMethod
    };

    await db.setItem(quoteData.id, quoteData);
    
    document.querySelectorAll('input:not(#bankName, #bankSort, #bankAcc), textarea').forEach(el => el.value = '');
    calculateTotal();
    
    generatePDF(quoteData);
    switchTab('dashboard');
}

// --- DASHBOARD ---
async function loadQuotes() {
    const list = document.getElementById('quoteList');
    list.innerHTML = '';
    let keys = await db.keys();
    
    const quoteKeys = keys.filter(k => k !== 'dnl_settings');

    if (quoteKeys.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-center mt-10">No quotes saved yet.</p>';
        return;
    }

    // Reverse the array so the newest quotes appear at the top
    for (let key of quoteKeys.reverse()) {
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

// --- ADMIN ---
async function clearDatabase() {
    if(confirm("Are you sure? This will delete all saved quotes from this device.")) {
        const settings = await db.getItem('dnl_settings');
        await db.clear();
        if(settings) await db.setItem('dnl_settings', settings);
        
        loadQuotes();
        alert("Database cleared (Bank details preserved).");
    }
}

// --- PDF GENERATOR ---
async function generatePDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const brandDark = [74, 55, 40]; 
    
    doc.setFillColor(...brandDark);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("D.N.L JOINERY & FENCING", 20, 22);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`QUOTE REF: ${data.id}`, 150, 50);
    doc.text(`DATE: ${data.date}`, 150, 55);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("PREPARED FOR:", 20, 50);
    doc.setFont("helvetica", "normal");
    doc.text(data.customer, 20, 57);
    doc.setFontSize(10);
    doc.text(data.description, 20, 64, { maxWidth: 100 });

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(20, 85, 190, 85);
    doc.setFont("helvetica", "bold");
    doc.text("ITEM DESCRIPTION", 20, 92);
    doc.text("COST", 170, 92);
    doc.line(20, 96, 190, 96);

    let y = 106;
    doc.setFont("helvetica", "normal");
    
    if (data.breakdown.materialsList && data.breakdown.materialsList.length > 0) {
        data.breakdown.materialsList.forEach(m => {
            const lineText = `${m.qty ? m.qty + ' x ' : ''}${m.desc || 'Material'}`;
            doc.text(lineText, 20, y);
            if(m.cost > 0) doc.text(`£${m.cost.toFixed(2)}`, 170, y);
            y += 10;
        });
    }

    const remainingItems = [
        ["Fuel & Travel", data.breakdown.fuel],
        ["Misc. Expenses", data.breakdown.misc],
        ["Labour", data.breakdown.labour] // Just prints the total calculated figure
    ];

    remainingItems.forEach(item => {
        if (item[1] > 0) { 
            doc.text(item[0], 20, y);
            doc.text(`£${item[1].toFixed(2)}`, 170, y);
            y += 10;
        }
    });

    doc.line(120, y + 5, 190, y + 5);
    
    // --- FINANCIAL SUMMARY ---
    y += 15;
    doc.setFontSize(12);
    doc.text("GRAND TOTAL:", 120, y);
    doc.text(`£${data.total.toFixed(2)}`, 170, y);
    
    if (data.deposit && data.deposit > 0) {
        y += 8;
        doc.text("DEPOSIT REQUIRED:", 120, y);
        doc.text(`£${parseFloat(data.deposit).toFixed(2)}`, 170, y);
        
        y += 8;
        doc.setFont("helvetica", "bold");
        const balance = data.total - parseFloat(data.deposit);
        doc.text("REMAINING BALANCE:", 120, y);
        doc.text(`£${balance.toFixed(2)}`, 170, y);
    }
    
    // --- PAYMENT INSTRUCTIONS ---
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PAYMENT INSTRUCTIONS:", 20, y);
    
    doc.setFont("helvetica", "normal");
    y += 6;
    const method = data.paymentMethod || "Cash";
    doc.text(`Preferred Payment Method: ${method}`, 20, y);

    if (method === "Bank Transfer") {
        const settings = await db.getItem('dnl_settings');
        if (settings && settings.bankName) {
            y += 6;
            doc.text(`Account Name: ${settings.bankName}`, 20, y);
            y += 6;
            doc.text(`Sort Code: ${settings.bankSort}`, 20, y);
            y += 6;
            doc.text(`Account No: ${settings.bankAcc}`, 20, y);
        } else {
            y += 6;
            doc.text("Please contact us for bank details.", 20, y);
        }
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for choosing D.N.L Joinery. We appreciate your business.", 105, 280, null, null, "center");

    doc.save(`DNL_Quote_${data.customer.replace(/\s+/g, '_')}.pdf`);
}
