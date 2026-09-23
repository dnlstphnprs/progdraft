const PRICE_PER_GALLON = 25; 

const state = {
  users: [],
  customers: [],     // Customer Hub (Profiles, Credit/Utang, Containers, Loyalty)
  transactions: [],
  bills: [],
  pettyCash: [],     // Petty cash outlays and daily expenses
  deliveries: [],
  maintenance: [],
  inventory: [],   
  receiving: [],
  employees: [],     // Merged entities (Employees, Suppliers, or Both)
  suppliers: [],
  counters: { user:0, cust:0, tx:0, bill:0, pc:0, delivery:0, maint:0, inv:0, recv:0, emp:0, sup:0 },
  currentUser: null,
};

function nextId(prefix, key){
  state.counters[key] += 1;
  return `${prefix}-${String(state.counters[key]).padStart(3,'0')}`;
}

function getCurrentDate(){
  return new Date().toISOString().slice(0,10);
}
function todayISO(){ return getCurrentDate(); }

function fmtMoney(n){ return '₱' + (Number(n)||0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtDate(d){ if(!d) return '—'; const dt = new Date(d); if(isNaN(dt)) return d; return dt.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}); }
function daysBetween(a,b){ return Math.floor((new Date(b) - new Date(a)) / 86400000); }

function linearSearch(arr, predicate){
  for(let i=0; i<arr.length; i++){ 
    if(predicate(arr[i])) return arr[i]; 
  }
  return null;
}

function bubbleSort(arr, compareFn){
  let n = arr.length;
  for(let i = 0; i < n - 1; i++){
    for(let j = 0; j < n - i - 1; j++){
      if(compareFn(arr[j], arr[j+1]) > 0){
        let temp = arr[j];
        arr[j] = arr[j+1];
        arr[j+1] = temp;
      }
    }
  }
  return arr;
}

function manualPush(arr, item){
  arr[arr.length] = item;
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
  manualPush(state.users, { id: nextId('U','user'), fullName:'System Administrator', username:'admin', password:'admin123', role:'Admin' });
}
seed();

/* =========================================================================
   CUSTOMER HUB (Utang, Containers, Loyalty & Auto-Fill)
   ========================================================================= */
function addCustomer(name, contact, address){
  let customer = findCustomerByName(name);
  if(customer){
    if(contact) customer.contact = contact;
    if(address) customer.address = address;
    return customer;
  }
  customer = {
    id: nextId('CUST','cust'),
    name: name,
    contact: contact || '',
    address: address || '',
    creditBalance: 0.00,
    borrowedSlim: 0,
    borrowedRound: 0,
    loyaltyPoints: 0,
    freeGallonsAvailable: 0
  };
  manualPush(state.customers, customer);
  return customer;
}

function findCustomerByName(name){
  if(!name) return null;
  return linearSearch(state.customers, c => c.name.toLowerCase() === name.toLowerCase().trim());
}

function suggestAndFillCustomerData(inputName){
  const matches = [];
  const q = inputName.toLowerCase().trim();
  if(!q) return matches;

  for(let i=0; i<state.customers.length; i++){
    let c = state.customers[i];
    // Changed .includes(q) to .startsWith(q)
    if(c.name.toLowerCase().startsWith(q)){
      manualPush(matches, c);
    }
  }
  return matches;
}

function renderCustomers(){
  const tbody = document.querySelector('#tbl-customers tbody');
  if(!tbody) return;
  tbody.innerHTML = state.customers.length ? state.customers.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.contact || '—')}</td>
      <td>${escapeHtml(c.address || '—')}</td>
      <td><strong style="color:${c.creditBalance > 0 ? '#dc2626' : '#16a34a'};">${fmtMoney(c.creditBalance)}</strong></td>
      <td>${c.borrowedSlim}</td>
      <td>${c.borrowedRound}</td>
      <td>${c.loyaltyPoints}/5</td>
      <td><span class="badge ${c.freeGallonsAvailable > 0 ? 'paid' : 'unconfirmed'}">${c.freeGallonsAvailable} Free</span></td>
    </tr>
  `).join('') : emptyRow(9, 'No customer profiles on record yet.');
}

function uiAddCustomer(e){
  e.preventDefault();
  const c = addCustomer(val('cust-name'), val('cust-contact'), val('cust-address'));
  setMsg('cust-msg', `Customer profile saved for ${c.name}.`, true);
  e.target.reset();
  renderCustomers();
  return false;
}

/* =========================================================================
   USER ACCOUNTS MANAGEMENT
   ========================================================================= */
function populateUserEmployees(){
  const sel = document.getElementById('um-employee');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Select Linked Employee --</option>';
  for(let i=0; i<state.employees.length; i++){
    let emp = state.employees[i];
    sel.innerHTML += `<option value="${emp.id}">${escapeHtml(emp.name)} (${emp.id})</option>`;
  }
}

function registerUser({fullName, username, password, role, employeeId}){
  const exists = linearSearch(state.users, u => u.username.toLowerCase() === username.toLowerCase());
  if(exists) return { ok:false, message:'That username is already taken.' };
  const user = { id: nextId('U','user'), fullName, username, password, role, employeeId: employeeId || 'N/A' };
  manualPush(state.users, user);
  return { ok:true, user };
}

function loginUser(username, password){
  const user = linearSearch(state.users, u => u.username.toLowerCase() === username.toLowerCase());
  if(!user) return { ok:false, message:'No account with that username.' };
  if(user.password !== password) return { ok:false, message:'Incorrect password.' };
  return { ok:true, user };
}

function deleteUser(userId){
  let idx = -1;
  for(let i=0; i<state.users.length; i++){
    if(state.users[i].id.toLowerCase() === userId.toLowerCase()){
      idx = i;
      break;
    }
  }
  if(idx === -1) return { ok:false, message:'No account with that User ID.' };
  if(state.users[idx].id === state.currentUser?.id) return { ok:false, message:"You can't delete the account you're logged in as." };
  state.users.splice(idx,1);
  return { ok:true };
}

function renderUsers(){
  populateUserEmployees();
  const tbody = document.querySelector('#tbl-users tbody');
  if(!tbody) return;
  tbody.innerHTML = state.users.length ? state.users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${escapeHtml(u.fullName)}</td>
      <td>${escapeHtml(u.username)}</td>
      <td>${u.role}</td>
      <td>${u.employeeId}</td>
      <td>
        <button class="btn-logout" style="width:auto; padding:4px 8px;" onclick="uiDeleteUserDirect('${u.id}')">Delete</button>
      </td>
    </tr>
  `).join('') : emptyRow(6,'No accounts yet.');
}

function uiRegisterUser(e){
  e.preventDefault();
  const fullName = val('um-fullname'), username = val('um-username'), password = val('um-password'), role = val('um-role'), employeeId = val('um-employee');
  const res = registerUser({fullName, username, password, role, employeeId});
  if(res.ok){
    setMsg('um-msg', `Account ${res.user.id} created for ${res.user.fullName}.`, true);
    e.target.reset();
    renderUsers();
  } else setMsg('um-msg', res.message, false);
  return false;
}

function uiDeleteUserDirect(id){
  const res = deleteUser(id);
  if(res.ok){ toast('Account deleted.'); renderUsers(); }
  else toast(res.message);
}

/* =========================================================================
   TRANSACTION MANAGEMENT
   ========================================================================= */
function autoComputeTxPrice(){
  const qty = parseFloat(val('tx-qty')) || 0;
  const redeem = document.getElementById('tx-redeem-loyalty')?.checked;
  let payable = qty;
  if(redeem && payable > 0) payable -= 1;
  document.getElementById('tx-total').value = (payable * PRICE_PER_GALLON).toFixed(2);
}

function handleCustomerInput(valStr){
  const sugBox = document.getElementById('tx-customer-suggestions');
  if(!sugBox) return;
  const matches = suggestAndFillCustomerData(valStr);
  if(!matches.length){
    sugBox.innerHTML = '';
    return;
  }
  sugBox.innerHTML = matches.map(m => `
    <div class="autocomplete-suggestion" onclick="selectTxCustomer('${escapeHtml(m.name)}')">
      <strong>${escapeHtml(m.name)}</strong> (${m.contact || 'No Contact'}) — Debt: ${fmtMoney(cBalance(m))}
    </div>
  `).join('');
}

function cBalance(c){ return c ? c.creditBalance : 0; }

function selectTxCustomer(name){
  document.getElementById('tx-customer').value = name;
  document.getElementById('tx-customer-suggestions').innerHTML = '';
}

function addTransaction({customerName, quantity, orderTotal, payment, employeeId, source, status, slimBorrowed, roundBorrowed, isRedeemingLoyalty}){
  let customer = findCustomerByName(customerName);
  if(!customer){
    customer = addCustomer(customerName, "", "");
  }

  let payableQty = Number(quantity);
  if(isRedeemingLoyalty && customer.freeGallonsAvailable > 0){
    payableQty = Math.max(0, payableQty - 1);
    customer.freeGallonsAvailable -= 1;
  }

  const finalTotal = orderTotal !== undefined ? Number(orderTotal) : (payableQty * PRICE_PER_GALLON);
  const isPaid = status === 'Paid' || payment >= finalTotal;
  const change = isPaid ? +(payment - finalTotal).toFixed(2) : 0;

  const record = {
    id: nextId('TXN','tx'), 
    date: todayISO(), 
    datePaid: isPaid ? todayISO() : null,
    customerName, 
    quantity: Number(quantity),
    orderTotal: finalTotal, 
    payment: Number(payment), 
    change, 
    employeeId,
    source: source || 'Walk-in',
    status: isPaid ? 'Paid' : 'Unpaid'
  };

  manualPush(state.transactions, record);

  if(!isPaid){
    customer.creditBalance += finalTotal;
  }

  customer.borrowedSlim += (Number(slimBorrowed) || 0);
  customer.borrowedRound += (Number(roundBorrowed) || 0);

  updateCustomerLoyalty(customer, Number(quantity));

  return record;
}

function markTransactionAsPaid(txnId){
  const t = linearSearch(state.transactions, t => t.id === txnId);
  if(!t) return;

  if(t.status === 'Paid'){
    alert("Transaction is already marked as Paid.");
    return;
  }

  const paymentDate = prompt("Enter the date when the customer paid (YYYY-MM-DD):", getCurrentDate());
  if(paymentDate !== null && paymentDate !== ""){
    t.status = 'Paid';
    t.datePaid = paymentDate;
    t.payment = t.orderTotal;
    t.change = 0;

    const customer = findCustomerByName(t.customerName);
    if(customer && customer.creditBalance > 0){
      customer.creditBalance -= t.orderTotal;
      if(customer.creditBalance < 0) customer.creditBalance = 0;
    }

    toast(`Transaction ${t.id} marked as Paid on ${paymentDate}.`);
    renderTransactions();
    renderCustomers();
    renderSales();
  }
}

function renderTransactions(){
  const tbody = document.querySelector('#tbl-transactions tbody');
  if(!tbody) return;
  tbody.innerHTML = state.transactions.length ? state.transactions.slice().reverse().map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${fmtDate(t.datePaid || t.date)}</td>
      <td>${escapeHtml(t.customerName)}</td>
      <td>${t.quantity}</td>
      <td>${fmtMoney(t.orderTotal)}</td>
      <td>${fmtMoney(t.payment)}</td>
      <td>${fmtMoney(t.change)}</td>
      <td>${t.employeeId}</td>
      <td>${t.source}</td>
      <td><span class="badge ${t.status === 'Paid' ? 'paid' : 'unpaid'}">${t.status}</span></td>
      <td>
        ${t.status === 'Unpaid' ? `<button class="btn-primary" style="width:auto; padding:4px 8px; background:#10b981;" onclick="markTransactionAsPaid('${t.id}')">Mark Paid</button>` : '—'}
      </td>
    </tr>
  `).join('') : emptyRow(11,'No transactions recorded yet.');
  renderSales();
}

function uiAddTransaction(e){
  e.preventDefault();
  const customerName = val('tx-customer');
  const quantity = val('tx-qty');
  const orderTotal = parseFloat(val('tx-total'));
  const payment = parseFloat(val('tx-payment'));
  const slimBorrowed = parseInt(val('tx-slim-borrowed')) || 0;
  const roundBorrowed = parseInt(val('tx-round-borrowed')) || 0;
  const isRedeemingLoyalty = document.getElementById('tx-redeem-loyalty')?.checked;

  const isPaid = payment >= orderTotal;

  addTransaction({
    customerName, 
    quantity, 
    orderTotal, 
    payment, 
    employeeId: state.currentUser ? state.currentUser.id : 'N/A', 
    source: 'Walk-in', 
    status: isPaid ? 'Paid' : 'Unpaid',
    slimBorrowed,
    roundBorrowed,
    isRedeemingLoyalty
  });

  setMsg('tx-msg','Transaction recorded.', true);
  e.target.reset();
  renderTransactions();
  renderCustomers();
  return false;
}

/* =========================================================================
   SALES & PROFIT MANAGEMENT
   ========================================================================= */
function calculateFinancialSummary(){
  let totalRevenue = 0.00;
  let totalPettyCash = 0.00;
  let totalBills = 0.00;

  for(let i=0; i<state.transactions.length; i++){
    if(state.transactions[i].status === 'Paid'){
      totalRevenue += state.transactions[i].orderTotal;
    }
  }

  for(let j=0; j<state.pettyCash.length; j++){
    totalPettyCash += state.pettyCash[j].amount;
  }

  for(let k=0; k<state.bills.length; k++){
    totalBills += state.bills[k].amount;
  }

  const totalExpenses = totalPettyCash + totalBills;
  const netProfit = totalRevenue - totalExpenses;

  return {
    totalRevenue,
    totalPettyCash,
    totalBills,
    totalExpenses,
    netProfit
  };
}

function renderSales(){
  const from = val('sales-from'), to = val('sales-to');
  let filteredTx = state.transactions;
  let filteredBills = state.bills;
  let filteredPetty = state.pettyCash;

  if(from && to){
    filteredTx = [];
    for(let i=0; i<state.transactions.length; i++){
      let t = state.transactions[i];
      let tDate = t.datePaid || t.date;
      if(tDate >= from && tDate <= to) manualPush(filteredTx, t);
    }
    filteredBills = [];
    for(let i=0; i<state.bills.length; i++){
      let b = state.bills[i];
      if(b.datePaid >= from && b.datePaid <= to) manualPush(filteredBills, b);
    }
    filteredPetty = [];
    for(let i=0; i<state.pettyCash.length; i++){
      let p = state.pettyCash[i];
      if(p.date >= from && p.date <= to) manualPush(filteredPetty, p);
    }
  }

  let totalSales = 0;
  let onHandCash = 0;
  for(let i=0; i<filteredTx.length; i++){
    totalSales += filteredTx[i].orderTotal;
    if(filteredTx[i].status === 'Paid'){
      onHandCash += filteredTx[i].orderTotal;
    }
  }

  let totalExpenses = 0;
  for(let i=0; i<filteredBills.length; i++){
    totalExpenses += filteredBills[i].amount;
  }
  for(let i=0; i<filteredPetty.length; i++){
    totalExpenses += filteredPetty[i].amount;
  }

  document.getElementById('stat-sales').textContent = fmtMoney(totalSales);
  document.getElementById('stat-onhand').textContent = fmtMoney(onHandCash);
  document.getElementById('stat-expenses').textContent = fmtMoney(totalExpenses);
  document.getElementById('stat-profit').textContent = fmtMoney(onHandCash - totalExpenses);
}

/* =========================================================================
   BILLS, TAXES, AND PETTY CASH EXPENSES
   ========================================================================= */
function addPettyCashExpense(purpose, amount, disbursedBy, dateStr){
  const expense = {
    id: nextId('PC','pc'),
    date: dateStr || getCurrentDate(),
    purpose: purpose,
    amount: Number(amount),
    disbursedBy: disbursedBy || (state.currentUser ? state.currentUser.fullName : 'System')
  };
  manualPush(state.pettyCash, expense);
  return expense;
}

function renderPettyCash(){
  const tbody = document.querySelector('#tbl-petty-cash tbody');
  if(!tbody) return;
  tbody.innerHTML = state.pettyCash.length ? state.pettyCash.slice().reverse().map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${fmtDate(p.date)}</td>
      <td>${escapeHtml(p.purpose)}</td>
      <td>${escapeHtml(p.disbursedBy)}</td>
      <td>${fmtMoney(p.amount)}</td>
    </tr>
  `).join('') : emptyRow(5, 'No petty cash expenses logged.');
}

function populateEmployeeSalaryOptions(){
  const sel = document.getElementById('exp-emp');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Select Employee --</option>';
  for(let i=0; i<state.employees.length; i++){
    let emp = state.employees[i];
    if(emp.entityType === 'EMPLOYEE' || emp.entityType === 'BOTH'){
      sel.innerHTML += `<option value="${emp.id}" data-salary="${emp.salary}">${escapeHtml(emp.name)} (Base Salary: ${fmtMoney(emp.salary)})</option>`;
    }
  }
}

function populateBillsMonths(){
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const sel = document.getElementById('bills-month');
  if(!sel) return;
  
  sel.innerHTML = '<option value="">All Months</option>' + 
    names.map((n, i) => `<option value="${i}">${n}</option>`).join('');
    
  const now = new Date();
  const yearInput = document.getElementById('bills-year');
  if(yearInput) yearInput.value = now.getFullYear();
}

function resetBillsFilter(){
  document.getElementById('bills-month').value = '';
  document.getElementById('bills-year').value = '';
  renderBills();
}

function addBill({datePaid, billType, amount}){
  const record = { id: nextId('BILL','bill'), datePaid, billType, amount: Number(amount) };
  manualPush(state.bills, record);
  return record;
}

function renderBills(){
  populateEmployeeSalaryOptions();

  const mVal = document.getElementById('bills-month')?.value;
  const yVal = document.getElementById('bills-year')?.value;

  const month = (mVal !== "" && mVal !== null && mVal !== undefined) ? parseInt(mVal, 10) : null;
  const year = yVal ? parseInt(yVal, 10) : null;

  let filteredBills = state.bills;

  if (month !== null || year !== null) {
    filteredBills = [];
    for(let i = 0; i < state.bills.length; i++) {
      const b = state.bills[i];
      if(!b.datePaid) continue;
      const d = new Date(b.datePaid);
      const matchMonth = (month === null) || (d.getMonth() === month);
      const matchYear = (year === null || isNaN(year)) || (d.getFullYear() === year);
      if(matchMonth && matchYear) {
        manualPush(filteredBills, b);
      }
    }
  }

  const tbody = document.querySelector('#tbl-bills tbody');
  if(tbody){
    tbody.innerHTML = filteredBills.length ? filteredBills.slice().reverse().map(b => `
      <tr><td>${b.id}</td><td>${fmtDate(b.datePaid)}</td><td>${escapeHtml(b.billType)}</td><td>${fmtMoney(b.amount)}</td></tr>
    `).join('') : emptyRow(4,'No bills or expenses found for the selected period.');
  }

  let total = 0;
  for(let i=0; i<filteredBills.length; i++) total += filteredBills[i].amount;
  
  const elTotal = document.getElementById('bills-grand-total');
  if(elTotal) elTotal.textContent = `Total paid for selected period: ${fmtMoney(total)}`;
  
  renderPettyCash();
  renderSales();
}

function uiAddBill(e){
  e.preventDefault();
  addBill({ datePaid: val('bill-date'), billType: val('bill-type'), amount: parseFloat(val('bill-amount')) });
  toast('Bill/Tax recorded.');
  e.target.reset();
  renderBills();
  return false;
}

function uiAddExpense(e){
  e.preventDefault();
  const type = val('exp-type');
  let name = type;
  let amount = parseFloat(val('exp-amount'));
  const disbursedBy = val('exp-disbursed');
  const expDate = val('exp-date') || todayISO();

  if(type === 'Employee Salary'){
    const empId = val('exp-emp');
    const emp = linearSearch(state.employees, e => e.id === empId);
    if(emp) name = `Salary: ${emp.name} (${emp.id})`;
    addBill({ datePaid: expDate, billType: name, amount });
  } else {
    addPettyCashExpense(name, amount, disbursedBy, expDate);
  }

  toast('Expense recorded.');
  e.target.reset();
  renderBills();
  return false;
}

/* =========================================================================
   DELIVERY MANAGEMENT
   ========================================================================= */
function autoComputeDeliveryPrice(){
  const qty = parseFloat(val('dl-qty')) || 0;
  document.getElementById('dl-price').value = (qty * PRICE_PER_GALLON).toFixed(2);
}

function handleDeliveryCustomerInput(valStr){
  const sugBox = document.getElementById('dl-customer-suggestions');
  if(!sugBox) return;
  const matches = suggestAndFillCustomerData(valStr);
  if(!matches.length){
    sugBox.innerHTML = '';
    return;
  }
  sugBox.innerHTML = matches.map(m => `
    <div class="autocomplete-suggestion" onclick="selectDeliveryCustomer('${escapeHtml(m.name)}', '${escapeHtml(m.address)}')">
      <strong>${escapeHtml(m.name)}</strong> — ${escapeHtml(m.address || 'No address')}
    </div>
  `).join('');
}

function selectDeliveryCustomer(name, address){
  document.getElementById('dl-customer').value = name;
  if(address && address !== 'undefined') document.getElementById('dl-address').value = address;
  document.getElementById('dl-customer-suggestions').innerHTML = '';
}

function addDelivery({customerName, address, quantity, slimBorrowed, roundBorrowed}){
  const record = { 
    id: nextId('DLV','delivery'), 
    dateAdded: todayISO(), 
    customerName, 
    address, 
    quantity: Number(quantity), 
    slimBorrowed: Number(slimBorrowed) || 0,
    roundBorrowed: Number(roundBorrowed) || 0,
    status: 'Pending Payment', 
    delivered: false 
  };
  manualPush(state.deliveries, record);
  return record;
}

function setPaymentStatus(deliveryId, status){
  const d = linearSearch(state.deliveries, d => d.id === deliveryId);
  if(!d) return;
  d.status = status;
  toast(`Delivery ${d.id} payment set to ${status}.`);
  renderDelivery();
}

function markDelivered(deliveryId){
  const idx = state.deliveries.findIndex(d => d.id === deliveryId);
  if(idx === -1) return;
  const d = state.deliveries[idx];
  if(d.status !== 'Paid' && d.status !== 'Unpaid'){
    toast('Cannot mark delivered until payment status is confirmed!');
    return;
  }
  const orderTotal = d.quantity * PRICE_PER_GALLON;
  addTransaction({
    customerName: d.customerName, 
    quantity: d.quantity, 
    orderTotal, 
    payment: d.status === 'Paid' ? orderTotal : 0,
    employeeId: state.currentUser ? state.currentUser.id : 'N/A', 
    source: `Delivery (${d.status})`,
    status: d.status === 'Paid' ? 'Paid' : 'Unpaid',
    slimBorrowed: d.slimBorrowed,
    roundBorrowed: d.roundBorrowed
  });
  state.deliveries.splice(idx,1); 
  toast(`Delivery ${d.id} completed & transaction recorded.`);
  renderDelivery();
  renderTransactions();
  renderCustomers();
  renderAlerts();
}

function renderDelivery(){
  const tbody = document.querySelector('#tbl-delivery tbody');
  if(!tbody) return;
  tbody.innerHTML = state.deliveries.length ? state.deliveries.map(d => `
    <tr>
      <td>${d.id}</td>
      <td>${fmtDate(d.dateAdded)}</td>
      <td>${escapeHtml(d.customerName)}</td>
      <td>${escapeHtml(d.address)}</td>
      <td>${d.quantity}</td>
      <td><span class="badge ${d.status === 'Paid' ? 'paid' : (d.status === 'Unpaid' ? 'unpaid' : 'unconfirmed')}">${d.status}</span></td>
      <td>
        <button class="btn-primary" style="width:auto; padding:4px 8px; background:#10b981;" onclick="setPaymentStatus('${d.id}', 'Paid')">Paid</button>
        <button class="btn-primary" style="width:auto; padding:4px 8px; background:#f59e0b;" onclick="setPaymentStatus('${d.id}', 'Unpaid')">Unpaid</button>
      </td>
      <td>
        <button class="btn-primary" style="width:auto; padding:4px 8px;" ${(d.status !== 'Paid' && d.status !== 'Unpaid') ? 'disabled style="opacity:0.5;"' : ''} onclick="markDelivered('${d.id}')">Mark Delivered</button>
      </td>
    </tr>
  `).join('') : emptyRow(8,'No pending deliveries.');
}

function uiAddDelivery(e){
  e.preventDefault();
  const slim = parseInt(val('dl-slim-borrowed')) || 0;
  const round = parseInt(val('dl-round-borrowed')) || 0;
  addDelivery({ 
    customerName: val('dl-customer'), 
    address: val('dl-address'), 
    quantity: val('dl-qty'),
    slimBorrowed: slim,
    roundBorrowed: round
  });
  toast('Delivery order added.');
  e.target.reset();
  renderDelivery();
  renderAlerts();
  return false;
}

/* =========================================================================
   EQUIPMENT MAINTENANCE MANAGEMENT
   ========================================================================= */
let lastMaintenanceByType = {};

function handleActionChange(){
  const action = val('mt-action');
  const typeSel = document.getElementById('mt-type');
  if(action === 'Backwash'){
    typeSel.value = 'N/A';
    typeSel.disabled = true;
  } else {
    typeSel.disabled = false;
  }
}

function addMaintenance({action, type, date}){
  const record = { id: nextId('MNT','maint'), date: date || todayISO(), action, type: action === 'Backwash' ? 'N/A' : type };
  manualPush(state.maintenance, record);
  
  if(action === 'Backwash'){
    lastMaintenanceByType['Backwash'] = record.date;
  } else {
    lastMaintenanceByType[type] = record.date;
  }

  let effect = 'Logged';
  if(action === 'Filter Replacement'){
    const item = linearSearch(state.inventory, i => i.itemName.toLowerCase().includes(type.toLowerCase()));
    if(item){
      stockOut(item.id, 1);
      effect = `−1 ${item.unit} from ${item.id}`;
    } else {
      effect = 'No matching inventory filter found';
    }
  } else {
    effect = 'System Backwash (No Filter Used)';
  }
  return { record, effect };
}

function renderMaintenance(){
  const tbody = document.querySelector('#tbl-maintenance tbody');
  if(!tbody) return;
  tbody.innerHTML = state.maintenance.length ? state.maintenance.slice().reverse().map(m => `
    <tr><td>${m.id}</td><td>${fmtDate(m.date)}</td><td>${escapeHtml(m.action)}</td><td>${m.type}</td>
    <td>${m._effect || '—'}</td></tr>
  `).join('') : emptyRow(5,'No maintenance logged yet.');
}

function uiAddMaintenance(e){
  e.preventDefault();
  const action = val('mt-action'), type = val('mt-type'), date = val('mt-date') || todayISO();
  const { record, effect } = addMaintenance({action, type, date});
  record._effect = effect;
  setMsg('mt-msg', `Logged. Status: ${effect}`, true);
  e.target.reset();
  handleActionChange();
  renderMaintenance();
  renderInventory();
  renderAlerts();
  return false;
}

/* =========================================================================
   INVENTORY MANAGEMENT & PETTY CASH LINKING
   ========================================================================= */
function totalQty(item){ return item.batches.reduce((s,b)=>s+b.qty,0); }

function toggleSupplierSelect(sourceVal){
  const wrap = document.getElementById('inv-supplier-wrap');
  if(wrap){
    wrap.style.display = sourceVal === 'FORMAL_SUPPLIER' ? '' : 'none';
  }
}

function populateInventorySuppliers(){
  const sel = document.getElementById('inv-supplier');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Select Supplier --</option>';
  for(let i=0; i<state.suppliers.length; i++){
    let sup = state.suppliers[i];
    sel.innerHTML += `<option value="${sup.id}">${escapeHtml(sup.name)}</option>`;
  }
  for(let i=0; i<state.employees.length; i++){
    let emp = state.employees[i];
    if(emp.entityType === 'SUPPLIER' || emp.entityType === 'BOTH'){
      sel.innerHTML += `<option value="${emp.id}">${escapeHtml(emp.name)} (${emp.companyName || 'Supplier'})</option>`;
    }
  }
}

function addInventoryItem(itemName, qty, costPerUnit, itemSource, supplierId, workerName, itemType, unit, dateReceived, minStock){
  const totalCost = Number(qty) * Number(costPerUnit || 0);

  const newItem = {
    id: nextId('INV','inv'),
    itemName: itemName,
    itemType: itemType || 'General',
    unit: unit || 'pcs',
    minStock: Number(minStock) || 5,
    source: itemSource || 'FORMAL_SUPPLIER',
    supplierId: supplierId || null,
    costPerUnit: Number(costPerUnit) || 0,
    batches: [{ qty: Number(qty) || 0, dateReceived: dateReceived || todayISO() }]
  };
  
  manualPush(state.inventory, newItem);

  // Link Local or Shopee buys automatically to Petty Cash
  if (itemSource === 'LOCAL_PURCHASE' || itemSource === 'ONLINE_SHOPEE') {
    addPettyCashExpense(
      `Manual Inventory Purchase: ${itemName} (Qty: ${qty})`,
      totalCost,
      workerName || 'Worker'
    );
  }

  return newItem;
}

function saveInventoryItem(data, editId){
  if(editId){
    const item = linearSearch(state.inventory, i => i.id === editId);
    if(item){
      item.itemName = data.itemName;
      item.itemType = data.itemType;
      item.unit = data.unit;
      item.minStock = Number(data.minStock)||0;
      item.source = data.source;
      item.supplierId = data.supplierId;
      item.costPerUnit = Number(data.costPerUnit)||0;
      item.batches = [{ qty: Number(data.quantity)||0, dateReceived: data.dateReceived || todayISO() }];
      return item;
    }
  }

  return addInventoryItem(
    data.itemName, 
    data.quantity, 
    data.costPerUnit, 
    data.source, 
    data.supplierId, 
    data.workerName, 
    data.itemType, 
    data.unit, 
    data.dateReceived, 
    data.minStock
  );
}

function receiveIntoInventory({itemName, itemType, unit, quantity, dateReceived}){
  let item = linearSearch(state.inventory, i => i.itemName.toLowerCase() === itemName.toLowerCase());
  if(item){
    manualPush(item.batches, { qty:Number(quantity), dateReceived: dateReceived || todayISO() });
  } else {
    item = saveInventoryItem({ itemName, itemType: itemType || 'General', quantity, unit, dateReceived, minStock:5, source:'FORMAL_SUPPLIER' }, null);
  }
  return item;
}

function stockOut(itemId, qtyToRemove){
  const item = linearSearch(state.inventory, i => i.id === itemId);
  if(!item) return { ok:false, message:'Item not found.' };
  let remaining = Number(qtyToRemove);
  if(remaining > totalQty(item)) return { ok:false, message:'Not enough stock on hand.' };
  
  bubbleSort(item.batches, (a,b) => new Date(a.dateReceived) - new Date(b.dateReceived));
  
  for(let i=0; i<item.batches.length; i++){
    let batch = item.batches[i];
    if(remaining <= 0) break;
    const take = Math.min(batch.qty, remaining);
    batch.qty -= take;
    remaining -= take;
  }
  
  let validBatches = [];
  for(let i=0; i<item.batches.length; i++){
    if(item.batches[i].qty > 0) manualPush(validBatches, item.batches[i]);
  }
  item.batches = validBatches;
  return { ok:true };
}

function inventoryStatus(item){
  const q = totalQty(item);
  if(q <= 0) return { label:'Out of Stock' };
  if(q <= item.minStock) return { label:'Low Stock' };
  return { label:'In Stock' };
}

function editInventoryItem(id){
  const item = linearSearch(state.inventory, i => i.id === id);
  if(!item) return;
  document.getElementById('inv-edit-id').value = item.id;
  document.getElementById('inv-name').value = item.itemName;
  document.getElementById('inv-type').value = item.itemType;
  document.getElementById('inv-qty').value = totalQty(item);
  document.getElementById('inv-unit').value = item.unit;
  document.getElementById('inv-cost').value = item.costPerUnit || 0;
  document.getElementById('inv-source').value = item.source || 'FORMAL_SUPPLIER';
  toggleSupplierSelect(item.source);
  document.getElementById('inv-supplier').value = item.supplierId || '';
  document.getElementById('inv-received').value = item.batches[0]?.dateReceived || todayISO();
  document.getElementById('inv-min').value = item.minStock;
  document.getElementById('inv-form-title').textContent = `Modifying ${item.id}`;
  document.getElementById('inv-submit-btn').textContent = 'Save changes';
  document.getElementById('inv-cancel-btn').style.display = 'inline-block';
}

function cancelInventoryEdit(){
  document.getElementById('inv-edit-id').value = '';
  document.querySelector('#sec-inventory fieldset form').reset();
  document.getElementById('inv-form-title').textContent = 'Add / Modify Item or Log Purchase';
  document.getElementById('inv-submit-btn').textContent = 'Save Item';
  document.getElementById('inv-cancel-btn').style.display = 'none';
  toggleSupplierSelect('FORMAL_SUPPLIER');
}

function renderInventory(){
  populateInventorySuppliers();
  const tbody = document.querySelector('#tbl-inventory tbody');
  if(!tbody) return;
  tbody.innerHTML = state.inventory.length ? state.inventory.map(i => {
    const s = inventoryStatus(i);
    return `<tr>
      <td>${i.id}</td>
      <td>${escapeHtml(i.itemName)}</td>
      <td>${escapeHtml(i.itemType)}</td>
      <td>${i.source || 'SUPPLIER'}</td>
      <td>${totalQty(i)}</td>
      <td>${escapeHtml(i.unit)}</td>
      <td>${i.minStock}</td>
      <td><span class="badge ${s.label === 'In Stock' ? 'paid' : 'unpaid'}">${s.label}</span></td>
      <td>
        <button class="btn-primary" style="width:auto; padding:4px 8px;" onclick="editInventoryItem('${i.id}')">Modify</button>
        <button class="btn-logout" style="width:auto; padding:4px 8px;" onclick="uiRemoveInventoryItem('${i.id}')">Remove</button>
      </td>
    </tr>`;
  }).join('') : emptyRow(9,'No inventory items yet.');
}

function uiSaveInventoryItem(e){
  e.preventDefault();
  const editId = val('inv-edit-id');
  const item = saveInventoryItem({
    itemName: val('inv-name'), 
    itemType: val('inv-type'), 
    quantity: val('inv-qty'), 
    unit: val('inv-unit'),
    costPerUnit: val('inv-cost'),
    source: val('inv-source'),
    supplierId: val('inv-supplier'),
    workerName: val('inv-worker'),
    dateReceived: val('inv-received'), 
    minStock: val('inv-min')
  }, editId || null);

  setMsg('inv-msg', editId ? `Item ${editId} updated.` : `Item ${item.id} logged.`, true);
  cancelInventoryEdit();
  renderInventory();
  renderBills();
  renderAlerts();
  return false;
}

function uiRemoveInventoryItem(id){
  let idx = -1;
  for(let i=0; i<state.inventory.length; i++){
    if(state.inventory[i].id === id){ idx = i; break; }
  }
  if(idx > -1){
    state.inventory.splice(idx, 1);
    toast('Inventory item removed.');
    renderInventory();
    renderAlerts();
  }
}

/* =========================================================================
   SUPPLY RECEIVING MANAGEMENT
   ========================================================================= */
function populateSupplierDropdown(){
  const sel = document.getElementById('rc-supplier');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Select Supplier --</option>';
  for(let i=0; i<state.suppliers.length; i++){
    let sup = state.suppliers[i];
    sel.innerHTML += `<option value="${escapeHtml(sup.name)}">${escapeHtml(sup.name)}</option>`;
  }
  for(let i=0; i<state.employees.length; i++){
    let emp = state.employees[i];
    if(emp.entityType === 'SUPPLIER' || emp.entityType === 'BOTH'){
      sel.innerHTML += `<option value="${escapeHtml(emp.name)}">${escapeHtml(emp.name)} (${emp.companyName || 'Supplier'})</option>`;
    }
  }
}

function addReceiving({supplierName, itemName, itemType, quantity, unit, expectedDate}){
  const record = {
    id: nextId('RCV','recv'), supplierName, itemName, itemType: itemType || 'General', quantity:Number(quantity), unit,
    expectedDate, actualDate: '—', status:'Pending'
  };
  manualPush(state.receiving, record);
  return record;
}

function verifyReceiving(id){
  const rec = linearSearch(state.receiving, r => r.id === id);
  if(!rec || rec.status === 'Verified') return;
  rec.status = 'Verified';
  rec.actualDate = todayISO();
  receiveIntoInventory({ itemName: rec.itemName, itemType: rec.itemType, unit: rec.unit, quantity: rec.quantity, dateReceived: rec.actualDate });
  toast(`${rec.id} verified — added to Inventory.`);
  renderReceiving();
  renderInventory();
  renderAlerts();
}

function renderReceiving(){
  populateSupplierDropdown();
  const tbody = document.querySelector('#tbl-receiving tbody');
  if(!tbody) return;
  tbody.innerHTML = state.receiving.length ? state.receiving.slice().reverse().map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${escapeHtml(r.supplierName)}</td>
      <td>${escapeHtml(r.itemName)}</td>
      <td>${escapeHtml(r.itemType)}</td>
      <td>${r.quantity}</td>
      <td>${escapeHtml(r.unit)}</td>
      <td>${fmtDate(r.expectedDate)}</td>
      <td>${fmtDate(r.actualDate)}</td>
      <td><span class="badge ${r.status === 'Verified' ? 'paid' : 'unconfirmed'}">${r.status}</span></td>
      <td>${r.status==='Verified' ? '—' : `<button class="btn-primary" style="width:auto; padding:4px 8px;" onclick="verifyReceiving('${r.id}')">Verify</button>`}</td>
    </tr>
  `).join('') : emptyRow(10,'No receiving records yet.');
}

function uiAddReceiving(e){
  e.preventDefault();
  addReceiving({
    supplierName: val('rc-supplier'), itemName: val('rc-item'), itemType: val('rc-type'), quantity: val('rc-qty'), unit: val('rc-unit'),
    expectedDate: val('rc-expected')
  });
  toast('Supply receiving record logged.');
  e.target.reset();
  renderReceiving();
  return false;
}

/* =========================================================================
   INVENTORY REPLENISHMENT & ALERTS
   ========================================================================= */
function computeAlerts(){
  const alerts = [];

  for(let i=0; i<state.inventory.length; i++){
    let item = state.inventory[i];
    const s = inventoryStatus(item);
    if(s.label !== 'In Stock'){
      manualPush(alerts, { type: s.label, item: `${item.itemName} (${item.id})`, date: todayISO(), status: s.label,
        action: s.label === 'Out of Stock' ? 'Reorder immediately' : 'Schedule reorder' });
    }
  }

  for(let i=0; i<state.deliveries.length; i++){
    let d = state.deliveries[i];
    if(daysBetween(d.dateAdded, todayISO()) >= 1){
      manualPush(alerts, { type:'Undelivered Order (>1 Day)', item: `${d.customerName} (${d.id})`, date: d.dateAdded, status: d.status,
        action: 'Dispatch delivery immediately' });
    }
  }

  const maintSchedules = [
    { type: 'Micron Filter', days: 30 },
    { type: 'Carbon Block Filter', days: 90 },
    { type: 'CTO CocoPure Filter', days: 90 },
    { type: 'Backwash', days: 14 }
  ];

  for(let i=0; i<maintSchedules.length; i++){
    let sched = maintSchedules[i];
    let lastDate = lastMaintenanceByType[sched.type] || null;
    if(lastDate === null || daysBetween(lastDate, todayISO()) >= sched.days){
      manualPush(alerts, { 
        type: sched.type === 'Backwash' ? 'Backwash Due' : 'Filter Change Due', 
        item: sched.type, 
        date: lastDate || '—',
        status: lastDate ? `${daysBetween(lastDate, todayISO())}d since last service` : 'Never logged',
        action: sched.type === 'Backwash' ? 'Perform Backwash' : 'Replace Filter' 
      });
    }
  }

  return alerts;
}

function renderAlerts(){
  const alerts = computeAlerts();
  const tbody = document.querySelector('#tbl-alerts tbody');
  if(!tbody) return;
  tbody.innerHTML = alerts.length ? alerts.map(a => `
    <tr><td>${a.type}</td><td>${escapeHtml(a.item)}</td>
    <td>${fmtDate(a.date)}</td><td>${escapeHtml(a.status)}</td><td>${escapeHtml(a.action)}</td></tr>
  `).join('') : emptyRow(5,'Nothing needs attention right now.');

  let lowStockCount = 0, deliveryCount = 0, maintCount = 0;
  for(let i=0; i<alerts.length; i++){
    if(alerts[i].type==='Low Stock'||alerts[i].type==='Out of Stock') lowStockCount++;
    if(alerts[i].type.includes('Undelivered')) deliveryCount++;
    if(alerts[i].type.includes('Due')) maintCount++;
  }

  document.getElementById('alert-count-stock').textContent = lowStockCount;
  document.getElementById('alert-count-delivery').textContent = deliveryCount;
  document.getElementById('alert-count-maint').textContent = maintCount;
}

/* =========================================================================
   EMPLOYEES & PARTNERS MANAGEMENT (Merged Entities Module)
   ========================================================================= */
function addEntity(name, contact, address, entityType, jobRole, dailyRate, companyName, balance){
  const newEntity = {
    id: nextId('ENT','emp'),
    name: name,
    contact: contact,
    address: address || '',
    entityType: entityType || 'EMPLOYEE',
    role: jobRole || '',
    salary: Number(dailyRate) || 0,
    companyName: companyName || '',
    balance: Number(balance) || 0
  };
  manualPush(state.employees, newEntity);
  return newEntity;
}

function getEntitiesByType(targetType){
  var result = [];
  for(var i = 0; i < state.employees.length; i++){
    if(targetType === "ALL" || state.employees[i].entityType === targetType || state.employees[i].entityType === "BOTH"){
      manualPush(result, state.employees[i]);
    }
  }
  return result;
}

function saveEmployee(data, editId){
  if(editId){
    const emp = linearSearch(state.employees, e => e.id === editId);
    if(emp) Object.assign(emp, data);
    return emp;
  }
  return addEntity(data.name, data.contact, data.address, data.entityType, data.role, data.salary, data.companyName, data.balance);
}

function deleteEmployee(id){
  let idx = -1;
  for(let i=0; i<state.employees.length; i++){
    if(state.employees[i].id === id){ idx = i; break; }
  }
  if(idx > -1) state.employees.splice(idx,1);
  renderEmployees();
  renderUsers();
}

function renderEmployees(){
  const q = (document.getElementById('emp-search')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('emp-type-filter')?.value || 'ALL';
  
  let filtered = getEntitiesByType(typeFilter);
  let rows = [];

  for(let i=0; i<filtered.length; i++){
    let e = filtered[i];
    if(!q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || (e.companyName && e.companyName.toLowerCase().includes(q))){
      manualPush(rows, e);
    }
  }
  
  bubbleSort(rows, (a,b) => a.name.localeCompare(b.name));

  const tbody = document.querySelector('#tbl-employees tbody');
  if(!tbody) return;
  tbody.innerHTML = rows.length ? rows.map(e => `
    <tr>
      <td>${e.id}</td>
      <td><strong>${e.entityType}</strong></td>
      <td>${escapeHtml(e.name)} ${e.companyName ? `<em>(${escapeHtml(e.companyName)})</em>` : ''}</td>
      <td>${escapeHtml(e.contact)}</td>
      <td>${escapeHtml(e.role || '—')}</td>
      <td>${fmtMoney(e.salary)}</td>
      <td><strong style="color:${e.balance > 0 ? '#dc2626' : '#16a34a'};">${fmtMoney(e.balance)}</strong></td>
      <td>
        <button class="btn-primary" style="width:auto; padding:4px 8px;" onclick="editEmployee('${e.id}')">Modify</button>
        <button class="btn-logout" style="width:auto; padding:4px 8px;" onclick="deleteEmployee('${e.id}')">Delete</button>
      </td>
    </tr>
  `).join('') : emptyRow(8,'No personnel or partner records found.');
}

function editEmployee(id){
  const emp = linearSearch(state.employees, e => e.id === id);
  if(!emp) return;
  document.getElementById('emp-edit-id').value = emp.id;
  document.getElementById('emp-entity-type').value = emp.entityType || 'EMPLOYEE';
  document.getElementById('emp-name').value = emp.name;
  document.getElementById('emp-contact').value = emp.contact;
  document.getElementById('emp-address').value = emp.address || '';
  document.getElementById('emp-role').value = emp.role || '';
  document.getElementById('emp-salary').value = emp.salary || 0;
  document.getElementById('emp-company').value = emp.companyName || '';
  document.getElementById('emp-balance').value = emp.balance || 0;
  
  document.getElementById('emp-form-title').textContent = `Editing ${emp.id}`;
  document.getElementById('emp-submit-btn').textContent = 'Save changes';
  document.getElementById('emp-cancel-btn').style.display = 'inline-block';
}

function cancelEmployeeEdit(){
  document.getElementById('emp-edit-id').value = '';
  document.querySelector('#sec-employees form').reset();
  document.getElementById('emp-form-title').textContent = 'Add Partner / Staff Member';
  document.getElementById('emp-submit-btn').textContent = 'Add Personnel/Partner';
  document.getElementById('emp-cancel-btn').style.display = 'none';
}

function uiSaveEmployee(e){
  e.preventDefault();
  const editId = val('emp-edit-id');
  saveEmployee({ 
    entityType: val('emp-entity-type'),
    name: val('emp-name'), 
    contact: val('emp-contact'), 
    address: val('emp-address'),
    role: val('emp-role'), 
    salary: parseFloat(val('emp-salary')) || 0,
    companyName: val('emp-company'),
    balance: parseFloat(val('emp-balance')) || 0
  }, editId || null);

  toast(editId ? 'Record updated.' : 'Partner/Personnel added.');
  cancelEmployeeEdit();
  renderEmployees();
  renderBills();
  renderInventory();
  renderReceiving();
  renderUsers();
  return false;
}

/* =========================================================================
   SUPPLIER MANAGEMENT DIRECTORY
   ========================================================================= */
function saveSupplier(data, editId){
  if(editId){
    const sup = linearSearch(state.suppliers, s => s.id === editId);
    if(sup) Object.assign(sup, data);
    return sup;
  }
  const sup = { id: nextId('SUP','sup'), ...data };
  manualPush(state.suppliers, sup);
  return sup;
}

function deleteSupplier(id){
  let idx = -1;
  for(let i=0; i<state.suppliers.length; i++){
    if(state.suppliers[i].id === id){ idx = i; break; }
  }
  if(idx > -1) state.suppliers.splice(idx,1);
  renderSuppliers();
}

function renderSuppliers(){
  const q = (document.getElementById('sup-search')?.value || '').toLowerCase();
  let rows = [];
  for(let i=0; i<state.suppliers.length; i++){
    let s = state.suppliers[i];
    if(!q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)){
      manualPush(rows, s);
    }
  }

  bubbleSort(rows, (a,b) => a.name.localeCompare(b.name));

  const tbody = document.querySelector('#tbl-suppliers tbody');
  if(!tbody) return;
  tbody.innerHTML = rows.length ? rows.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.contact)}</td>
      <td>${escapeHtml(s.address)}</td>
      <td>
        <button class="btn-primary" style="width:auto; padding:4px 8px;" onclick="editSupplier('${s.id}')">Modify</button>
        <button class="btn-logout" style="width:auto; padding:4px 8px;" onclick="deleteSupplier('${s.id}')">Delete</button>
      </td>
    </tr>
  `).join('') : emptyRow(5,'No supplier records yet.');
}

function editSupplier(id){
  const sup = linearSearch(state.suppliers, s => s.id === id);
  if(!sup) return;
  document.getElementById('sup-edit-id').value = sup.id;
  document.getElementById('sup-name').value = sup.name;
  document.getElementById('sup-contact').value = sup.contact;
  document.getElementById('sup-address').value = sup.address || '';
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
    name: val('sup-name'), contact: val('sup-contact'), address: val('sup-address')
  }, editId || null);
  toast(editId ? 'Supplier record updated.' : 'Supplier added.');
  cancelSupplierEdit();
  renderSuppliers();
  renderReceiving();
  return false;
}

/* =========================================================================
   REPORTS MANAGEMENT
   ========================================================================= */
function populateReportMonths(){
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const sel1 = document.getElementById('rep-month-1'), sel2 = document.getElementById('rep-month-2');
  if(!sel1 || !sel2) return;
  
  const options = names.map((n,i) => `<option value="${i}">${n}</option>`).join('');
  sel1.innerHTML = options;
  sel2.innerHTML = options;
  
  const now = new Date();
  sel1.value = now.getMonth();
  sel2.value = now.getMonth();
  document.getElementById('rep-year-1').value = now.getFullYear();
  document.getElementById('rep-year-2').value = now.getFullYear();
}

function generateSingleReportData(month, year){
  const inRange = (dateStr) => { 
    if(!dateStr) return false;
    const d = new Date(dateStr); 
    return d.getMonth()===month && d.getFullYear()===year; 
  };
  let txs = [], bills = [], petties = [];
  
  for(let i=0; i<state.transactions.length; i++){
    let t = state.transactions[i];
    if(inRange(t.datePaid || t.date)) manualPush(txs, t);
  }
  for(let i=0; i<state.bills.length; i++){
    if(inRange(state.bills[i].datePaid)) manualPush(bills, state.bills[i]);
  }
  for(let i=0; i<state.pettyCash.length; i++){
    if(inRange(state.pettyCash[i].date)) manualPush(petties, state.pettyCash[i]);
  }

  let sales = 0;
  for(let i=0; i<txs.length; i++){
    if(txs[i].status === 'Paid') sales += txs[i].orderTotal;
  }
  
  let expenses = 0;
  for(let i=0; i<bills.length; i++) expenses += bills[i].amount;
  for(let i=0; i<petties.length; i++) expenses += petties[i].amount;

  return { orders: txs.length, sales, expenses, profit: sales - expenses };
}

function renderReport(){
  const m1 = parseInt(val('rep-month-1'),10), y1 = parseInt(val('rep-year-1'),10);
  const m2 = parseInt(val('rep-month-2'),10), y2 = parseInt(val('rep-year-2'),10);

  const r1 = generateSingleReportData(m1, y1);
  const r2 = generateSingleReportData(m2, y2);

  document.getElementById('rep1-orders').textContent = r1.orders;
  document.getElementById('rep1-sales').textContent = fmtMoney(r1.sales);
  document.getElementById('rep1-expenses').textContent = fmtMoney(r1.expenses);
  document.getElementById('rep1-profit').textContent = fmtMoney(r1.profit);

  document.getElementById('rep2-orders').textContent = r2.orders;
  document.getElementById('rep2-sales').textContent = fmtMoney(r2.sales);
  document.getElementById('rep2-expenses').textContent = fmtMoney(r2.expenses);
  document.getElementById('rep2-profit').textContent = fmtMoney(r2.profit);
}

/* ---------------------------------------------------------------------
   DOM Utilities
   --------------------------------------------------------------------- */
function val(id){ return document.getElementById(id) ? document.getElementById(id).value.trim() : ''; }
function emptyRow(colspan, text){ return `<tr><td colspan="${colspan}">${text}</td></tr>`; }
function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderAll(){
  renderUsers(); renderCustomers(); renderTransactions(); renderSales(); renderBills(); renderPettyCash(); renderDelivery();
  renderMaintenance(); renderInventory(); renderReceiving(); renderAlerts();
  renderEmployees(); renderSuppliers(); renderReport();
}

/* ---------------------------------------------------------------------
   Authentication Handlers
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

  for(let i=0; i<NAV_ITEMS.length; i++){
    const sec = document.getElementById('sec-' + NAV_ITEMS[i].id);
    if (sec) sec.style.display = 'none';
  }

  document.getElementById('section-title').textContent = '';
  document.getElementById('login-form-wrap').style.display = '';
  document.getElementById('login-form').reset();
}

/* ---------------------------------------------------------------------
   Navigation Controller
   --------------------------------------------------------------------- */
const NAV_ITEMS = [
  { id:'transactions', label:'Transactions', group:'Operations' },
  { id:'customers', label:'Customer Hub', group:'Operations' },
  { id:'delivery', label:'Delivery', group:'Operations' },
  { id:'maintenance', label:'Equipment Maintenance', group:'Operations' },
  { id:'inventory', label:'Inventory', group:'Operations' },
  { id:'receiving', label:'Supply Receiving', group:'Operations' },
  { id:'alerts', label:'Alerts', group:'Operations', adminOnly:true },
  { id:'sales', label:'Sales & Profit', group:'Management', adminOnly:true },
  { id:'bills', label:'Bills, Expenses & Petty Cash', group:'Management', adminOnly:true },
  { id:'employees', label:'Personnel & Partners', group:'Management', adminOnly:true },
  { id:'suppliers', label:'Suppliers Directory', group:'Management', adminOnly:true },
  { id:'reports', label:'Reports', group:'Management', adminOnly:true },
  { id:'users', label:'User Accounts', group:'Management', adminOnly:true },
];

function buildNav(role){
  const nav = document.getElementById('sidebar-nav');
  let html = '';
  let currentGroup = null;
  for(let i=0; i<NAV_ITEMS.length; i++){
    let item = NAV_ITEMS[i];
    if(!item.adminOnly || role === 'Admin'){
      if(item.group !== currentGroup){
        html += `<li style="padding:10px 16px 4px; font-size:0.75rem; text-transform:uppercase; color:rgba(255,255,255,0.5); font-weight:bold;">${item.group}</li>`;
        currentGroup = item.group;
      }
      html += `<li><button id="nav-btn-${item.id}" data-section="${item.id}" onclick="showSection('${item.id}')">${item.label}</button></li>`;
    }
  }
  nav.innerHTML = html;
}

function showSection(id){
  for(let i=0; i<NAV_ITEMS.length; i++){
    let item = NAV_ITEMS[i];
    const sec = document.getElementById('sec-' + item.id);
    const navBtn = document.getElementById('nav-btn-' + item.id);
    if (sec) {
      sec.style.display = (item.id === id) ? '' : 'none';
    }
    if (navBtn) {
      if (item.id === id) navBtn.classList.add('active');
      else navBtn.classList.remove('active');
    }
  }

  const item = linearSearch(NAV_ITEMS, n => n.id === id);
  document.getElementById('section-title').textContent = item ? item.label : '';
  if(id === 'reports') renderReport();
  if(id === 'alerts') renderAlerts();
  if(id === 'customers') renderCustomers();
  if(id === 'bills') renderPettyCash();
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
   Initialization
   --------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  populateReportMonths();
  populateBillsMonths();
  const mtDate = document.getElementById('mt-date');
  if(mtDate) mtDate.value = todayISO();
  const billDate = document.getElementById('bill-date');
  if(billDate) billDate.value = todayISO();
  const expDate = document.getElementById('exp-date');
  if(expDate) expDate.value = todayISO();
  const invDate = document.getElementById('inv-received');
  if(invDate) invDate.value = todayISO();
});