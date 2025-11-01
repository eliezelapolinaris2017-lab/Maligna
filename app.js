/* =========================
   Inventario Corporativo – Tema claro + PDFs reales B/N
   ========================= */

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const nowISO = ()=>new Date().toISOString();

const store = {
  get:(k,d)=>{ try{return JSON.parse(localStorage.getItem(k))??d;}catch{return d;} },
  set:(k,v)=>localStorage.setItem(k, JSON.stringify(v)),
  del:(k)=>localStorage.removeItem(k)
};

const DB = {
  key:'inv.db.v1',
  load(){
    let db = store.get(this.key);
    if(!db){
      db = {
        settings:{ brandName:'Oasis • Inventario', logoDataUrl:'', lowStockDefault:1 },
        security:{ pinHash:'' },
        categories:[],
        suppliers:[],
        warehouses:[{id:id(), name:'Principal', location:''}],
        items:[],
        stock:{},
        moves:[]
      };
      store.set(this.key, db);
    }
    return db;
  },
  save(db){ store.set(this.key, db); }
};
let db = DB.load();

function id(){ return Math.random().toString(36).slice(2,10); }
function ensureStockMatrix(){ db.warehouses.forEach(w=>{ if(!db.stock[w.id]) db.stock[w.id] = {}; }); }
function whName(id){ return db.warehouses.find(w=>w.id===id)?.name || '—'; }
function catName(id){ return db.categories.find(c=>c.id===id)?.name || '—'; }
function stockTotal(itemId){ let t=0; Object.values(db.stock).forEach(m=>{ t += (m?.[itemId]||0); }); return t; }

function hashPin(pin){
  let h=0; for(let i=0;i<pin.length;i++){ h=((h<<5)-h)+pin.charCodeAt(i); h|=0;}
  return String(h);
}

/* ---------- Auth ---------- */
const loginView = $('#loginView');
const appView = $('#appView');

$('#loginBtn').onclick=()=>{
  const pin = $('#pinInput').value.trim();
  if(!db.security.pinHash){ alert('Primero crea un PIN.'); return; }
  if(hashPin(pin)===db.security.pinHash) enterApp();
  else alert('PIN incorrecto');
};
$('#setPinBtn').onclick=()=>{
  const pin = prompt('Nuevo PIN (4-8 dígitos):')?.trim() ?? '';
  if(!pin || pin.length<4){ alert('PIN muy corto'); return; }
  db.security.pinHash = hashPin(pin); DB.save(db); alert('PIN guardado.');
};
$('#logoutBtn').onclick=()=>{ appView.classList.remove('active'); loginView.classList.add('active'); };

/* ---------- Nav ---------- */
$$('.nav-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    $$('.nav-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const page = b.dataset.nav;
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

/* ---------- Modal ---------- */
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
  const okHandler = ()=>{ onOk(); closeModal(); };
  modalOk.onclick = okHandler;
  modalCancel.onclick = closeModal;
  modalClose.onclick = closeModal;
}
function closeModal(){ modal.classList.add('hidden'); modalBody.innerHTML=''; }

/* ---------- Dashboard ---------- */
function renderDashboard(){
  $('#kpiSkus').textContent = db.items.length;
  $('#kpiStock').textContent = db.items.reduce((a,it)=>a+stockTotal(it.id),0);
  $('#kpiLow').textContent = db.items.filter(it=>stockTotal(it.id) <= (it.min ?? db.settings.lowStockDefault)).length;
  $('#kpiWh').textContent = db.warehouses.length;

  const tbody = $('#lowStockTable tbody'); tbody.innerHTML='';
  db.items.forEach(it=>{
    const st = stockTotal(it.id), min = it.min ?? db.settings.lowStockDefault;
    if(st<=min){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${it.sku}</td><td>${it.name}</td><td>${st}</td><td>${min}</td>`;
      tbody.appendChild(tr);
    }
  });
}

/* ---------- Items ---------- */
$('#addItemBtn').onclick=()=>{
  const cats = optionsCats();
  openModal('Nuevo Producto', `
    <div class="row"><label>SKU</label><input id="fSku"></div>
    <div class="row"><label>Nombre</label><input id="fName"></div>
    <div class="row"><label>Categoría</label><select id="fCat">${cats}</select></div>
    <div class="row"><label>Precio</label><input id="fPrice" type="number" step="0.01" value="0"></div>
    <div class="row"><label>Mínimo</label><input id="fMin" type="number" value="${db.settings.lowStockDefault}"></div>
  `,'Guardar',()=>{
    db.items.push({
      id:id(), sku:$('#fSku').value.trim(), name:$('#fName').value.trim(),
      categoryId:$('#fCat').value, price:Number($('#fPrice').value||0),
      min:Number($('#fMin').value||0), active:true
    });
    DB.save(db); renderItems();
  });
};
$('#itemSearch').addEventListener('input', renderItems);

function renderItems(){
  const term = ($('#itemSearch').value||'').toLowerCase();
  const tbody = $('#itemsTable tbody'); tbody.innerHTML='';
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
        </td>`;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll('[data-edit]').forEach(b=>{
    b.onclick=()=>{
      const it = db.items.find(x=>x.id===b.dataset.edit);
      const cats = optionsCats(it.categoryId);
      openModal('Editar Producto', `
        <div class="row"><label>SKU</label><input id="fSku" value="${it.sku}"></div>
        <div class="row"><label>Nombre</label><input id="fName" value="${it.name}"></div>
        <div class="row"><label>Categoría</label><select id="fCat">${cats}</select></div>
        <div class="row"><label>Precio</label><input id="fPrice" type="number" step="0.01" value="${it.price}"></div>
        <div class="row"><label>Mínimo</label><input id="fMin" type="number" value="${it.min ?? 0}"></div>
      `,'Guardar',()=>{
        it.sku=$('#fSku').value.trim();
        it.name=$('#fName').value.trim();
        it.categoryId=$('#fCat').value;
        it.price=Number($('#fPrice').value||0);
        it.min=Number($('#fMin').value||0);
        DB.save(db); renderItems();
      });
    };
  });
  tbody.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick=()=>{
      if(!confirm('¿Eliminar producto?'))return;
      const i = db.items.findIndex(x=>x.id===b.dataset.del);
      if(i>=0){ db.items.splice(i,1); DB.save(db); renderItems(); }
    };
  });
}
function optionsCats(selected=''){
  const none = `<option value="">(sin categoría)</option>`;
  return none + db.categories.map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${c.name}</option>`).join('');
}

/* ---------- Categories ---------- */
$('#addCatBtn').onclick=()=>{
  openModal('Nueva Categoría', `
    <div class="row"><label>Nombre</label><input id="cName"></div>
    <div class="row"><label>Descripción</label><input id="cDesc"></div>
  `,'Guardar',()=>{
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
      `,'Guardar',()=>{
        c.name=$('#cName').value.trim();
        c.desc=$('#cDesc').value.trim();
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

/* ---------- Suppliers ---------- */
$('#addSupBtn').onclick=()=>{
  openModal('Nuevo Suplidor', `
    <div class="row"><label>Nombre</label><input id="sName"></div>
    <div class="row"><label>Contacto</label><input id="sContact"></div>
    <div class="row"><label>Teléfono</label><input id="sPhone"></div>
    <div class="row"><label>Email</label><input id="sEmail" type="email"></div>
  `,'Guardar',()=>{
    db.suppliers.push({id:id(), name:$('#sName').value.trim(), contact:$('#sContact').value.trim(),
      phone:$('#sPhone').value.trim(), email:$('#sEmail').value.trim()});
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
      `,'Guardar',()=>{
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

/* ---------- Warehouses ---------- */
$('#addWhBtn').onclick=()=>{
  openModal('Nuevo Almacén', `
    <div class="row"><label>Nombre</label><input id="wName"></div>
    <div class="row"><label>Ubicación</label><input id="wLoc"></div>
  `,'Guardar',()=>{
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
      `,'Guardar',()=>{
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

/* ---------- Movements ---------- */
function movement({type, detail, itemId, sku, qty, fromWh='', toWh='', price=0}){
  db.moves.push({id:id(), date:nowISO(), type, detail, itemId, sku, qty, fromWh, toWh, price});
}
function addStock(whId, itemId, qty){
  ensureStockMatrix();
  db.stock[whId] ??= {};
  db.stock[whId][itemId] = (db.stock[whId][itemId]||0) + qty;
}
function requireItemAndWh(){
  if(!db.items.length){ alert('Primero crea productos.'); return false;}
  if(!db.warehouses.length){ alert('Crea al menos un almacén.'); return false;}
  return true;
}

/* Compras */
$('#addPurchaseBtn').onclick=()=>{
  if(!requireItemAndWh()) return;
  const wh = db.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  const it = db.items.map(i=>`<option value="${i.id}">${i.sku} • ${i.name}</option>`).join('');
  const sp = db.suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  openModal('Registrar Compra', `
    <div class="row"><label>Suplidor</label><select id="pSup">${sp}</select></div>
    <div class="row"><label>Almacén</label><select id="pWh">${wh}</select></div>
    <div class="row"><label>Producto</label><select id="pItem">${it}</select></div>
    <div class="row"><label>Cantidad</label><input id="pQty" type="number" value="1"></div>
    <div class="row"><label>Costo Unit.</label><input id="pCost" type="number" step="0.01" value="0"></div>
  `,'Guardar',()=>{
    const itemId = $('#pItem').value; const itm = db.items.find(x=>x.id===itemId);
    const whId = $('#pWh').value; const qty = Number($('#pQty').value||0);
    const cost = Number($('#pCost').value||0);
    addStock(whId, itemId, qty);
    movement({type:'compra', detail:'Compra a suplidor', itemId, sku:itm.sku, qty, toWh:whId, price:cost});
    DB.save(db); renderPurchases(); renderDashboard();
  });
};
function renderPurchases(){
  const tbody = $('#purchaseTable tbody'); tbody.innerHTML='';
  db.moves.filter(m=>m.type==='compra').slice().reverse().forEach(m=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${m.date.slice(0,10)}</td><td>—</td><td>${whName(m.toWh)}</td><td>${m.sku}</td><td>${m.qty}</td><td>$${(m.price||0).toFixed(2)}</td>
    <td><button class="small outline" data-del="${m.id}">Deshacer</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>undoMove(b.dataset.del));
}

/* Ventas */
$('#addSaleBtn').onclick=()=>{
  if(!requireItemAndWh()) return;
  const wh = db.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  const it = db.items.map(i=>`<option value="${i.id}">${i.sku} • ${i.name} (Disp: ${stockTotal(i.id)})</option>`).join('');
  openModal('Registrar Venta', `
    <div class="row"><label>Cliente</label><input id="sClient" placeholder="Nombre/Razón social"></div>
    <div class="row"><label>Almacén</label><select id="sWh">${wh}</select></div>
    <div class="row"><label>Producto</label><select id="sItem">${it}</select></div>
    <div class="row"><label>Cantidad</label><input id="sQty" type="number" value="1"></div>
    <div class="row"><label>Precio Unit.</label><input id="sPrice" type="number" step="0.01" value="0"></div>
  `,'Guardar',()=>{
    const itemId = $('#sItem').value; const itm = db.items.find(x=>x.id===itemId);
    const whId = $('#sWh').value; const qty = Number($('#sQty').value||0);
    const price = Number($('#sPrice').value||0);
    if((db.stock?.[whId]?.[itemId]||0) < qty){ alert('Stock insuficiente.'); return; }
    addStock(whId, itemId, -qty);
    movement({type:'venta', detail:`Venta a ${$('#sClient').value.trim()}`, itemId, sku:itm.sku, qty:-qty, fromWh:whId, price});
    DB.save(db); renderSales(); renderDashboard();
  });
};
function renderSales(){
  const tbody = $('#salesTable tbody'); tbody.innerHTML='';
  db.moves.filter(m=>m.type==='venta').slice().reverse().forEach(m=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${m.date.slice(0,10)}</td><td>${m.detail.replace('Venta a ','')}</td>
    <td>${whName(m.fromWh)}</td><td>${m.sku}</td><td>${-m.qty}</td><td>$${(m.price||0).toFixed(2)}</td>
    <td><button class="small outline" data-del="${m.id}">Deshacer</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>undoMove(b.dataset.del));
}

/* Transferencias */
$('#addTransferBtn').onclick=()=>{
  if(!requireItemAndWh()) return;
  const wh = db.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  const it = db.items.map(i=>`<option value="${i.id}">${i.sku} • ${i.name}</option>`).join('');
  openModal('Registrar Transferencia', `
    <div class="row"><label>Desde</label><select id="tFrom">${wh}</select></div>
    <div class="row"><label>Hacia</label><select id="tTo">${wh}</select></div>
    <div class="row"><label>Producto</label><select id="tItem">${it}</select></div>
    <div class="row"><label>Cantidad</label><input id="tQty" type="number" value="1"></div>
  `,'Guardar',()=>{
    const itemId=$('#tItem').value; const itm=db.items.find(x=>x.id===itemId);
    const from=$('#tFrom').value; const to=$('#tTo').value; const qty=Number($('#tQty').value||0);
    if(from===to){ alert('Selecciona almacenes distintos.'); return; }
    if((db.stock?.[from]?.[itemId]||0)<qty){ alert('Stock insuficiente.'); return; }
    addStock(from,itemId,-qty); addStock(to,itemId,qty);
    movement({type:'transferencia', detail:`${whName(from)} → ${whName(to)}`, itemId, sku:itm.sku, qty, fromWh:from, toWh:to});
    DB.save(db); renderTransfers(); renderDashboard();
  });
};
function renderTransfers(){
  const tbody = $('#transferTable tbody'); tbody.innerHTML='';
  db.moves.filter(m=>m.type==='transferencia').slice().reverse().forEach(m=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${m.date.slice(0,10)}</td><td>${whName(m.fromWh)}</td><td>${whName(m.toWh)}</td><td>${m.sku}</td><td>${m.qty}</td>
    <td><button class="small outline" data-del="${m.id}">Deshacer</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>undoMove(b.dataset.del));
}

/* Ajustes */
$('#addAdjBtn').onclick=()=>{
  if(!requireItemAndWh()) return;
  const wh = db.warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  const it = db.items.map(i=>`<option value="${i.id}">${i.sku} • ${i.name}</option>`).join('');
  openModal('Registrar Ajuste', `
    <div class="row"><label>Almacén</label><select id="aWh">${wh}</select></div>
    <div class="row"><label>Producto</label><select id="aItem">${it}</select></div>
    <div class="row"><label>Δ Cantidad</label><input id="aQty" type="number" value="1"></div>
    <div class="row"><label>Motivo</label><input id="aReason" placeholder="Rotura, inventario físico, etc."></div>
  `,'Guardar',()=>{
    const itemId=$('#aItem').value; const itm=db.items.find(x=>x.id===itemId);
    const whId=$('#aWh').value; const qty=Number($('#aQty').value||0);
    addStock(whId,itemId,qty);
    movement({type:'ajuste', detail:$('#aReason').value.trim(), itemId, sku:itm.sku, qty, toWh: qty>0?whId:'', fromWh: qty<0?whId:''});
    DB.save(db); renderAdjustments(); renderDashboard();
  });
};
function renderAdjustments(){
  const tbody = $('#adjTable tbody'); tbody.innerHTML='';
  db.moves.filter(m=>m.type==='ajuste').slice().reverse().forEach(m=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${m.date.slice(0,10)}</td><td>${whName(m.toWh||m.fromWh)}</td><td>${m.sku}</td><td>${m.qty}</td><td>${m.detail||''}</td>
    <td><button class="small outline" data-del="${m.id}">Deshacer</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>undoMove(b.dataset.del));
}

/* Deshacer movimiento */
function undoMove(idm){
  const i = db.moves.findIndex(x=>x.id===idm); if(i<0) return;
  const m = db.moves[i];
  if(!confirm('¿Deshacer este movimiento?'))return;
  if(m.type==='compra'){ addStock(m.toWh,m.itemId,-m.qty); }
  else if(m.type==='venta'){ addStock(m.fromWh,m.itemId,-m.qty); }
  else if(m.type==='transferencia'){ addStock(m.toWh,m.itemId,-m.qty); addStock(m.fromWh,m.itemId,m.qty); }
  else if(m.type==='ajuste'){ if(m.qty>0) addStock(m.toWh,m.itemId,-m.qty); else addStock(m.fromWh,m.itemId,-m.qty); }
  db.moves.splice(i,1); DB.save(db);
  renderDashboard(); renderPurchases(); renderSales(); renderTransfers(); renderAdjustments();
}

/* ---------- Reportes (pantalla) ---------- */
$('#repStockBtn').onclick=()=>{
  const sku = ($('#repSku').value||'').toLowerCase();
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
  const sku = ($('#kardexSku').value||'').toLowerCase();
  const tbody = $('#kardexTable tbody'); tbody.innerHTML='';
  db.moves.filter(m=>m.sku.toLowerCase()===sku)
    .sort((a,b)=>a.date.localeCompare(b.date))
    .forEach(m=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${m.date.slice(0,19).replace('T',' ')}</td><td>${m.type}</td><td>${m.detail||''}</td><td>${m.qty}</td>`;
      tbody.appendChild(tr);
    });
};

/* ---------- Export / Import / CSV ---------- */
$('#exportJsonBtn').onclick=()=>{
  const blob = new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='inventario.json'; a.click();
};
$('#importJsonBtn').onclick=()=>$('#importFile').click();
$('#importFile').onchange=(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const data = JSON.parse(r.result);
      if(!data.items || !data.moves) throw new Error('Formato inválido');
      db=data; DB.save(db); ensureStockMatrix(); alert('Datos importados.'); refreshAll();
    }catch(err){ alert('Error al importar: '+err.message); }
  };
  r.readAsText(f);
};
$('#exportCsvBtn').onclick=()=>{
  const headers=['SKU','Nombre','Categoria','Precio','Minimo','StockTotal'];
  const rows=db.items.map(it=>[it.sku,it.name,catName(it.categoryId),it.price,it.min??0,stockTotal(it.id)]);
  const csv=[headers.join(','),...rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='productos.csv'; a.click();
};

/* ---------- Configuración ---------- */
$('#saveBrandBtn').onclick=()=>{ db.settings.brandName=$('#brandName').value.trim()||db.settings.brandName; DB.save(db); applyBrand(); };
$('#changePinBtn').onclick=()=>$('#setPinBtn').click();
$('#logoFile').onchange=(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ db.settings.logoDataUrl=r.result; DB.save(db); $('#logoPreview').src=db.settings.logoDataUrl; };
  r.readAsDataURL(f);
};
function applyBrand(){
  $('.logo').textContent = db.settings.brandName || 'Inventario';
  $('#brandName').value = db.settings.brandName || '';
  if(db.settings.logoDataUrl) $('#logoPreview').src = db.settings.logoDataUrl;
}

/* ---------- PDFs en B/N ---------- */
const { jsPDF } = window.jspdf || {};

function drawHeader(doc, title){
  doc.setTextColor(0);             // negro
  doc.setDrawColor(0);             // bordes negros
  doc.setFillColor(255,255,255);   // relleno blanco
  // Logo (si hay) convertido a gris:
  if(db.settings.logoDataUrl){
    const {grayDataUrl, w, h} = toGrayScaleDataUrl(db.settings.logoDataUrl, 80, 26);
    try{ doc.addImage(grayDataUrl, 'PNG', 14, 12, w, h); }catch{}
  }
  doc.setFont('helvetica','bold');
  doc.setFontSize(16);
  doc.text(db.settings.brandName || 'Inventario', 100, 20, {align:'left'});
  doc.setFontSize(11);
  doc.setFont('helvetica','normal');
  doc.text(title, 100, 28, {align:'left'});
  doc.line(14, 36, 196, 36);
}

function toGrayScaleDataUrl(src, targetW=80, targetH=26){
  const img = new Image(); img.src = src;
  // NOTA: sincrónico aproximado (canvas tras onload inmediato si cached)
  const canvas = document.createElement('canvas');
  canvas.width = targetW; canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  // intentamos dibujar (si no carga aún, se dibuja vacío y no rompe)
  try{ ctx.drawImage(img, 0, 0, targetW, targetH); }catch{}
  const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
  const d = imgData.data;
  for(let i=0;i<d.length;i+=4){
    const r=d[i], g=d[i+1], b=d[i+2];
    const y = 0.299*r + 0.587*g + 0.114*b;
    d[i]=d[i+1]=d[i+2]=y;
  }
  ctx.putImageData(imgData,0,0);
  return { grayDataUrl: canvas.toDataURL('image/png'), w:targetW, h:targetH };
}

function savePdf(doc, filename){
  doc.save(filename.replace(/\s+/g,'_')+'.pdf');
}

/* PDF Catálogo de Productos */
$('#pdfItemsBtn').onclick=()=>{
  const doc = new jsPDF({unit:'mm', format:'a4', compress:true});
  drawHeader(doc, 'Catálogo de Productos (B/N)');
  const rows = db.items.map(it=>[
    it.sku, it.name, catName(it.categoryId), Number(it.price||0).toFixed(2), it.min??0, stockTotal(it.id)
  ]);
  doc.autoTable({
    startY: 42,
    head:[['SKU','Nombre','Categoría','Precio','Mín.','Stock']],
    body: rows,
    styles:{ textColor:[0,0,0], lineColor:[0,0,0], fillColor:[255,255,255] },
    headStyles:{ fillColor:[230,230,230], textColor:[0,0,0] },
    theme:'grid'
  });
  savePdf(doc, 'Catalogo_Productos');
};

/* PDF Stock por almacén (con filtro opcional) */
$('#pdfStockBtn').onclick=()=>{
  const skuFilter = ($('#repSku').value||'').toLowerCase();
  const body=[];
  db.warehouses.forEach(w=>{
    db.items.forEach(it=>{
      if(skuFilter && !it.sku.toLowerCase().includes(skuFilter)) return;
      const qty = db.stock?.[w.id]?.[it.id] || 0;
      if(qty!==0) body.push([w.name, it.sku, it.name, qty]);
    });
  });
  const doc = new jsPDF({unit:'mm', format:'a4', compress:true});
  drawHeader(doc, 'Existencias por Almacén (B/N)');
  doc.autoTable({
    startY:42,
    head:[['Almacén','SKU','Nombre','Stock']],
    body,
    styles:{ textColor:[0,0,0], lineColor:[0,0,0], fillColor:[255,255,255] },
    headStyles:{ fillColor:[230,230,230], textColor:[0,0,0] },
    theme:'grid'
  });
  savePdf(doc, 'Stock_por_Almacen');
};

/* PDF Kardex para un SKU */
$('#pdfKardexBtn').onclick=()=>{
  const sku = ($('#kardexSku').value||'').toLowerCase();
  if(!sku){ alert('Escribe un SKU para el Kardex.'); return; }
  const moves = db.moves
    .filter(m=>m.sku.toLowerCase()===sku)
    .sort((a,b)=>a.date.localeCompare(b.date));
  if(!moves.length){ alert('No hay movimientos para ese SKU.'); return; }

  const doc = new jsPDF({unit:'mm', format:'a4', compress:true});
  drawHeader(doc, `Kardex – SKU: ${sku.toUpperCase()} (B/N)`);
  const body = moves.map(m=>[
    m.date.slice(0,19).replace('T',' '), m.type, m.detail||'', m.qty
  ]);
  doc.autoTable({
    startY:42,
    head:[['Fecha','Tipo','Detalle','Qty']],
    body,
    styles:{ textColor:[0,0,0], lineColor:[0,0,0], fillColor:[255,255,255] },
    headStyles:{ fillColor:[230,230,230], textColor:[0,0,0] },
    theme:'grid'
  });
  savePdf(doc, `Kardex_${sku.toUpperCase()}`);
};

/* ---------- Entradas: Items, etc. (listeners ya arriba) ---------- */

/* ---------- Inicial + Helpers ---------- */
function applyLogoPreview(){ if(db.settings.logoDataUrl) $('#logoPreview').src=db.settings.logoDataUrl; }
function refreshAll(){
  renderDashboard(); renderItems(); renderCategories(); renderSuppliers(); renderWarehouses();
  renderPurchases(); renderSales(); renderTransfers(); renderAdjustments();
}
function enterApp(){
  loginView.classList.remove('active');
  appView.classList.add('active');
  applyBrand(); ensureStockMatrix(); applyLogoPreview(); refreshAll();
}
window.addEventListener('DOMContentLoaded',()=>{ $('#pinInput').focus(); });
