// Version: 1.8 | Date: April 2026
const db = localforage.createInstance({ name: "DNL_DB" });

// --- VIEW NAVIGATION & INITIALIZATION ---
function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active-tab', 'text-[#4a3728]');
        btn.classList.add('text-stone-400');
    });
    event.currentTarget.classList.remove('text-stone-400');
    if(tabId !== 'new-quote') event.currentTarget.classList.add('text-[#4a3728]', 'active-tab');

    if(tabId === 'dashboard') loadQuotes();
    
    if(tabId === 'new-quote') {
        db.getItem('dnl_settings').then(settings => {
            if(settings) {
                if(!document.getElementById('labourRate').value) document.getElementById('labourRate').value = settings.defaultRate || '';
                if(!document.getElementById('materialMarkup').value) document.getElementById('materialMarkup').value = settings.defaultMarkup || 0;
                calculateTotal();
            }
        });
        loadAddressBook();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    for(let i=0; i<3; i++) { addMaterialRow(); } 
    loadSettings();
});

// --- SETTINGS ---
async function loadSettings() {
    const settings = await db.getItem('dnl_settings');
    if(settings) {
        document.getElementById('bankName').value = settings.bankName || '';
        document.getElementById('bankSort').value = settings.bankSort || '';
        document.getElementById('bankAcc').value = settings.bankAcc || '';
        document.getElementById('defaultRate').value = settings.defaultRate || '';
        document.getElementById('defaultMarkup').value = settings.defaultMarkup || '';
        
        if(!document.getElementById('labourRate').value) document.getElementById('labourRate').value = settings.defaultRate || '';
        if(!document.getElementById('materialMarkup').value) document.getElementById('materialMarkup').value = settings.defaultMarkup || 0;
    }
}

async function saveSettings() {
    const settings = {
        bankName: document.getElementById('bankName').value,
        bankSort: document.getElementById('bankSort').value,
        bankAcc: document.getElementById('bankAcc').value,
        defaultRate: document.getElementById('defaultRate').value,
        defaultMarkup: document.getElementById('defaultMarkup').value
    };
    await db.setItem('dnl_settings', settings);
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    alert("Settings saved successfully.");
}

// --- ADDRESS BOOK ---
async function loadAddressBook() {
    const clients = await db.getItem('dnl_clients') || {};
    const dataList = document.getElementById('clientList');
    dataList.innerHTML = '';
    Object.keys(clients).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        dataList.appendChild(option);
    });
}

async function fillClientDetails() {
    const name = document.getElementById('custName').value;
    const clients = await db.getItem('dnl_clients') || {};
    if(clients[name]) {
        document.getElementById('custPhone').value = clients[name].phone || '';
        document.getElementById('custEmail').value = clients[name].email || '';
    }
}

async function saveToAddressBook(name, phone, email) {
    const clients = await db.getItem('dnl_clients') || {};
    clients[name] = { phone: phone, email: email };
    await db.setItem('dnl_clients', clients);
}

// --- DYNAMIC MATERIALS ---
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

// --- CALCULATIONS (WITH MARKUP) ---
function calculateTotal() {
    let rawMatTotal = 0;
    document.querySelectorAll('.mat-cost').forEach(input => {
        rawMatTotal += parseFloat(input.value) || 0;
    });
    
    const markupPct = parseFloat(document.getElementById('materialMarkup').value) || 0;
    const matTotal = rawMatTotal * (1 + (markupPct / 100)); // Apply markup to materials
    
    const fuel = parseFloat(document.getElementById('costFuel').value) || 0;
    const misc = parseFloat(document.getElementById('costMisc').value) || 0;
    const hours = parseFloat(document.getElementById('labourHours').value) || 0;
    const rate = parseFloat(document.getElementById('labourRate').value) || 0;
    const labTotal = hours * rate;
    
    const total = matTotal + fuel + misc + labTotal;
    document.getElementById('displayTotal').innerText = `£${total.toFixed(2)}`;
    return total;
}

// --- SAVE LOGIC ---
async function saveAndGenerate() {
    const name = document.getElementById('custName').value;
    const phone = document.getElementById('custPhone').value;
    const email = document.getElementById('custEmail').value;
    const desc = document.getElementById('jobDesc').value;
    const markupPct = parseFloat(document.getElementById('materialMarkup').value) || 0;
    const total = calculateTotal();

    if (!name) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        return alert("Please enter a customer name.");
    }

    // Save to address book
    await saveToAddressBook(name, phone, email);

    const materialsList = [];
    let matTotalCost = 0;
    document.querySelectorAll('.material-row').forEach(row => {
        const qty = row.querySelector('.mat-qty').value;
        const mDesc = row.querySelector('.mat-desc').value;
        const rawCost = parseFloat(row.querySelector('.mat-cost').value) || 0;
        
        // Bake the markup directly into the saved cost so the customer doesn't see "Markup"
        const markedUpCost = rawCost * (1 + (markupPct / 100));
        
        if (qty || mDesc || rawCost) {
            materialsList.push({ qty, desc: mDesc, cost: markedUpCost });
            matTotalCost += markedUpCost;
        }
    });

    const hours = parseFloat(document.getElementById('labourHours').value) || 0;
    const rate = parseFloat(document.getElementById('labourRate').value) || 0;

    const quoteData = {
        id: `DNL-${Math.floor(Math.random() * 10000)}`,
        date: new Date().toLocaleDateString(),
        customer: name,
        phone: phone,
        email: email,
        description: desc,
        status: 'Sent', 
        breakdown: {
            materialsList: materialsList,
            materials: matTotalCost,
            fuel: parseFloat(document.getElementById('costFuel').value) || 0,
            misc: parseFloat(document.getElementById('costMisc').value) || 0,
            labour: hours * rate,
        },
        total: total,
        deposit: parseFloat(document.getElementById('quoteDeposit').value) || 0,
        paymentMethod: document.getElementById('quotePaymentMethod').value
    };

    await db.setItem(quoteData.id, quoteData);
    
    // Reset Form
    document.querySelectorAll('input:not(#bankName, #bankSort, #bankAcc, #defaultRate, #defaultMarkup), textarea').forEach(el => el.value = '');
    loadSettings(); // Restore defaults
    
    generatePDF(quoteData, 'QUOTE', false); // false = Download, don't share natively yet
    switchTab('dashboard');
}

// --- DASHBOARD & SHARING ---
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
    const quoteKeys = keys.filter(k => k !== 'dnl_settings' && k !== 'dnl_clients');

    if (quoteKeys.length === 0) {
        list.innerHTML = `<div class="text-center mt-16 text-stone-400"><i class="fa-solid fa-folder-open text-6xl mb-4 opacity-50"></i><p class="font-bold">No jobs yet.</p></div>`;
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

    for (let key of quoteKeys.reverse()) {
        const quote = await db.getItem(key);
        const status = quote.status || 'Draft';
        const stripColor = status === 'Paid' ? 'bg-stone-300' : (status === 'Accepted' ? 'bg-emerald-500' : (status === 'Sent' ? 'bg-blue-500' : 'bg-amber-400'));
        
        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-stone-100 flex flex-col relative overflow-hidden transition-all";
        
        card.innerHTML = `
            <div class="absolute left-0 top-0 bottom-0 w-1.5 ${stripColor}"></div>
            <div class="flex justify-between items-start mb-4 pl-2">
                <div>
                    <h4 class="font-black text-lg text-stone-800">${quote.customer}</h4>
                    <p class="text-xs font-bold text-stone-400 mt-1"><i class="fa-regular fa-calendar mr-1"></i>${quote.date} &nbsp;|&nbsp; ${quote.id.replace('DNL-','')}</p>
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
            
            <div class="flex space-x-2 border-t border-stone-100 pt-4 pl-2 mb-3">
                <button onclick="generatePDF(await db.getItem('${quote.id}'), 'QUOTE', false)" class="flex-1 text-sm text-stone-700 bg-stone-100 hover:bg-stone-200 py-2 rounded-xl font-bold transition"><i class="fa-solid fa-file-arrow-down mr-1"></i> Get Quote</button>
                <button onclick="generatePDF(await db.getItem('${quote.id}'), 'INVOICE', false)" class="flex-1 text-sm text-stone-700 bg-stone-100 hover:bg-stone-200 py-2 rounded-xl font-bold transition"><i class="fa-solid fa-file-arrow-down mr-1"></i> Get Invoice</button>
            </div>

            <div class="flex justify-between pl-2 border-t border-stone-50 pt-3">
                <div class="flex space-x-2">
                    <button onclick="sendQuickMessage('${quote.id}', 'whatsapp')" class="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition"><i class="fa-brands fa-whatsapp text-lg"></i></button>
                    <button onclick="sendQuickMessage('${quote.id}', 'sms')" class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition"><i class="fa-solid fa-comment-sms text-lg"></i></button>
                    <button onclick="sendQuickMessage('${quote.id}', 'email')" class="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center hover:bg-purple-200 transition"><i class="fa-solid fa-envelope text-lg"></i></button>
                </div>
                <button onclick="generatePDF(await db.getItem('${quote.id}'), 'QUOTE', true)" class="px-4 h-10 rounded-full bg-[#4a3728] text-white flex items-center justify-center hover:bg-[#5c4033] text-xs font-bold transition shadow-md"><i class="fa-solid fa-share-nodes mr-2"></i> Share PDF</button>
            </div>
        `;
        list.appendChild(card);
    }
}

// Quick Messaging Actions
async function sendQuickMessage(id, platform) {
    const quote = await db.getItem(id);
    const msg = `Hi ${quote.customer}, I have prepared your document for the joinery work (${quote.description}). The total is £${quote.total.toFixed(2)}. I will send the PDF over to you now. Thanks, D.N.L Joinery.`;
    
    if (platform === 'whatsapp') {
        const phone = quote.phone ? quote.phone.replace(/^0/, '+44').replace(/\s/g, '') : '';
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else if (platform === 'sms') {
        window.open(`sms:${quote.phone || ''}?&body=${encodeURIComponent(msg)}`, '_self');
    } else if (platform === 'email') {
        window.open(`mailto:${quote.email || ''}?subject=Your Quote from D.N.L Joinery&body=${encodeURIComponent(msg)}`, '_self');
    }
}

async function clearDatabase() {
    if(confirm("DANGER: Are you sure? This will delete all saved jobs forever!")) {
        const settings = await db.getItem('dnl_settings');
        await db.clear();
        if(settings) await db.setItem('dnl_settings', settings);
        loadQuotes();
        alert("Database wiped.");
    }
}

// --- PDF GENERATOR (Updated for Native Sharing) ---
async function generatePDF(data, type = 'QUOTE', triggerNativeShare = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const brandDark = [74, 55, 40]; 
    
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

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 80, 170, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", 23, 87);
    doc.text("AMOUNT", 170, 87);

    let y = 98;
    doc.setFont("helvetica", "normal");
    
    if (data.breakdown.materialsList && data.breakdown.materialsList.length > 0) {
        data.breakdown.materialsList.forEach(m => {
            const lineText = `${m.qty ? m.qty + ' x ' : ''}${m.desc || 'Material'}`;
            doc.text(lineText, 23, y);
            if(m.cost > 0) doc.text(`£${m.cost.toFixed(2)}`, 170, y);
            y += 8;
        });
    }

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

    const prefix = type === 'INVOICE' ? 'Invoice' : 'Quote';
    const filename = `DNL_${prefix}_${data.customer.replace(/\s+/g, '_')}.pdf`;

    if (triggerNativeShare && navigator.canShare) {
        // Native Share (Attach PDF directly to WhatsApp/Mail via OS)
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], filename, { type: 'application/pdf' });
        try {
            await navigator.share({
                title: `${prefix} from D.N.L Joinery`,
                text: `Please find attached your ${prefix.toLowerCase()} for the recent joinery work.`,
                files: [file]
            });
        } catch (error) {
            console.log('Share canceled or not supported natively', error);
            doc.save(filename); // Fallback to download
        }
    } else {
        // Normal Download
        if (navigator.vibrate) navigator.vibrate([40, 50, 40]); 
        doc.save(filename);
    }
}
