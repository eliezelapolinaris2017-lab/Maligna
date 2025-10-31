/* =========================
   Inventario Corporativo – LocalStorage SPA
   ========================= */

// ---------- Utilidades ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const nowISO = () => new Date().toISOString();

const store = {
  get: (k, d) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? d; }
    catch { return d; }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k)
};

const DB = {
  key: 'inv.db.v1',
  load() {
    let db = store.get(this.key);
    if(!db){
      db = {
        settings: { brandName: "Oasis • Inventario", logoDataUrl: "", lowStockDefault: 1 },
        security: { pinHash: "" },
        categories: [],
        suppliers: [],
        warehouses: [{id:id(), name:"Principal", location:""}],
        items: [],     // {id, sku, name, categoryId, price, min, active}
        stock: {},     // stock[warehouseId][itemId] = qty
        moves: []      // {id, date, type, detail, sku, itemId, qty, fromWh, toWh, price}
      };
      store.set(this.key, db);
    }
    return db;
  },
  save(db){ store.set(this.key, db); }
};
let db = DB.load();

function id(){ return Math.random().toString(36).slice(2,10); }

function toast(msg){
  console.log(msg);
}

function hashPin(pin){
  // hash simple (no-crypto) para demo
  let h = 0; for (let i=0;i<pin.length;i++){ h = ((h<<5)-h)+pin.charCodeAt(i); h|=0; }
  return String(h);
}

function ensureStockMatrix(){
  db.warehouses.forEach(w=>{
    if(!db.stock[w.id]) db.stock[w.id] = {};
  });
}

// ---------- Autenticación ----------
const loginView = $('#loginView');
const appView   = $('#appView');

$('#loginBtn').onclick = ()=>{
  const pin = $('#pinInput').value.trim();
  if(!db.security.pinHash){
    toast('Primero crea un PIN.');
    return;
  }
  if(hashPin(pin) === db.security.pinHash){
    enterApp();
  } else {
    alert('PIN incorrecto');
  }
};

$('#setPinBtn').onclick = ()=>{
  const pin = prompt('Nuevo PIN (4-8 dígitos):')?.trim() ?? '';
  if(!pin || pin.length<4){ alert('PIN muy corto'); return; }
  db.security.pinHash = hashPin(pin);
  DB.save(db);
  alert('PIN guardado.');
};

$('#logoutBtn').onclick = ()=>{
  appView.classList.remove('active');
  loginView.classList.add('active');
};

// ---------- Navegación ----------
$$('.nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('.nav-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.nav;
    $$('.page').forEach(p=>p.classList.remove('active'));
    $('#'+page).classList.add('active');
    if(page==='dashboard') renderDashboard();
    if(page==='items') renderItems();
    if(page==='categories') renderCategories();
    if(page==='suppliers') renderSuppliers();
    if(page==='warehouses') renderWarehouses();
    if(page==='purchases') renderPurchases();
    if(page==='sales') renderSales();
    if(page==='transfers') renderTransfers();
    if(page==='adjustments') renderAdjustments();
  });
});

// ---------- Modal ----------
const modal = $('#modal');
const modalTitle = $('#modalTitle');
const modalBody = $('#modalBody');
const modalOk = $('#modalOk');
const modalCancel = $('#modalCancel');
const modalClose = $('#modalClose');

function openModal(title, bodyHtml, okLabel='Guardar', onOk=()=>{}){
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modalOk.textContent = okLabel;
  modal.classList.remove('hidden');

  const okHandler = ()=>{
    onOk();
    closeModal();
  };
  modalOk.onclick = okHandler;
  modalCancel.onclick = closeModal;
  modalClose.onclick = closeModal;
}
function closeModal(){ modal.classList.add('hidden'); modalBody.innerHTML=''; }

// ---------- Render: Dashboard ----------
function renderDashboard(){
  const skus = db.items.length;
  const totalStock = db.items.reduce((acc,it)=> acc + stockTotal(it.id), 0);
  const low = db.items.filter(it=> stockTotal(it.id) <= (it.min ?? db.settings.lowStockDefault) ).length;
  const whs = db.warehouses.length;

  $('#kpiSkus').textContent = skus;
  $('#kpiStock').textContent = totalStock;
  $('#kpiLow').textContent = low;
  $('#kpiWh').textContent = whs;

  // Tabla de bajo inventario
  const tbody = $('#lowStockTable tbody');
  tbody.innerHTML = '';
  db.items.forEach(it=>{
    const st = stockTotal(it.id);
    const min = it.min ?? db.settings.lowStockDefault;
    if(st <= min){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${it.sku}</td><td>${it.name}</td><td>${st}</td><td>${min}</td>`;
      tbody.appendChild(tr);
    }
  });
}

// ---------- Productos ----------
$('#addItemBtn').onclick = ()=>{
  const cats = optionsCats();
  openModal('Nuevo Producto', `
    <div class="row"><label>SKU</label><input id="fSku"></div>
    <div class="row"><label>Nombre</label><input id="fName"></div>
    <div class="row"><label>Categoría</label><select id="fCat">${cats}</select></div>
    <div class="row"><label>Precio</label><input id="fPrice" type="number" step="0.01" value="0"></div>
    <div class="row"><label>Mínimo</label><input id="fMin" type="number" value="${db.settings.lowStockDefault}"></div>
  `, 'Guardar', ()=>{
    const it = {
      id:id(),
      sku: $('#fSku').value.trim(),
      name: $('#fName').value.trim(),
      categoryId: $('#fCat').value,
      price: Number($('#fPrice').value||0),
      min: Number($('#fMin').value||0),
      active: true
    };
    db.items.push(it);
    DB.save(db);
    renderItems();
  });
};

$('#itemSearch').addEventListener('input', renderItems);

function renderItems(){
  const term = $('#itemSearch').value?.toLowerCase() ?? '';
  const tbody = $('#itemsTable tbody');
  tbody.innerHTML='';
  db.items
    .filter(it=> it.sku.toLowerCase().includes(term) || it.name.toLowerCase().includes(term))
    .forEach(it=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge gold">${it.sku}</span></td>
        <td>${it.name}</td>
        <td>${catName(it.categoryId)}</td>
        <td>$${it.price.toFixed(2)}</td>
        <td>${it.min ?? 0}</td>
        <td>${stockTotal(it.id)}</td>
        <td>
          <button class="small" data-edit="${it.id}">Editar</button>
          <button class="small outline" data-del="${it.id}">Borrar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  // acciones
  tbody.querySelectorAll('[data-edit]').forEach(b=>{
    b.onclick = ()=>{
      const it = db.items.find(x=>x.id===b.dataset.edit);
      const cats = optionsCats(it.categoryId);
      openModal('Editar Producto', `
        <div class="row"><label>SKU</label><input id="fSku" value="${it.sku}"></div>
        <div class="row"><label>Nombre</label><input id="fName" value="${it.name}"></div>
        <div class="row"><label>Categoría</label><select id="fCat">${cats}</select></div>
        <div class="row"><label>Precio</label><input id="fPrice" type="number" step="0.01" value="${it.price}"></div>
        <div class="row"><label>Mínimo</label><input id="fMin" type="number" value="${it.min ?? 0}"></div>
      `,'Guardar', ()=>{
        it.sku = $('#fSku').value.trim();
        it.name = $('#fName').value.trim();
        it.categoryId = $('#fCat').value;
        it.price = Number($('#fPrice').value||0);
        it.min = Number($('#fMin').value||0);
        DB.save(db); renderItems();
      });
    };
  });

  tbody.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick = ()=>{
      if(!confirm('¿Eliminar producto?')) return;
      const idx = db.items.findIndex(x=>x.id===b.dataset.del);
      if(idx>=0){ db.items.splice(idx,1); DB.save(db); renderItems(); }
    };
  });
}

// ---------- Categorías ----------
$('#addCatBtn').onclick = ()=>{
  openModal('Nueva Categoría', `
    <div class="row"><label>Nombre</label><input id="cName"></div>
    <div class="row"><label>Descripción</label><input id="cDesc"></div>
  `,'Guardar', ()=>{
    db.categories.push({id:id(), name:$('#cName').value.trim(), desc:$('#cDesc').value.trim()});
    DB.save(db); renderCategories();
  });
};
function renderCategories(){
  const tbody = $('#catTable tbody'); tbody.innerHTML='';
  db.categories.forEach(c=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c.name}</td><td>${c.desc||''}</td>
    <td><button class="small" data-edit="${c.id}">Editar</button>
        <button class="small outline" data-del="${c.id}">Borrar</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-edit]').forEach(b=>{
    b.onclick=()=>{
      const c = db.categories.find(x=>x.id===b.dataset.edit);
      openModal('Editar Categoría', `
        <div class="row"><label>Nombre</label><input id="cName" value="${c.name}"></div>
        <div class="row"><label>Descripción</label><input id="cDesc" value="${c.desc||''}"></div>
      `,'Guardar', ()=>{
        c.name = $('#cName').value.trim(); c.desc = $('#cDesc').value.trim();
        DB.save(db); renderCategories();
      });
    };
  });
  tbody.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick=()=>{
      if(!confirm('¿Eliminar categoría?'))return;
      const i = db.categories.findIndex(x=>x.id===b.dataset.del);
      if(i>=0){ db.categories.splice(i,1); DB.save(db); renderCategories(); }
    };
  });
}
function optionsCats(selectedId=''){
  const none = `<option value="">(sin categoría)</option>`;
  return none + db.categories.map(c=>`<option value="${c.id}" ${c.id===selectedId?'selected':''}>${c.name}</option>`).join('');
}
function catName(id){ return db.categories.find(c=>c.id===id)?.name || '—'; }

// ---------- Suplidores ----------
$('#addSupBtn').onclick=()=>{
  openModal('Nuevo Suplidor', `
    <div class="row"><label>Nombre</label><input id="sName"></div>
    <div class="row"><label>Contacto</label><input id="sContact"></div>
    <div class="row"><label>Teléfono</label><input id="sPhone"></div>
    <div class="row"><label>Email</label><input id="sEmail" type="email"></div>
  `, 'Guardar', ()=>{
    db.suppliers.push({
      id:id(), name:$('#sName').value.trim(), contact:$('#sContact').value.trim(),
      phone:$('#sPhone').value.trim(), email:$('#sEmail').value.trim()
    });
    DB.save(db); renderSuppliers();
  });
};
function renderSuppliers(){
  const tbody = $('#supTable tbody'); tbody.innerHTML='';
  db.suppliers.forEach(s=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.name}</td><td>${s.contact||''}</td><td>${s.phone||''}</td><td>${s.email||''}</td>
    <td><button class="small" data-edit="${s.id}">Editar</button>
        <button class="small outline" data-del="${s.id}">Borrar</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-edit]').forEach(b=>{
    b.onclick=()=>{
      const s = db.suppliers.find(x=>x.id===b.dataset.edit);
      openModal('Editar Suplidor', `
        <div class="row"><label>Nombre</label><input id="sName" value="${s.name}"></div>
        <div class="row"><label>Contacto</label><input id="sContact" value="${s.contact||''}"></div>
        <div class="row"><label>Teléfono</label><input id="sPhone" value="${s.phone||''}"></div>
        <div class="row"><label>Email</label><input id="sEmail" type="email" value="${s.email||''}"></div>
      `, 'Guardar', ()=>{
        s.name=$('#sName').value.trim(); s.contact=$('#sContact').value.trim();
        s.phone=$('#sPhone').value.trim(); s.email=$('#sEmail').value.trim();
        DB.save(db); renderSuppliers();
      });
    };
  });
  tbody.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick=()=>{
      if(!confirm('¿Eliminar suplidor?'))return;
      const i = db.suppliers.findIndex(x=>x.id===b.dataset.del);
      if(i>=0){ db.suppliers.splice(i,1); DB.save(db); renderSuppliers(); }
    };
  });
}

// ---------- Almacenes ----------
$('#addWhBtn').onclick=()=>{
  openModal('Nuevo Almacén', `
    <div class="row"><label>Nombre</label><input id="wName"></div>
    <div class="row"><label>Ubicación</label><input id="wLoc"></div>
  `,'Guardar', ()=>{
    db.warehouses.push({id:id(), name:$('#wName').value.trim(), location:$('#wLoc').value.trim()});
    ensureStockMatrix(); DB.save(db); renderWarehouses();
  });
};
function renderWarehouses(){
  const tbody = $('#whTable tbody'); tbody.innerHTML='';
  db.warehouses.forEach(w=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${w.name}</td><td>${w.location||''}</td>
    <td><button class="small" data-edit="${w.id}">Editar</button>
        <button class="small outline" data-del="${w.id}">Borrar</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-edit]').forEach(b=>{
    b.onclick=()=>{
      const w = db.warehouses.find(x=>x.id===b.dataset.edit);
      openModal('Editar Almacén', `
        <div class="row"><label>Nombre</label><input id="wName" value="${w.name}"></div>
        <div class="row"><label>Ubicación</label><input id="wLoc" value="${w.location||''}"></div>
      `,'Guardar', ()=>{
        w.name=$('#wName').value.trim(); w.location=$('#wLoc').value.trim();
        DB.save(db); renderWarehouses();
      });
    };
  });
  tbody.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick=()=>{
      if(!confirm('¿Eliminar almacén?'))return;
      const i = db.warehouses.findIndex(x=>x.id===b.dataset.del);
      if(i>=0){ db.warehouses.splice(i,1); DB.save(db); renderWarehouses(); }
    };
  });
}

// ---------- Stock helpers ----------
function stockTotal(itemId){
  let t = 0; Object.values(db.stock).forEach(map=>{ t += (map?.[itemId] || 0); });
  return t;
}
function addStock(warehouseId, itemId, qty){
  ensureStockMatrix();
  db.stock[warehouseId] ??= {};
  db.stock[warehouseId][itemId] = (db.stock[warehouseId][itemId]||0) + qty;
}

// ---------- Movimientos ----------
function movement({type, detail, itemId, sku, qty, fromWh='', toWh='', price=0}){
  db.moves.push({id:id(), date: nowISO(), type, detail, itemId, sku, qty, fromWh, toWh, price});
}
function requireItemAndWh(){
  if(db.items.length===0){ alert('Primero crea productos.'); return false; }
  if(db.warehouses.length===0){ alert('Crea al menos un almacén.'); return false; }
  return true;
}

// Compras
$('#addPurchaseBtn').onclick=()=>{
  if(!requireItemAndWh()) return;
  const whOpts = db.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  const itOpts = db.items.map(i=>`<option value="${i.id}">${i.sku} • ${i.name}</option>`).join('');
  const supOpts = db.suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  openModal('Registrar Compra', `
    <div class="row"><label>Suplidor</label><select id="pSup">${supOpts}</select></div>
    <div class="row"><label>Almacén</label><select id="pWh">${whOpts}</select></div>
    <div class="row"><label>Producto</label><select id="pItem">${itOpts}</select></div>
    <div class="row"><label>Cantidad</label><input id="pQty" type="number" value="1"></div>
    <div class="row"><label>Costo Unit.</label><input id="pCost" type="number" step="0.01" value="0"></div>
  `,'Guardar', ()=>{
    const itemId = $('#pItem').value; const it = db.items.find(x=>x.id===itemId);
    const wh = $('#pWh').value; const qty = Number($('#pQty').value||0);
    const cost = Number($('#pCost').value||0);
    addStock(wh, itemId, qty);
    movement({type:'compra', detail:`Compra a suplidor`, itemId, sku:it.sku, qty, toWh:wh, price:cost});
    DB.save(db); renderPurchases(); renderDashboard();
  });
};

function renderPurchases(){
  const tbody = $('#purchaseTable tbody'); tbody.innerHTML='';
  db.moves.filter(m=>m.type==='compra').slice().reverse().forEach(m=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.date.slice(0,10)}</td><td>—</td><td>${whName(m.toWh)}</td><td>${m.sku}</td><td>${m.qty}</td><td>$${(m.price||0).toFixed(2)}</td>
    <td><button class="small outline" data-del="${m.id}">Deshacer</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick=()=> undoMove(b.dataset.del);
  });
}

// Ventas
$('#addSaleBtn').onclick=()=>{
  if(!requireItemAndWh()) return;
  const whOpts = db.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  const itOpts = db.items.map(i=>`<option value="${i.id}">${i.sku} • ${i.name} (Disp: ${stockTotal(i.id)})</option>`).join('');
  openModal('Registrar Venta', `
    <div class="row"><label>Cliente</label><input id="sClient" placeholder="Nombre/Razón social"></div>
    <div class="row"><label>Almacén</label><select id="sWh">${whOpts}</select></div>
    <div class="row"><label>Producto</label><select id="sItem">${itOpts}</select></div>
    <div class="row"><label>Cantidad</label><input id="sQty" type="number" value="1"></div>
    <div class="row"><label>Precio Unit.</label><input id="sPrice" type="number" step="0.01" value="0"></div>
  `,'Guardar', ()=>{
    const itemId = $('#sItem').value; const it = db.items.find(x=>x.id===itemId);
    const wh = $('#sWh').value; const qty = Number($('#sQty').value||0);
    const price = Number($('#sPrice').value||0);
    if((db.stock?.[wh]?.[itemId]||0) < qty){ alert('Stock insuficiente en ese almacén.'); return; }
    addStock(wh, itemId, -qty);
    movement({type:'venta', detail:`Venta a ${$('#sClient').value.trim()}`, itemId, sku:it.sku, qty:-qty, fromWh:wh, price});
    DB.save(db); renderSales(); renderDashboard();
  });
};

function renderSales(){
  const tbody = $('#salesTable tbody'); tbody.innerHTML='';
  db.moves.filter(m=>m.type==='venta').slice().reverse().forEach(m=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.date.slice(0,10)}</td><td>${m.detail.replace('Venta a ','')}</td><td>${whName(m.fromWh)}</td><td>${m.sku}</td><td>${-m.qty}</td><td>$${(m.price||0).toFixed(2)}</td>
    <td><button class="small outline" data-del="${m.id}">Deshacer</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick=()=> undoMove(b.dataset.del);
  });
}

// Transferencias
$('#addTransferBtn').onclick=()=>{
  if(!requireItemAndWh()) return;
  const whOpts = db.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  const itOpts = db.items.map(i=>`<option value="${i.id}">${i.sku} • ${i.name}</option>`).join('');
  openModal('Registrar Transferencia', `
    <div class="row"><label>Desde</label><select id="tFrom">${whOpts}</select></div>
    <div class="row"><label>Hacia</label><select id="tTo">${whOpts}</select></div>
    <div class="row"><label>Producto</label><select id="tItem">${itOpts}</select></div>
    <div class="row"><label>Cantidad</label><input id="tQty" type="number" value="1"></div>
  `,'Guardar', ()=>{
    const itemId = $('#tItem').value; const it = db.items.find(x=>x.id===itemId);
    const from = $('#tFrom').value; const to = $('#tTo').value; const qty = Number($('#tQty').value||0);
    if(from===to){ alert('Selecciona almacenes distintos.'); return; }
    if((db.stock?.[from]?.[itemId]||0) < qty){ alert('Stock insuficiente.'); return; }
    addStock(from, itemId, -qty);
    addStock(to, itemId, qty);
    movement({type:'transferencia', detail:`${whName(from)} → ${whName(to)}`, itemId, sku:it.sku, qty, fromWh:from, toWh:to});
    DB.save(db); renderTransfers(); renderDashboard();
  });
};
function renderTransfers(){
  const tbody = $('#transferTable tbody'); tbody.innerHTML='';
  db.moves.filter(m=>m.type==='transferencia').slice().reverse().forEach(m=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.date.slice(0,10)}</td><td>${whName(m.fromWh)}</td><td>${whName(m.toWh)}</td><td>${m.sku}</td><td>${m.qty}</td>
    <td><button class="small outline" data-del="${m.id}">Deshacer</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick=()=> undoMove(b.dataset.del);
  });
}

// Ajustes
$('#addAdjBtn').onclick=()=>{
  if(!requireItemAndWh()) return;
  const whOpts = db.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  const itOpts = db.items.map(i=>`<option value="${i.id}">${i.sku} • ${i.name}</option>`).join('');
  openModal('Registrar Ajuste', `
    <div class="row"><label>Almacén</label><select id="aWh">${whOpts}</select></div>
    <div class="row"><label>Producto</label><select id="aItem">${itOpts}</select></div>
    <div class="row"><label>Δ Cantidad</label><input id="aQty" type="number" value="1"></div>
    <div class="row"><label>Motivo</label><input id="aReason" placeholder="Rotura, inventario físico, etc."></div>
  `,'Guardar', ()=>{
    const itemId = $('#aItem').value; const it = db.items.find(x=>x.id===itemId);
    const wh = $('#aWh').value; const qty = Number($('#aQty').value||0);
    addStock(wh, itemId, qty);
    movement({type:'ajuste', detail:$('#aReason').value.trim(), itemId, sku:it.sku, qty, toWh: qty>0?wh:'', fromWh: qty<0?wh:''});
    DB.save(db); renderAdjustments(); renderDashboard();
  });
};
function renderAdjustments(){
  const tbody = $('#adjTable tbody'); tbody.innerHTML='';
  db.moves.filter(m=>m.type==='ajuste').slice().reverse().forEach(m=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.date.slice(0,10)}</td><td>${whName(m.toWh||m.fromWh)}</td><td>${m.sku}</td><td>${m.qty}</td><td>${m.detail||''}</td>
    <td><button class="small outline" data-del="${m.id}">Deshacer</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick=()=> undoMove(b.dataset.del);
  });
}

// Deshacer movimiento (básico: revierte stock y elimina registro)
function undoMove(moveId){
  const mIdx = db.moves.findIndex(x=>x.id===moveId);
  if(mIdx<0) return;
  const m = db.moves[mIdx];
  if(!confirm('¿Deshacer este movimiento?')) return;

  if(m.type==='compra'){
    addStock(m.toWh, m.itemId, -m.qty);
  } else if(m.type==='venta'){
    addStock(m.fromWh, m.itemId, -m.qty); // m.qty es negativo, sumará
  } else if(m.type==='transferencia'){
    addStock(m.toWh, m.itemId, -m.qty);
    addStock(m.fromWh, m.itemId, m.qty);
  } else if(m.type==='ajuste'){
    if(m.qty>0) addStock(m.toWh, m.itemId, -m.qty);
    else addStock(m.fromWh, m.itemId, -m.qty);
  }
  db.moves.splice(mIdx,1);
  DB.save(db);
  // refrescos
  renderDashboard(); renderPurchases(); renderSales(); renderTransfers(); renderAdjustments();
}

// ---------- Reportes ----------
$('#repStockBtn').onclick=()=>{
  const sku = $('#repSku').value.trim().toLowerCase();
  const tbody = $('#repStockTable tbody'); tbody.innerHTML='';
  db.warehouses.forEach(w=>{
    db.items.forEach(it=>{
      if(sku && !it.sku.toLowerCase().includes(sku)) return;
      const qty = db.stock?.[w.id]?.[it.id] || 0;
      if(qty!==0){
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${w.name}</td><td>${it.sku}</td><td>${it.name}</td><td>${qty}</td>`;
        tbody.appendChild(tr);
      }
    });
  });
};

$('#kardexBtn').onclick=()=>{
  const sku = $('#kardexSku').value.trim().toLowerCase();
  const tbody = $('#kardexTable tbody'); tbody.innerHTML='';
  db.moves.filter(m=> m.sku.toLowerCase()===sku)
    .sort((a,b)=> a.date.localeCompare(b.date))
    .forEach(m=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${m.date.slice(0,19).replace('T',' ')}</td><td>${m.type}</td><td>${m.detail||''}</td><td>${m.qty}</td>`;
      tbody.appendChild(tr);
    });
};

// ---------- Export / Import / Print ----------
$('#exportJsonBtn').onclick=()=>{
  const blob = new Blob([JSON.stringify(db,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'inventario.json';
  a.click();
};

$('#importJsonBtn').onclick=()=> $('#importFile').click();
$('#importFile').onchange=(e)=>{
  const file = e.target.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(!data.items || !data.moves) throw new Error('Formato inválido');
      db = data; DB.save(db); ensureStockMatrix();
      alert('Datos importados.');
      refreshAll();
    }catch(err){
      alert('Error al importar: '+err.message);
    }
  };
  reader.readAsText(file);
};

$('#exportCsvBtn').onclick=()=>{
  const headers = ['SKU','Nombre','Categoria','Precio','Minimo','StockTotal'];
  const rows = db.items.map(it=>[
    it.sku, it.name, catName(it.categoryId), it.price, it.min??0, stockTotal(it.id)
  ]);
  const csv = [headers.join(','), ...rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'productos.csv'; a.click();
};

$('#printBtn').onclick=()=> window.print();

// ---------- Configuración ----------
$('#saveBrandBtn').onclick=()=>{
  db.settings.brandName = $('#brandName').value.trim() || db.settings.brandName;
  DB.save(db); applyBrand();
};
$('#changePinBtn').onclick=()=> $('#setPinBtn').click();

$('#logoFile').onchange=(e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    db.settings.logoDataUrl = reader.result;
    DB.save(db);
    $('#logoPreview').src = db.settings.logoDataUrl;
  };
  reader.readAsDataURL(f);
};

// ---------- Helpers de UI ----------
function whName(id){ return db.warehouses.find(w=>w.id===id)?.name || '—'; }

function applyBrand(){
  $('.logo').textContent = db.settings.brandName || 'Inventario';
  $('#brandName').value = db.settings.brandName || '';
  if(db.settings.logoDataUrl) $('#logoPreview').src = db.settings.logoDataUrl;
}

function refreshAll(){
  renderDashboard(); renderItems(); renderCategories(); renderSuppliers(); renderWarehouses();
  renderPurchases(); renderSales(); renderTransfers(); renderAdjustments();
}

// ---------- Entrada a la APP ----------
function enterApp(){
  loginView.classList.remove('active');
  appView.classList.add('active');
  applyBrand();
  ensureStockMatrix();
  refreshAll();
}

// ---------- Inicial ----------
window.addEventListener('DOMContentLoaded', ()=>{
  // si ya hay PIN, solo mostrar login; si no, también
  $('#pinInput').focus();
});
