const PRICE_PER_GALLON = 20; 
const MAINTENANCE_INTERVAL_DAYS = 30;
const BACKWASH_INTERVAL_DAYS = 14;

const state = {
  users: [],
  transactions: [],
  bills: [],
  deliveries: [],
  maintenance: [],
  inventory: [],   
  receiving: [],
  employees: [],
  suppliers: [],
  counters: { user:0, tx:0, bill:0, delivery:0, maint:0, inv:0, recv:0, emp:0, sup:0 },
  currentUser: null,
};

function nextId(prefix, key){
  state.counters[key] += 1;
  return `${prefix}-${String(state.counters[key]).padStart(3,'0')}`;
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtMoney(n){ return '₱' + (Number(n)||0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtDate(d){ if(!d) return '—'; const dt = new Date(d); if(isNaN(dt)) return d; return dt.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}); }
function daysBetween(a,b){ return Math.floor((new Date(b) - new Date(a)) / 86400000); }

function linearSearch(arr, predicate){
  for(let i=0;i<arr.length;i++){ if(predicate(arr[i])) return arr[i]; }
  return null;
}

function toast(msg){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>{ el.textContent = ''; }, 2600);
}

function setMsg(elId, message, ok){
  const el = document.getElementById(elId);
  if(!el) return;
  el.textContent = (ok ? '' : 'Error: ') + message;
}

function seed(){
  state.users.push({ id: nextId('U','user'), fullName:'System Administrator', username:'admin', password:'admin123', role:'Admin' });
}
seed();

/* =========================================================================
   1. USER MANAGEMENT
   ========================================================================= */
function registerUser({fullName, username, password, role}){
  const exists = linearSearch(state.users, u => u.username.toLowerCase() === username.toLowerCase());
  if(exists) return { ok:false, message:'That username is already taken.' };
  const user = { id: nextId('U','user'), fullName, username, password, role };
  state.users.push(user);
  return { ok:true, user };
}

function loginUser(username, password){
  const user = linearSearch(state.users, u => u.username.toLowerCase() === username.toLowerCase());
  if(!user) return { ok:false, message:'No account with that username.' };
  if(user.password !== password) return { ok:false, message:'Incorrect password.' };
  return { ok:true, user };
}

function deleteUser(userId){
  const idx = state.users.findIndex(u => u.id.toLowerCase() === userId.toLowerCase());
  if(idx === -1) return { ok:false, message:'No account with that User ID.' };
  if(state.users[idx].id === state.currentUser?.id) return { ok:false, message:"You can't delete the account you're logged in as." };
  state.users.splice(idx,1);
  return { ok:true };
}

function renderUsers(){
  const tbody = document.querySelector('#tbl-users tbody');
  tbody.innerHTML = state.users.length ? state.users.map(u => `
    <tr><td>${u.id}</td><td>${escapeHtml(u.fullName)}</td><td>${escapeHtml(u.username)}</td>
    <td>${u.role}</td></tr>
  `).join('') : emptyRow(4,'No accounts yet.');
}

function uiRegisterUser(e){
  e.preventDefault();
  const fullName = val('um-fullname'), username = val('um-username'), password = val('um-password'), role = val('um-role');
  const res = registerUser({fullName, username, password, role});
  if(res.ok){
    setMsg('um-msg', `Account ${res.user.id} created for ${res.user.fullName}.`, true);
    e.target.reset();
    renderUsers();
  } else setMsg('um-msg', res.message, false);
  return false;
}

function uiDeleteUser(e){
  e.preventDefault();
  const id = val('um-delete-id');
  const res = deleteUser(id);
  if(res.ok){ setMsg('um-delete-msg','Account deleted.', true); e.target.reset(); renderUsers(); }
  else setMsg('um-delete-msg', res.message, false);
  return false;
}

/* =========================================================================
   2. TRANSACTION MANAGEMENT
   ========================================================================= */
function addTransaction({customerName, quantity, orderTotal, payment, employeeId, source}){
  const change = +(payment - orderTotal).toFixed(2);
  const record = {
    id: nextId('TXN','tx'), date: todayISO(), customerName, quantity: Number(quantity),
    orderTotal: Number(orderTotal), payment: Number(payment), change, employeeId, source: source || 'Walk-in'
  };
  state.transactions.push(record);
  return record;
}

function renderTransactions(){
  const tbody = document.querySelector('#tbl-transactions tbody');
  tbody.innerHTML = state.transactions.length ? state.transactions.slice().reverse().map(t => `
    <tr><td>${t.id}</td><td>${fmtDate(t.date)}</td><td>${escapeHtml(t.customerName)}</td><td>${t.quantity}</td>
    <td>${fmtMoney(t.orderTotal)}</td><td>${fmtMoney(t.payment)}</td><td>${fmtMoney(t.change)}</td>
    <td>${t.employeeId}</td><td>${t.source}</td></tr>
  `).join('') : emptyRow(9,'No transactions recorded yet.');
  renderSales();
}

function uiAddTransaction(e){
  e.preventDefault();
  const customerName = val('tx-customer'), quantity = val('tx-qty'), orderTotal = parseFloat(val('tx-total')), payment = parseFloat(val('tx-payment'));
  if(payment < orderTotal){ setMsg('tx-msg','Payment cannot be less than the order total.', false); return false; }
  addTransaction({customerName, quantity, orderTotal, payment, employeeId: state.currentUser.id, source:'Walk-in'});
  setMsg('tx-msg','Transaction completed.', true);
  e.target.reset();
  renderTransactions();
  return false;
}

/* =========================================================================
   3. SALES & PROFIT MANAGEMENT
   ========================================================================= */
function renderSales(){
  const sales = state.transactions.reduce((s,t)=>s+t.orderTotal, 0);
  const expenses = state.bills.reduce((s,b)=>s+b.amount, 0);
  const profit = sales - expenses;
  document.getElementById('stat-sales').textContent = fmtMoney(sales);
  document.getElementById('stat-expenses').textContent = fmtMoney(expenses);
  document.getElementById('stat-profit').textContent = fmtMoney(profit);
}

/* =========================================================================
   4. BILLS & TAX MANAGEMENT
   ========================================================================= */
function addBill({datePaid, billType, amount}){
  const record = { id: nextId('BILL','bill'), datePaid, billType, amount: Number(amount) };
  state.bills.push(record);
  return record;
}

function renderBills(){
  const tbody = document.querySelector('#tbl-bills tbody');
  tbody.innerHTML = state.bills.length ? state.bills.slice().reverse().map(b => `
    <tr><td>${b.id}</td><td>${fmtDate(b.datePaid)}</td><td>${escapeHtml(b.billType)}</td><td>${fmtMoney(b.amount)}</td></tr>
  `).join('') : emptyRow(4,'No bills recorded yet.');
  const total = state.bills.reduce((s,b)=>s+b.amount,0);
  document.getElementById('bills-grand-total').textContent = `Total paid to date: ${fmtMoney(total)}`;
  renderSales();
}

function uiAddBill(e){
  e.preventDefault();
  addBill({ datePaid: val('bill-date'), billType: val('bill-type'), amount: parseFloat(val('bill-amount')) });
  toast('Bill recorded.');
  e.target.reset();
  renderBills();
  return false;
}

function uiRangeTotal(){
  const from = val('bill-from'), to = val('bill-to');
  if(!from || !to){ document.getElementById('bill-range-result').textContent = 'Pick both a from and to date.'; return; }
  const total = state.bills.filter(b => b.datePaid >= from && b.datePaid <= to).reduce((s,b)=>s+b.amount,0);
  document.getElementById('bill-range-result').textContent = `Total expenses from ${fmtDate(from)} to ${fmtDate(to)}: ${fmtMoney(total)}`;
}

/* =========================================================================
   5. DELIVERY MANAGEMENT
   ========================================================================= */
function addDelivery({customerName, address, quantity}){
  const record = { id: nextId('DLV','delivery'), dateAdded: todayISO(), customerName, address, quantity:Number(quantity), status:'Pending' };
  state.deliveries.push(record);
  return record;
}

function markDelivered(deliveryId){
  const idx = state.deliveries.findIndex(d => d.id === deliveryId);
  if(idx === -1) return;
  const d = state.deliveries[idx];
  const orderTotal = d.quantity * PRICE_PER_GALLON;
  addTransaction({
    customerName: d.customerName, quantity: d.quantity, orderTotal, payment: orderTotal,
    employeeId: state.currentUser.id, source:'Delivery'
  });
  state.deliveries.splice(idx,1); 
  toast(`Delivery ${d.id} completed — moved to Transactions.`);
  renderDelivery();
  renderTransactions();
  renderAlerts();
}

function renderDelivery(){
  const tbody = document.querySelector('#tbl-delivery tbody');
  const pending = state.deliveries.filter(d => d.status === 'Pending');
  tbody.innerHTML = pending.length ? pending.map(d => `
    <tr><td>${d.id}</td><td>${fmtDate(d.dateAdded)}</td><td>${escapeHtml(d.customerName)}</td><td>${escapeHtml(d.address)}</td>
    <td>${d.quantity}</td><td>${d.status}</td>
    <td><button class="btn-primary" style="width:auto; padding:4px 8px;" onclick="markDelivered('${d.id}')">Mark delivered</button></td></tr>
  `).join('') : emptyRow(7,'No pending deliveries.');
}

function uiAddDelivery(e){
  e.preventDefault();
  addDelivery({ customerName: val('dl-customer'), address: val('dl-address'), quantity: val('dl-qty') });
  toast('Delivery order added.');
  e.target.reset();
  renderDelivery();
  renderAlerts();
  return false;
}

/* =========================================================================
   6. EQUIPMENT MAINTENANCE
   ========================================================================= */
let lastMaintenanceByType = {};
let lastBackwashDate = null;

function addMaintenance({filterUsed, type, date}){
  const record = { id: nextId('MNT','maint'), date: date || todayISO(), filterUsed, type };
  state.maintenance.push(record);
  lastMaintenanceByType[type] = record.date;
  if(type === 'Backwash') lastBackwashDate = record.date;

  const item = linearSearch(state.inventory, i => i.itemName.toLowerCase() === filterUsed.toLowerCase());
  let effect;
  if(item){
    stockOut(item.id, 1);
    effect = `−1 ${item.unit} from ${item.id}`;
  } else {
    effect = 'Not tracked in Inventory';
  }
  return { record, effect };
}

function renderMaintenance(){
  const tbody = document.querySelector('#tbl-maintenance tbody');
  tbody.innerHTML = state.maintenance.length ? state.maintenance.slice().reverse().map(m => `
    <tr><td>${m.id}</td><td>${fmtDate(m.date)}</td><td>${escapeHtml(m.filterUsed)}</td><td>${m.type}</td>
    <td>${m._effect || '—'}</td></tr>
  `).join('') : emptyRow(5,'No maintenance logged yet.');
}

function uiAddMaintenance(e){
  e.preventDefault();
  const filterUsed = val('mt-filter'), type = val('mt-type'), date = val('mt-date') || todayISO();
  const { record, effect } = addMaintenance({filterUsed, type, date});
  record._effect = effect;
  setMsg('mt-msg', `Logged. Inventory effect: ${effect}`, true);
  e.target.reset();
  renderMaintenance();
  renderInventory();
  renderAlerts();
  return false;
}

/* =========================================================================
   7. INVENTORY MANAGEMENT
   ========================================================================= */
function totalQty(item){ return item.batches.reduce((s,b)=>s+b.qty,0); }

function addInventoryItem({itemName, itemType, quantity, unit, dateReceived, expirationDate, minStock}){
  const item = {
    id: nextId('INV','inv'), itemName, itemType: itemType || 'General', unit, minStock: Number(minStock)||0,
    batches: [{ qty:Number(quantity)||0, dateReceived: dateReceived || todayISO(), expirationDate: expirationDate || null }]
  };
  state.inventory.push(item);
  return item;
}

function receiveIntoInventory({itemName, unit, quantity, dateReceived}){
  let item = linearSearch(state.inventory, i => i.itemName.toLowerCase() === itemName.toLowerCase());
  if(item){
    item.batches.push({ qty:Number(quantity), dateReceived: dateReceived || todayISO(), expirationDate:null });
  } else {
    item = addInventoryItem({ itemName, itemType:'General', quantity, unit, dateReceived, expirationDate:null, minStock:5 });
  }
  return item;
}

function stockOut(itemId, qtyToRemove){
  const item = linearSearch(state.inventory, i => i.id === itemId);
  if(!item) return { ok:false, message:'Item not found.' };
  let remaining = Number(qtyToRemove);
  if(remaining > totalQty(item)) return { ok:false, message:'Not enough stock on hand.' };
  item.batches.sort((a,b) => new Date(a.dateReceived) - new Date(b.dateReceived));
  for(const batch of item.batches){
    if(remaining <= 0) break;
    const take = Math.min(batch.qty, remaining);
    batch.qty -= take;
    remaining -= take;
  }
  item.batches = item.batches.filter(b => b.qty > 0);
  return { ok:true };
}

function inventoryStatus(item){
  const q = totalQty(item);
  if(q <= 0) return { label:'Out of Stock' };
  if(q <= item.minStock) return { label:'Low Stock' };
  return { label:'In Stock' };
}

function renderInventory(){
  const tbody = document.querySelector('#tbl-inventory tbody');
  tbody.innerHTML = state.inventory.length ? state.inventory.map(i => {
    const s = inventoryStatus(i);
    return `<tr><td>${i.id}</td><td>${escapeHtml(i.itemName)}</td><td>${escapeHtml(i.itemType)}</td>
      <td>${totalQty(i)}</td><td>${escapeHtml(i.unit)}</td><td>${i.minStock}</td>
      <td>${s.label}</td></tr>`;
  }).join('') : emptyRow(7,'No inventory items yet.');
}

function uiAddInventoryItem(e){
  e.preventDefault();
  const item = addInventoryItem({
    itemName: val('inv-name'), itemType: val('inv-type'), quantity: val('inv-qty'), unit: val('inv-unit'),
    dateReceived: val('inv-received'), expirationDate: val('inv-expiry'), minStock: val('inv-min')
  });
  setMsg('inv-msg', `Item ${item.id} added.`, true);
  e.target.reset();
  renderInventory();
  renderAlerts();
  return false;
}

function uiStockOut(e){
  e.preventDefault();
  const res = stockOut(val('stock-item-id').trim(), parseInt(val('stock-qty'),10));
  if(res.ok){ setMsg('stock-msg','Stock updated (FIFO).', true); e.target.reset(); renderInventory(); renderAlerts(); }
  else setMsg('stock-msg', res.message, false);
  return false;
}

/* =========================================================================
   8. INVENTORY RECEIVING MANAGEMENT
   ========================================================================= */
function addReceiving({supplierName, itemName, quantity, unit, expectedDate, actualDate}){
  const record = {
    id: nextId('RCV','recv'), supplierName, itemName, quantity:Number(quantity), unit,
    expectedDate, actualDate, status:'Pending'
  };
  state.receiving.push(record);
  return record;
}

function verifyReceiving(id){
  const rec = linearSearch(state.receiving, r => r.id === id);
  if(!rec || rec.status === 'Verified') return;
  rec.status = 'Verified';
  receiveIntoInventory({ itemName: rec.itemName, unit: rec.unit, quantity: rec.quantity, dateReceived: rec.actualDate || todayISO() });
  toast(`${rec.id} verified — added to Inventory.`);
  renderReceiving();
  renderInventory();
  renderAlerts();
}

function renderReceiving(){
  const tbody = document.querySelector('#tbl-receiving tbody');
  tbody.innerHTML = state.receiving.length ? state.receiving.slice().reverse().map(r => `
    <tr><td>${r.id}</td><td>${escapeHtml(r.supplierName)}</td><td>${escapeHtml(r.itemName)}</td><td>${r.quantity}</td>
    <td>${escapeHtml(r.unit)}</td><td>${fmtDate(r.expectedDate)}</td><td>${fmtDate(r.actualDate)}</td>
    <td>${r.status}</td>
    <td>${r.status==='Verified' ? '' : `<button class="btn-primary" style="width:auto; padding:4px 8px;" onclick="verifyReceiving('${r.id}')">Verify</button>`}</td></tr>
  `).join('') : emptyRow(9,'No receiving records yet.');
}

function uiAddReceiving(e){
  e.preventDefault();
  addReceiving({
    supplierName: val('rc-supplier'), itemName: val('rc-item'), quantity: val('rc-qty'), unit: val('rc-unit'),
    expectedDate: val('rc-expected'), actualDate: val('rc-actual')
  });
  toast('Receiving record logged.');
  e.target.reset();
  renderReceiving();
  return false;
}

/* =========================================================================
   9. INVENTORY REPLENISHMENT & ALERTS
   ========================================================================= */
function computeAlerts(){
  const alerts = [];

  state.inventory.forEach(i => {
    const s = inventoryStatus(i);
    if(s.label !== 'In Stock'){
      alerts.push({ type: s.label, item: `${i.itemName} (${i.id})`, date: todayISO(), status: s.label,
        action: s.label === 'Out of Stock' ? 'Reorder immediately' : 'Schedule reorder' });
    }
  });

  state.deliveries.filter(d => d.status === 'Pending').forEach(d => {
    alerts.push({ type:'Undelivered Order', item: `${d.customerName} (${d.id})`, date: d.dateAdded, status:'Pending',
      action: 'Dispatch delivery' });
  });

  Object.entries(lastMaintenanceByType).forEach(([type, date]) => {
    const days = daysBetween(date, todayISO());
    if(days >= MAINTENANCE_INTERVAL_DAYS){
      alerts.push({ type:'Maintenance Due', item: `${type} filter`, date, status:`${days}d since last service`,
        action:'Schedule filter change' });
    }
  });

  if(lastBackwashDate === null || daysBetween(lastBackwashDate, todayISO()) >= BACKWASH_INTERVAL_DAYS){
    alerts.push({ type:'Backwash Due', item:'Purification system', date: lastBackwashDate || '—',
      status: lastBackwashDate ? `${daysBetween(lastBackwashDate, todayISO())}d since last backwash` : 'Never logged',
      action:'Perform backwash' });
  }

  return alerts;
}

function renderAlerts(){
  const alerts = computeAlerts();
  const tbody = document.querySelector('#tbl-alerts tbody');
  tbody.innerHTML = alerts.length ? alerts.map(a => `
    <tr><td>${a.type}</td><td>${escapeHtml(a.item)}</td>
    <td>${fmtDate(a.date)}</td><td>${escapeHtml(a.status)}</td><td>${escapeHtml(a.action)}</td></tr>
  `).join('') : emptyRow(5,'Nothing needs attention right now.');

  document.getElementById('alert-count-stock').textContent = alerts.filter(a => a.type==='Low Stock'||a.type==='Out of Stock').length;
  document.getElementById('alert-count-delivery').textContent = alerts.filter(a => a.type==='Undelivered Order').length;
  document.getElementById('alert-count-maint').textContent = alerts.filter(a => a.type==='Maintenance Due'||a.type==='Backwash Due').length;
}

/* =========================================================================
   10. EMPLOYEE MANAGEMENT
   ========================================================================= */
function saveEmployee(data, editId){
  if(editId){
    const emp = linearSearch(state.employees, e => e.id === editId);
    if(emp) Object.assign(emp, data);
    return emp;
  }
  const emp = { id: nextId('EMP','emp'), ...data };
  state.employees.push(emp);
  return emp;
}

function deleteEmployee(id){
  const idx = state.employees.findIndex(e => e.id === id);
  if(idx > -1) state.employees.splice(idx,1);
  renderEmployees();
}

function renderEmployees(){
  const q = (document.getElementById('emp-search')?.value || '').toLowerCase();
  const rows = state.employees.filter(e => !q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
  const tbody = document.querySelector('#tbl-employees tbody');
  tbody.innerHTML = rows.length ? rows.map(e => `
    <tr><td>${e.id}</td><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.contact)}</td><td>${escapeHtml(e.role)}</td>
    <td>${fmtMoney(e.salary)}</td>
    <td>
      <button class="btn-primary" style="width:auto; padding:4px 8px;" onclick="editEmployee('${e.id}')">Edit</button>
      <button class="btn-logout" style="width:auto; padding:4px 8px;" onclick="deleteEmployee('${e.id}')">Delete</button>
    </td></tr>
  `).join('') : emptyRow(6,'No employee records yet.');
}

function editEmployee(id){
  const emp = linearSearch(state.employees, e => e.id === id);
  if(!emp) return;
  document.getElementById('emp-edit-id').value = emp.id;
  document.getElementById('emp-name').value = emp.name;
  document.getElementById('emp-contact').value = emp.contact;
  document.getElementById('emp-role').value = emp.role;
  document.getElementById('emp-salary').value = emp.salary;
  document.getElementById('emp-form-title').textContent = `Editing ${emp.id}`;
  document.getElementById('emp-submit-btn').textContent = 'Save changes';
  document.getElementById('emp-cancel-btn').style.display = 'inline-block';
}

function cancelEmployeeEdit(){
  document.getElementById('emp-edit-id').value = '';
  document.querySelector('#sec-employees form').reset();
  document.getElementById('emp-form-title').textContent = 'Add an employee';
  document.getElementById('emp-submit-btn').textContent = 'Add employee';
  document.getElementById('emp-cancel-btn').style.display = 'none';
}

function uiSaveEmployee(e){
  e.preventDefault();
  const editId = val('emp-edit-id');
  saveEmployee({ name: val('emp-name'), contact: val('emp-contact'), role: val('emp-role'), salary: parseFloat(val('emp-salary')) }, editId || null);
  toast(editId ? 'Employee record updated.' : 'Employee added.');
  cancelEmployeeEdit();
  renderEmployees();
  return false;
}

/* =========================================================================
   11. SUPPLIER MANAGEMENT
   ========================================================================= */
function saveSupplier(data, editId){
  if(editId){
    const sup = linearSearch(state.suppliers, s => s.id === editId);
    if(sup) Object.assign(sup, data);
    return sup;
  }
  const sup = { id: nextId('SUP','sup'), ...data };
  state.suppliers.push(sup);
  return sup;
}

function deleteSupplier(id){
  const idx = state.suppliers.findIndex(s => s.id === id);
  if(idx > -1) state.suppliers.splice(idx,1);
  renderSuppliers();
}

function renderSuppliers(){
  const q = (document.getElementById('sup-search')?.value || '').toLowerCase();
  const rows = state.suppliers.filter(s => !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  const tbody = document.querySelector('#tbl-suppliers tbody');
  tbody.innerHTML = rows.length ? rows.map(s => `
    <tr><td>${s.id}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.contact)}</td><td>${escapeHtml(s.products)}</td>
    <td>${s.quantity ?? '—'}</td><td>${fmtDate(s.orderDate)}</td><td>${s.cost ? fmtMoney(s.cost) : '—'}</td>
    <td>
      <button class="btn-primary" style="width:auto; padding:4px 8px;" onclick="editSupplier('${s.id}')">Edit</button>
      <button class="btn-logout" style="width:auto; padding:4px 8px;" onclick="deleteSupplier('${s.id}')">Delete</button>
    </td></tr>
  `).join('') : emptyRow(8,'No supplier records yet.');
}

function editSupplier(id){
  const sup = linearSearch(state.suppliers, s => s.id === id);
  if(!sup) return;
  document.getElementById('sup-edit-id').value = sup.id;
  document.getElementById('sup-name').value = sup.name;
  document.getElementById('sup-contact').value = sup.contact;
  document.getElementById('sup-address').value = sup.address || '';
  document.getElementById('sup-products').value = sup.products;
  document.getElementById('sup-qty').value = sup.quantity || '';
  document.getElementById('sup-orderdate').value = sup.orderDate || '';
  document.getElementById('sup-cost').value = sup.cost || '';
  document.getElementById('sup-form-title').textContent = `Editing ${sup.id}`;
  document.getElementById('sup-submit-btn').textContent = 'Save changes';
  document.getElementById('sup-cancel-btn').style.display = 'inline-block';
}

function cancelSupplierEdit(){
  document.getElementById('sup-edit-id').value = '';
  document.querySelector('#sec-suppliers form').reset();
  document.getElementById('sup-form-title').textContent = 'Add a supplier';
  document.getElementById('sup-submit-btn').textContent = 'Add supplier';
  document.getElementById('sup-cancel-btn').style.display = 'none';
}

function uiSaveSupplier(e){
  e.preventDefault();
  const editId = val('sup-edit-id');
  saveSupplier({
    name: val('sup-name'), contact: val('sup-contact'), address: val('sup-address'), products: val('sup-products'),
    quantity: val('sup-qty') ? Number(val('sup-qty')) : null, orderDate: val('sup-orderdate') || null,
    cost: val('sup-cost') ? Number(val('sup-cost')) : null
  }, editId || null);
  toast(editId ? 'Supplier record updated.' : 'Supplier added.');
  cancelSupplierEdit();
  renderSuppliers();
  return false;
}

/* =========================================================================
   12. REPORTS
   ========================================================================= */
function populateReportMonths(){
  const sel = document.getElementById('rep-month');
  if(!sel) return;
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  sel.innerHTML = names.map((n,i) => `<option value="${i}">${n}</option>`).join('');
  const now = new Date();
  sel.value = now.getMonth();
  document.getElementById('rep-year').value = now.getFullYear();
}

function renderReport(){
  const month = parseInt(val('rep-month'),10), year = parseInt(val('rep-year'),10);
  const inRange = (dateStr) => { const d = new Date(dateStr); return d.getMonth()===month && d.getFullYear()===year; };

  const txs = state.transactions.filter(t => inRange(t.date));
  const bills = state.bills.filter(b => inRange(b.datePaid));
  const deliveredThisMonth = txs.filter(t => t.source === 'Delivery').length;

  const sales = txs.reduce((s,t)=>s+t.orderTotal,0);
  const expenses = bills.reduce((s,b)=>s+b.amount,0);

  document.getElementById('rep-orders').textContent = txs.length;
  document.getElementById('rep-sales').textContent = fmtMoney(sales);
  document.getElementById('rep-expenses').textContent = fmtMoney(expenses);
  document.getElementById('rep-profit').textContent = fmtMoney(sales - expenses);
  document.getElementById('rep-employees').textContent = state.employees.length;
  document.getElementById('rep-lowstock').textContent = state.inventory.filter(i => inventoryStatus(i).label !== 'In Stock').length;
  document.getElementById('rep-deliveries').textContent = deliveredThisMonth;

  const tbody = document.querySelector('#tbl-report-tx tbody');
  tbody.innerHTML = txs.length ? txs.map(t => `
    <tr><td>${fmtDate(t.date)}</td><td>${escapeHtml(t.customerName)}</td><td>${t.quantity}</td>
    <td>${fmtMoney(t.orderTotal)}</td><td>${t.employeeId}</td></tr>
  `).join('') : emptyRow(5,'No transactions in this period.');
}

/* ---------------------------------------------------------------------
   DOM Utilities
   --------------------------------------------------------------------- */
function val(id){ return document.getElementById(id).value.trim(); }
function emptyRow(colspan, text){ return `<tr><td colspan="${colspan}">${text}</td></tr>`; }
function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderAll(){
  renderUsers(); renderTransactions(); renderSales(); renderBills(); renderDelivery();
  renderMaintenance(); renderInventory(); renderReceiving(); renderAlerts();
  renderEmployees(); renderSuppliers(); renderReport();
}

/* ---------------------------------------------------------------------
   Auth wiring
   --------------------------------------------------------------------- */
function switchAuthTab(tab){
  document.getElementById('login-form-wrap').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('register-form-wrap').style.display = tab === 'register' ? '' : 'none';
}

function handleLogin(e){
  e.preventDefault();
  const res = loginUser(val('login-username'), val('login-password'));
  const errEl = document.getElementById('login-error');
  if(!res.ok){ errEl.textContent = res.message; errEl.hidden = false; return false; }
  errEl.hidden = true;
  enterApp(res.user);
  return false;
}

function handleRegister(e){
  e.preventDefault();
  const res = registerUser({ fullName: val('reg-fullname'), username: val('reg-username'), password: val('reg-password'), role: val('reg-role') });
  const errEl = document.getElementById('register-error'), okEl = document.getElementById('register-success');
  if(!res.ok){ errEl.textContent = res.message; errEl.hidden = false; okEl.hidden = true; return false; }
  errEl.hidden = true; okEl.hidden = false;
  okEl.textContent = `Account ${res.user.id} created. You can log in now.`;
  e.target.reset();
  setTimeout(() => switchAuthTab('login'), 900);
  return false;
}

function handleLogout(){
  state.currentUser = null;
  document.getElementById('app-layout').style.display = 'none';
  document.getElementById('auth-wrapper').style.display = 'block';

  NAV_ITEMS.forEach(item => {
    const sec = document.getElementById('sec-' + item.id);
    if (sec) sec.style.display = 'none';
  });

  document.getElementById('section-title').textContent = '';
  document.getElementById('login-form-wrap').style.display = '';
  document.getElementById('login-form').reset();
}

/* ---------------------------------------------------------------------
   Navigation / menu
   --------------------------------------------------------------------- */
const NAV_ITEMS = [
  { id:'transactions', label:'Transactions', group:'Operations' },
  { id:'delivery', label:'Delivery', group:'Operations' },
  { id:'maintenance', label:'Equipment Maintenance', group:'Operations' },
  { id:'inventory', label:'Inventory', group:'Operations' },
  { id:'receiving', label:'Inventory Receiving', group:'Operations' },
  { id:'alerts', label:'Alerts', group:'Operations', adminOnly:true },
  { id:'sales', label:'Sales & Profit', group:'Management', adminOnly:true },
  { id:'bills', label:'Bills & Tax', group:'Management', adminOnly:true },
  { id:'employees', label:'Employees', group:'Management', adminOnly:true },
  { id:'suppliers', label:'Suppliers', group:'Management', adminOnly:true },
  { id:'reports', label:'Reports', group:'Management', adminOnly:true },
  { id:'users', label:'User Accounts', group:'Management', adminOnly:true },
];

function buildNav(role){
  const nav = document.getElementById('sidebar-nav');
  let html = '';
  let currentGroup = null;
  NAV_ITEMS.filter(item => !item.adminOnly || role === 'Admin').forEach(item => {
    if(item.group !== currentGroup){
      html += `<li style="padding:10px 16px 4px; font-size:0.75rem; text-transform:uppercase; color:rgba(255,255,255,0.5); font-weight:bold;">${item.group}</li>`;
      currentGroup = item.group;
    }
    html += `<li><button id="nav-btn-${item.id}" data-section="${item.id}" onclick="showSection('${item.id}')">${item.label}</button></li>`;
  });
  nav.innerHTML = html;
}

function showSection(id){
  NAV_ITEMS.forEach(item => {
    const sec = document.getElementById('sec-' + item.id);
    const navBtn = document.getElementById('nav-btn-' + item.id);
    if (sec) {
      sec.style.display = (item.id === id) ? '' : 'none';
    }
    if (navBtn) {
      if (item.id === id) navBtn.classList.add('active');
      else navBtn.classList.remove('active');
    }
  });

  const item = NAV_ITEMS.find(n => n.id === id);
  document.getElementById('section-title').textContent = item ? item.label : '';
  if(id === 'reports') renderReport();
  if(id === 'alerts') renderAlerts();
}

function enterApp(user){
  state.currentUser = user;
  document.getElementById('auth-wrapper').style.display = 'none';
  document.getElementById('app-layout').style.display = 'flex';

  document.getElementById('user-name').textContent = user.fullName;
  document.getElementById('user-role-badge').textContent = user.role;
  buildNav(user.role);
  showSection('transactions');
  renderAll();
}

/* ---------------------------------------------------------------------
   Init
   --------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  populateReportMonths();
  const mtDate = document.getElementById('mt-date');
  if(mtDate) mtDate.value = todayISO();
  const billDate = document.getElementById('bill-date');
  if(billDate) billDate.value = todayISO();
});