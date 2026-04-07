// Version: 1.7 | Date: April 2026
const db = localforage.createInstance({ name: "DNL_DB" });

// --- VIEW NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');
    
    // Update tab bar styling
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active-tab', 'text-[#4a3728]');
        btn.classList.add('text-stone-400');
    });
    event.currentTarget.classList.remove('text-stone-400');
    if(tabId !== 'new-quote') {
        event.currentTarget.classList.add('text-[#4a3728]', 'active-tab');
    }

    if(tabId === 'dashboard') loadQuotes();
    
    if(tabId === 'new-quote') {
        db.getItem('dnl_settings').then(settings => {
            if(settings && settings.defaultRate && !document.getElementById('labourRate').value) {
                document.getElementById('labourRate').value = settings.defaultRate;
                calculateTotal();
            }
        });
    }
}

// --- SETTINGS (ADMIN) ---
async function loadSettings() {
    const settings = await db.getItem('dnl_settings');
    if(settings) {
        document.getElementById('bankName').value = settings.bankName || '';
        document.getElementById('bankSort').value = settings.bankSort || '';
        document.getElementById('bankAcc').value = settings.bankAcc || '';
        document.getElementById('defaultRate').value = settings.defaultRate || '';
        
        if(!document.getElementById('labourRate').value) {
            document.getElementById('labourRate').value = settings.defaultRate || '';
        }
    }
}

async function saveSettings() {
    const settings = {
        bankName: document.getElementById('bankName').value,
        bankSort: document.getElementById('bankSort').value,
        bankAcc: document.getElementById('bankAcc').value,
        defaultRate: document.getElementById('defaultRate').value
    };
    await db.setItem('dnl_settings', settings);
    
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]); // Success haptic
    alert("Settings saved successfully.");
}

// --- DYNAMIC MATERIALS LIST ---
function addMaterialRow() {
    const container = document.getElementById('materialsContainer');
    const row = document.createElement('div');
    row.className = 'flex space-x-2 material-row items-center';
    row.innerHTML = `
        <i class="fa-solid fa-box text-stone-300 text-sm"></i>
        <input type="text" class="ios-input w-16 mat-qty text-center p-2" placeholder="Qty">
        <input type="text" class="ios-input flex-1 mat-desc p-2" placeholder="Item name">
        <div class="relative w-24">
            <i class="fa-solid fa-sterling-sign absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 text-xs"></i>
            <input type="number" class="ios-input w-full mat-cost calc-trigger pl-6 p-2" placeholder="0.00">
        </div>
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
    for(let i=0; i<3; i++) { addMaterialRow(); } // Start with 3 to look cleaner
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

    if (!name) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Error haptic
        return alert("Please enter a customer name.");
    }

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
        status: 'Sent', 
        breakdown: {
            materialsList: materialsList,
            materials: matTotalCost,
            fuel: parseFloat(document.getElementById('costFuel').value) || 0,
            misc: parseFloat(document.getElementById('costMisc').value) || 0,
            labour: labTotal,
            labourHours: hours,
            labourRate: rate
        },
        total: total,
        deposit: deposit,
        paymentMethod: paymentMethod
    };

    await db.setItem(quoteData.id, quoteData);
    
    document.querySelectorAll('input:not(#bankName, #bankSort, #bankAcc, #defaultRate), textarea').forEach(el => el.value = '');
    
    const settings = await db.getItem('dnl_settings');
    if(settings && settings.defaultRate) {
        document.getElementById('labourRate').value = settings.defaultRate;
    }
    
    calculateTotal();
    generatePDF(quoteData, 'QUOTE');
    switchTab('dashboard');
}

// --- DASHBOARD & STATUS MANAGEMENT ---
async function updateStatus(id, newStatus) {
    const quote = await db.getItem(id);
    quote.status = newStatus;
    await db.setItem(id, quote);
    loadQuotes(); 
}

async function loadQuotes() {
    const list = document.getElementById('quoteList');
    list.innerHTML = '';
    let keys = await db.keys();
    
    const quoteKeys = keys.filter(k => k !== 'dnl_settings');

    if (quoteKeys.length === 0) {
        list.innerHTML = `
            <div class="text-center mt-16 text-stone-400">
                <i class="fa-solid fa-folder-open text-6xl mb-4 opacity-50"></i>
                <p class="font-bold">No jobs yet.</p>
                <p class="text-sm">Tap the + button to create your first quote.</p>
            </div>`;
        return;
    }

    const getStatusStyle = (status) => {
        switch(status) {
            case 'Accepted': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'Paid': return 'bg-stone-200 text-stone-600 border-stone-300';
            case 'Sent': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-amber-100 text-amber-800 border-amber-200'; 
        }
    };

    const getStatusIcon = (status) => {
        switch(status) {
            case 'Accepted': return 'fa-check-circle text-emerald-500';
            case 'Paid': return 'fa-sack-dollar text-stone-500';
            case 'Sent': return 'fa-paper-plane text-blue-500';
            default: return 'fa-pen-ruler text-amber-500'; 
        }
    };

    for (let key of quoteKeys.reverse()) {
        const quote = await db.getItem(key);
        const status = quote.status || 'Draft';
        
        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-stone-100 flex flex-col relative overflow-hidden transition-all";
        
        // Visual indicator strip
        const stripColor = status === 'Paid' ? 'bg-stone-300' : (status === 'Accepted' ? 'bg-emerald-500' : (status === 'Sent' ? 'bg-blue-500' : 'bg-amber-400'));
        
        card.innerHTML = `
            <div class="absolute left-0 top-0 bottom-0 w-1.5 ${stripColor}"></div>
            <div class="flex justify-between items-start mb-4 pl-2">
                <div>
                    <h4 class="font-black text-lg text-stone-800">${quote.customer}</h4>
                    <p class="text-xs font-bold text-stone-400 mt-1"><i class="fa-regular fa-calendar mr-1"></i>${quote.date} &nbsp;|&nbsp; <i class="fa-solid fa-hashtag mr-1"></i>${quote.id.replace('DNL-','')}</p>
                </div>
                <div class="text-right">
                    <p class="font-black text-xl text-[#4a3728]">£${quote.total.toFixed(2)}</p>
                    <select onchange="updateStatus('${quote.id}', this.value)" class="text-xs mt-2 py-1 px-2 rounded-lg border outline-none font-bold ${getStatusStyle(status)} cursor-pointer appearance-none text-center">
                        <option value="Draft" ${status==='Draft'?'selected':''}>Draft</option>
                        <option value="Sent" ${status==='Sent'?'selected':''}>Sent</option>
                        <option value="Accepted" ${status==='Accepted'?'selected':''}>Accepted</option>
                        <option value="Paid" ${status==='Paid'?'selected':''}>Paid</option>
                    </select>
                </div>
            </div>
            <div class="flex space-x-3 border-t border-stone-100 pt-4 pl-2">
                <button onclick="reprintPDF('${quote.id}', 'QUOTE')" class="flex-1 text-sm text-blue-700 bg-blue-50/50 hover:bg-blue-100 py-2.5 rounded-xl font-bold border border-blue-100 transform active:scale-95 transition"><i class="fa-solid fa-file-invoice mr-1"></i> Quote</button>
                <button onclick="reprintPDF('${quote.id}', 'INVOICE')" class="flex-1 text-sm text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 py-2.5 rounded-xl font-bold border border-emerald-100 transform active:scale-95 transition"><i class="fa-solid fa-receipt mr-1"></i> Invoice</button>
            </div>
        `;
        list.appendChild(card);
    }
}

async function reprintPDF(id, type) {
    const quote = await db.getItem(id);
    generatePDF(quote, type);
}

// --- ADMIN ---
async function clearDatabase() {
    if(confirm("DANGER: Are you sure? This will delete all saved jobs forever!")) {
        const settings = await db.getItem('dnl_settings');
        await db.clear();
        if(settings) await db.setItem('dnl_settings', settings);
        
        loadQuotes();
        if (navigator.vibrate) navigator.vibrate([50, 100, 50, 100]); 
        alert("Database wiped.");
    }
}

// --- PDF GENERATOR ---
async function generatePDF(data, type = 'QUOTE') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const brandDark = [74, 55, 40]; 
    
    // Header Block
    doc.setFillColor(...brandDark);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("D.N.L JOINERY & FENCING", 20, 23);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    
    if(type === 'INVOICE') {
        doc.text("INVOICE", 140, 50);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString();
        doc.text(`REF NO: ${data.id}`, 140, 58);
        doc.text(`DATE: ${data.date}`, 140, 63);
        doc.text(`DUE BY: ${dueDate}`, 140, 68);
    } else {
        doc.text("QUOTATION", 140, 50);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`REF NO: ${data.id}`, 140, 58);
        doc.text(`DATE: ${data.date}`, 140, 63);
        doc.text(`VALID FOR: 30 Days`, 140, 68); 
    }

    // Client Info
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("BILLED TO:", 20, 50);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(data.customer, 20, 57);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(data.description, 20, 63, { maxWidth: 90 });

    // Table Header
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 80, 170, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", 23, 87);
    doc.text("AMOUNT", 170, 87);

    let y = 98;
    doc.setFont("helvetica", "normal");
    
    // Materials
    if (data.breakdown.materialsList && data.breakdown.materialsList.length > 0) {
        data.breakdown.materialsList.forEach(m => {
            const lineText = `${m.qty ? m.qty + ' x ' : ''}${m.desc || 'Material'}`;
            doc.text(lineText, 23, y);
            if(m.cost > 0) doc.text(`£${m.cost.toFixed(2)}`, 170, y);
            y += 8;
        });
    }

    // Fixed Costs
    const remainingItems = [
        ["Fuel & Travel", data.breakdown.fuel],
        ["Misc. Expenses", data.breakdown.misc],
        ["Labour / Installation", data.breakdown.labour]
    ];

    remainingItems.forEach(item => {
        if (item[1] > 0) { 
            doc.text(item[0], 23, y);
            doc.text(`£${item[1].toFixed(2)}`, 170, y);
            y += 8;
        }
    });

    // Totals Box
    doc.line(120, y + 5, 190, y + 5);
    y += 15;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("GRAND TOTAL:", 120, y);
    doc.text(`£${data.total.toFixed(2)}`, 170, y);
    
    if (data.deposit && data.deposit > 0) {
        y += 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("DEPOSIT REQUIRED:", 120, y);
        doc.text(`£${parseFloat(data.deposit).toFixed(2)}`, 170, y);
        
        y += 8;
        doc.setFont("helvetica", "bold");
        const balance = data.total - parseFloat(data.deposit);
        doc.text("BALANCE TO PAY:", 120, y);
        doc.text(`£${balance.toFixed(2)}`, 170, y);
    }
    
    // Payment Box
    y += 25;
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(20, y-5, 170, 35, 3, 3, 'FD');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PAYMENT INFORMATION", 25, y+2);
    
    doc.setFont("helvetica", "normal");
    const method = data.paymentMethod || "Cash";
    doc.text(`Preferred Method: ${method}`, 25, y+10);

    if (method === "Bank Transfer") {
        const settings = await db.getItem('dnl_settings');
        if (settings && settings.bankName) {
            doc.text(`Account Name: ${settings.bankName}`, 25, y+16);
            doc.text(`Sort Code: ${settings.bankSort}  |  Acc No: ${settings.bankAcc}`, 25, y+22);
        } else {
            doc.text("Please contact us for bank transfer details.", 25, y+16);
        }
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for choosing D.N.L Joinery.", 105, 280, null, null, "center");

    // Page 2: Terms
    doc.addPage();
    doc.setFillColor(...brandDark);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TERMS & CONDITIONS", 20, 13);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    let tcY = 35;
    
    const terms = [
        "1. Validity & Acceptance",
        "This quote is valid for 30 days from the date of issue. Acceptance of this quote constitutes agreement",
        "to these terms. Prices of materials may be subject to fluctuation beyond the 30-day period.",
        "",
        "2. Natural Materials",
        "Timber is a natural product and is subject to movement, shrinking, and cracking due to environmental",
        "changes (heat, humidity). D.N.L Joinery accepts no liability for natural timber behaviors once installed.",
        "",
        "3. Site Preparation",
        "The working area must be cleared of personal items, furniture, and hazards prior to arrival.",
        "Delays caused by site unpreparedness may incur additional hourly labour charges.",
        "",
        "4. Ownership of Goods",
        "All materials, fixtures, and installed goods remain the sole property of D.N.L Joinery until the",
        "final invoice balance is paid in full. We reserve the right to reclaim unpaid goods.",
        "",
        "5. Payment Terms",
        "Deposits (where stated) must be cleared before materials are ordered or work commences.",
        "Final balances are strictly due upon completion of the works, unless stated otherwise on the invoice."
    ];

    terms.forEach(line => {
        if (line.match(/^\d\./)) {
            doc.setFont("helvetica", "bold");
            tcY += 2; 
        } else {
            doc.setFont("helvetica", "normal");
        }
        doc.text(line, 20, tcY);
        tcY += 6;
    });

    if (navigator.vibrate) navigator.vibrate([40, 50, 40]); 
    const prefix = type === 'INVOICE' ? 'Invoice' : 'Quote';
    doc.save(`DNL_${prefix}_${data.customer.replace(/\s+/g, '_')}.pdf`);
}
