// Version: 1.10 | Date: April 2026
const db = localforage.createInstance({ name: "DNL_DB" });

let currentPhotoData = null;
let currentSignatureData = null;
let signaturePad = null;

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active-tab'));
    if(tabId !== 'new-quote') event.currentTarget.classList.add('active-tab');

    if(tabId === 'dashboard') loadQuotes();
    
    if(tabId === 'new-quote') {
        currentPhotoData = null; currentSignatureData = null;
        document.getElementById('photoPreview').classList.add('hidden');
        document.getElementById('signaturePreview').classList.add('hidden');

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
    initCatalog();
    const canvas = document.getElementById('sigCanvas');
    signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(249, 250, 251)', penColor: '#4f46e5' });
});

// Voice Dictation
function startDictation() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-GB';
        
        if (navigator.vibrate) navigator.vibrate([30]); 
        
        recognition.onresult = function(e) {
            const result = e.results[0][0].transcript;
            const descBox = document.getElementById('jobDesc');
            descBox.value += (descBox.value ? ' ' : '') + result;
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]); 
        };
        recognition.start();
    } else {
        alert("Voice dictation is not supported here.");
    }
}

// Camera Upload
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        currentPhotoData = e.target.result;
        const preview = document.getElementById('photoPreview');
        preview.src = currentPhotoData;
        preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// Digital Signature
function openSignature() {
    document.getElementById('sigModal').classList.add('active');
    const canvas = document.getElementById('sigCanvas');
    const ratio =  Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear();
}
function closeSignature() { document.getElementById('sigModal').classList.remove('active'); }
function clearSignature() { signaturePad.clear(); }
function saveSignature() {
    if (signaturePad.isEmpty()) return alert("Please sign first.");
    currentSignatureData = signaturePad.toDataURL();
    const preview = document.getElementById('signaturePreview');
    preview.src = currentSignatureData;
    preview.classList.remove('hidden');
    closeSignature();
}

// Catalog
const catalogItems = [
    { name: "2x4 Timber (2.4m)", cost: 5.50, icon: "🪵" },
    { name: "Sheet MDF (12mm)", cost: 18.00, icon: "🟫" },
    { name: "Box of Screws (x200)", cost: 4.50, icon: "🔩" },
    { name: "Internal Door (Oak)", cost: 85.00, icon: "🚪" },
    { name: "Skirting Board (3m)", cost: 12.00, icon: "🪚" },
    { name: "Wood Glue (1L)", cost: 8.00, icon: "🧴" }
];
function initCatalog() {
    const list = document.getElementById('catalogList');
    catalogItems.forEach(item => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-stone-50 p-4 rounded-2xl border-2 border-stone-100 cursor-pointer hover:border-amber-400 hover:bg-amber-50 active:scale-95 transition-all shadow-sm";
        div.onclick = () => { selectCatalogItem(item.name, item.cost); };
        div.innerHTML = `
            <div class="flex items-center"><div class="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl mr-3">${item.icon}</div><span class="font-black text-stone-700">${item.name}</span></div>
            <span class="text-amber-600 font-black bg-amber-100 px-3 py-1 rounded-lg">£${item.cost.toFixed(2)}</span>
        `;
        list.appendChild(div);
    });
}
function openCatalog() { document.getElementById('catalogModal').classList.add('active'); }
function closeCatalog() { document.getElementById('catalogModal').classList.remove('active'); }
function selectCatalogItem(name, cost) {
    addMaterialRow(1, name, cost);
    closeCatalog();
    calculateTotal();
    if (navigator.vibrate) navigator.vibrate([20]); 
}

// Settings & Address Book
async function loadSettings() {
    const settings = await db.getItem('dnl_settings');
    if(settings) {
        document.getElementById('bankName').value = settings.bankName || '';
        document.getElementById('bankSort').value = settings.bankSort || '';
        document.getElementById('bankAcc').value = settings.bankAcc || '';
        document.getElementById('defaultRate').value = settings.defaultRate || '';
        document.getElementById('defaultMarkup').value = settings.defaultMarkup || '';
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
    alert("Settings saved.");
}
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

// Materials & Calculation
function addMaterialRow(qty = '', desc = '', cost = '') {
    const container = document.getElementById('materialsContainer');
    const row = document.createElement('div');
    row.className = 'flex space-x-2 material-row items-center bg-stone-50 p-2 rounded-2xl border border-stone-100 shadow-sm';
    row.innerHTML = `
        <div class="icon-box bg-white text-stone-400 shadow-sm w-10 h-10 rounded-xl"><i class="fa-solid fa-cube"></i></div>
        <input type="text" class="ios-input w-16 text-center py-2 px-1 text-sm bg-white border-none shadow-sm mat-qty font-bold" placeholder="Qty" value="${qty}">
        <input type="text" class="ios-input flex-1 py-2 px-3 text-sm bg-white border-none shadow-sm mat-desc font-bold" placeholder="Item name" value="${desc}">
        <div class="relative w-24">
            <i class="fa-solid fa-sterling-sign absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-500 text-xs"></i>
            <input type="number" class="ios-input w-full mat-cost calc-trigger pl-7 py-2 text-sm font-black text-emerald-700 bg-emerald-50 border-none shadow-sm" placeholder="0.00" value="${cost}">
        </div>
    `;
    if(desc) container.insertBefore(row, container.firstChild);
    else container.appendChild(row);
    bindCalcTriggers();
}

function bindCalcTriggers() {
    document.querySelectorAll('.calc-trigger').forEach(input => {
        input.removeEventListener('input', calculateTotal);
        input.addEventListener('input', calculateTotal);
    });
}

function calculateTotal() {
    let rawMatTotal = 0;
    document.querySelectorAll('.mat-cost').forEach(input => { rawMatTotal += parseFloat(input.value) || 0; });
    const markupPct = parseFloat(document.getElementById('materialMarkup').value) || 0;
    const matTotal = rawMatTotal * (1 + (markupPct / 100)); 
    
    const fuel = parseFloat(document.getElementById('costFuel').value) || 0;
    const misc = parseFloat(document.getElementById('costMisc').value) || 0;
    const hours = parseFloat(document.getElementById('labourHours').value) || 0;
    const rate = parseFloat(document.getElementById('labourRate').value) || 0;
    
    const total = matTotal + fuel + misc + (hours * rate);
    document.getElementById('displayTotal').innerText = `£${total.toFixed(2)}`;
    return total;
}

// Save & Create
async function saveAndGenerate() {
    const name = document.getElementById('custName').value;
    if (!name) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        return alert("Customer Name is required.");
    }

    const markupPct = parseFloat(document.getElementById('materialMarkup').value) || 0;
    const materialsList = [];
    let matTotalCost = 0;
    
    document.querySelectorAll('.material-row').forEach(row => {
        const qty = row.querySelector('.mat-qty').value;
        const mDesc = row.querySelector('.mat-desc').value;
        const rawCost = parseFloat(row.querySelector('.mat-cost').value) || 0;
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
        phone: document.getElementById('custPhone').value,
        email: document.getElementById('custEmail').value,
        description: document.getElementById('jobDesc').value,
        status: 'Sent', 
        breakdown: {
            materialsList: materialsList,
            materials: matTotalCost,
            fuel: parseFloat(document.getElementById('costFuel').value) || 0,
            misc: parseFloat(document.getElementById('costMisc').value) || 0,
            labour: hours * rate,
        },
        total: calculateTotal(),
        deposit: parseFloat(document.getElementById('quoteDeposit').value) || 0,
        paymentMethod: document.getElementById('quotePaymentMethod').value,
        photo: currentPhotoData,
        signature: currentSignatureData
    };

    await saveToAddressBook(name, quoteData.phone, quoteData.email);
    await db.setItem(quoteData.id, quoteData);
    
    document.querySelectorAll('input:not(#bankName, #bankSort, #bankAcc, #defaultRate, #defaultMarkup), textarea').forEach(el => el.value = '');
    document.getElementById('materialsContainer').innerHTML = '';
    for(let i=0; i<3; i++) { addMaterialRow(); } 
    loadSettings(); 
    
    generatePDF(quoteData, 'QUOTE', false);
    switchTab('dashboard');
}

// Dashboard & Status
async function updateStatus(id, newStatus) {
    const quote = await db.getItem(id);
    const oldStatus = quote.status;
    quote.status = newStatus;
    await db.setItem(id, quote);
    
    if (newStatus === 'Paid' && oldStatus !== 'Paid') {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#10b981', '#fbbf24', '#ffffff'] });
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]); 
    }
    loadQuotes(); 
}

async function loadQuotes() {
    const list = document.getElementById('quoteList');
    list.innerHTML = '';
    let keys = await db.keys();
    const quoteKeys = keys.filter(k => k !== 'dnl_settings' && k !== 'dnl_clients');
    
    let monthlyRevenue = 0;
    const currentMonth = new Date().getMonth();

    if (quoteKeys.length === 0) {
        list.innerHTML = `<div class="text-center mt-20 p-6 bg-white rounded-3xl shadow-sm border-2 border-dashed border-stone-200"><i class="fa-solid fa-box-open text-6xl text-stone-200 mb-4 block"></i><p class="font-black text-stone-500 text-lg">It's quiet in here.</p><p class="text-sm font-bold text-stone-400 mt-2">Tap the big + button to start your first job.</p></div>`;
        document.getElementById('monthlyRevenue').innerText = "£0.00";
        return;
    }

    for (let key of quoteKeys.reverse()) {
        const quote = await db.getItem(key);
        
        const quoteDate = new Date(quote.date.split('/').reverse().join('-')); 
        if(quote.status === 'Paid' && quoteDate.getMonth() === currentMonth) {
            monthlyRevenue += quote.total;
        }

        const status = quote.status || 'Draft';
        
        // VIBRANT FINTECH CARDS
        let cardBg = '', iconBg = '', iconColor = '', iconObj = '';
        if(status === 'Paid') { cardBg = 'from-emerald-50 to-white border-emerald-200'; iconBg = 'bg-emerald-500'; iconColor = 'text-white'; iconObj = 'fa-sack-dollar'; }
        else if(status === 'Accepted') { cardBg = 'from-indigo-50 to-white border-indigo-200'; iconBg = 'bg-indigo-500'; iconColor = 'text-white'; iconObj = 'fa-handshake'; }
        else if(status === 'Sent') { cardBg = 'from-blue-50 to-white border-blue-200'; iconBg = 'bg-blue-500'; iconColor = 'text-white'; iconObj = 'fa-paper-plane'; }
        else { cardBg = 'from-stone-50 to-white border-stone-200'; iconBg = 'bg-stone-300'; iconColor = 'text-stone-600'; iconObj = 'fa-pen-ruler'; }
        
        const card = document.createElement('div');
        card.className = `bg-gradient-to-br ${cardBg} p-5 rounded-3xl shadow-[0_8px_20px_rgba(0,0,0,0.03)] border-2 flex flex-col relative transition-all`;
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center">
                    <div class="${iconBg} ${iconColor} w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-md mr-4 transform -rotate-3"><i class="fa-solid ${iconObj}"></i></div>
                    <div>
                        <h4 class="font-black text-lg text-stone-800 leading-tight">${quote.customer}</h4>
                        <p class="text-[10px] font-black text-stone-400 mt-1 uppercase tracking-widest">${quote.date} &nbsp;•&nbsp; ${quote.id.replace('DNL-','')}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-black text-2xl text-stone-800 tracking-tighter">£${quote.total.toFixed(2)}</p>
                    <select onchange="updateStatus('${quote.id}', this.value)" class="text-xs mt-1 py-1 px-3 rounded-full border outline-none font-black bg-white shadow-sm cursor-pointer text-stone-600 appearance-none text-center block w-full">
                        <option value="Draft" ${status==='Draft'?'selected':''}>🟡 Draft</option>
                        <option value="Sent" ${status==='Sent'?'selected':''}>🔵 Sent</option>
                        <option value="Accepted" ${status==='Accepted'?'selected':''}>🟣 Accepted</option>
                        <option value="Paid" ${status==='Paid'?'selected':''}>🟢 Paid</option>
                    </select>
                </div>
            </div>
            
            <div class="flex space-x-2 mt-2">
                <button onclick="generatePDF(await db.getItem('${quote.id}'), 'QUOTE', false)" class="flex-1 text-xs text-stone-700 bg-white hover:bg-stone-50 py-3 rounded-2xl font-black shadow-sm border border-stone-100 active:scale-95 transition"><i class="fa-solid fa-file-invoice mr-1 text-blue-500"></i> Quote</button>
                <button onclick="generatePDF(await db.getItem('${quote.id}'), 'INVOICE', false)" class="flex-1 text-xs text-stone-700 bg-white hover:bg-stone-50 py-3 rounded-2xl font-black shadow-sm border border-stone-100 active:scale-95 transition"><i class="fa-solid fa-receipt mr-1 text-emerald-500"></i> Invoice</button>
            </div>
            
            <div class="flex justify-between items-center mt-3 pt-3 border-t border-white/50">
                <div class="flex space-x-2">
                    <button onclick="sendQuickMessage('${quote.id}', 'whatsapp')" class="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition shadow-inner"><i class="fa-brands fa-whatsapp text-xl"></i></button>
                    <button onclick="sendQuickMessage('${quote.id}', 'sms')" class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition shadow-inner"><i class="fa-solid fa-comment-sms text-lg"></i></button>
                </div>
                <button onclick="generatePDF(await db.getItem('${quote.id}'), 'QUOTE', true)" class="px-5 h-10 rounded-full bg-stone-800 text-white flex items-center justify-center text-xs font-black shadow-lg active:scale-95 transition"><i class="fa-solid fa-arrow-up-from-bracket mr-2"></i> Share</button>
            </div>
        `;
        list.appendChild(card);
    }
    
    document.getElementById('monthlyRevenue').innerText = `£${monthlyRevenue.toFixed(2)}`;
}

async function sendQuickMessage(id, platform) {
    const quote = await db.getItem(id);
    const msg = `Hi ${quote.customer}, I have prepared your document for the joinery work. The total is £${quote.total.toFixed(2)}. I will send the PDF over to you now. Thanks, D.N.L Joinery.`;
    if (platform === 'whatsapp') window.open(`https://wa.me/${quote.phone?quote.phone.replace(/^0/,'+44').replace(/\s/g,''):''}?text=${encodeURIComponent(msg)}`, '_blank');
    else if (platform === 'sms') window.open(`sms:${quote.phone || ''}?&body=${encodeURIComponent(msg)}`, '_self');
}

async function clearDatabase() {
    if(confirm("DANGER: This will delete everything!")) {
        const settings = await db.getItem('dnl_settings');
        await db.clear();
        if(settings) await db.setItem('dnl_settings', settings);
        loadQuotes();
    }
}

// PDF Generator (No logic changes required, kept stable from v1.9)
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
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 80, 170, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", 23, 87);
    doc.text("AMOUNT", 170, 87);

    let y = 98;
    doc.setFont("helvetica", "normal");
    
    if (data.breakdown.materialsList && data.breakdown.materialsList.length > 0) {
        data.breakdown.materialsList.forEach(m => {
            doc.text(`${m.qty ? m.qty + ' x ' : ''}${m.desc || 'Material'}`, 23, y);
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
        doc.text("BALANCE TO PAY:", 120, y);
        doc.text(`£${(data.total - parseFloat(data.deposit)).toFixed(2)}`, 170, y);
    }
    
    y += 20;
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(20, y, 170, 35, 3, 3, 'FD');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PAYMENT INFORMATION", 25, y+7);
    doc.setFont("helvetica", "normal");
    const method = data.paymentMethod || "Cash";
    doc.text(`Preferred Method: ${method}`, 25, y+15);

    if (method === "Bank Transfer") {
        const settings = await db.getItem('dnl_settings');
        if (settings && settings.bankName) {
            doc.text(`Account Name: ${settings.bankName}`, 25, y+21);
            doc.text(`Sort Code: ${settings.bankSort}  |  Acc No: ${settings.bankAcc}`, 25, y+27);
        }
    }
    
    if (data.signature) {
        y += 45;
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Digitally Approved By Client:", 20, y);
        doc.addImage(data.signature, 'PNG', 20, y + 5, 60, 20); 
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for choosing D.N.L Joinery.", 105, 285, null, null, "center");

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
        "1. Validity & Acceptance", "This quote is valid for 30 days from the date of issue. Acceptance constitutes agreement to these terms.",
        "2. Natural Materials", "Timber is a natural product subject to movement. D.N.L Joinery accepts no liability for natural timber behaviors.",
        "3. Site Preparation", "Working areas must be cleared prior to arrival. Delays may incur additional charges.",
        "4. Ownership of Goods", "Materials remain the sole property of D.N.L Joinery until the final invoice is paid in full.",
        "5. Payment Terms", "Final balances are strictly due upon completion of the works, unless stated otherwise."
    ];

    terms.forEach(line => {
        if (line.match(/^\d\./)) { doc.setFont("helvetica", "bold"); tcY += 4; } 
        else { doc.setFont("helvetica", "normal"); }
        doc.text(line, 20, tcY);
        tcY += 6;
    });

    if (data.photo) {
        doc.addPage();
        doc.setFillColor(...brandDark);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("SITE REFERENCE PHOTO", 20, 13);
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text("Photographic documentation of the site taken at the time of quotation.", 20, 30);
        try { doc.addImage(data.photo, 'JPEG', 20, 40, 170, 120); } catch(e) {}
    }

    const prefix = type === 'INVOICE' ? 'Invoice' : 'Quote';
    const filename = `DNL_${prefix}_${data.customer.replace(/\s+/g, '_')}.pdf`;

    if (triggerNativeShare && navigator.canShare) {
        const file = new File([doc.output('blob')], filename, { type: 'application/pdf' });
        try { await navigator.share({ title: filename, files: [file] }); } 
        catch (e) { doc.save(filename); }
    } else {
        doc.save(filename);
    }
}
