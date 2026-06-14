// 1. SUPABASE CLIENT INITIALIZATION
const supabaseUrl = 'https://apnpufhbshkgaeebfitn.supabase.co';
const supabaseKey = 'sb_publishable_x_BK6tD0fv4P1mJrZsCxEw_vsn2nNZj';

// Global Supabase Client is accessed directly via the global window namespace

// Application State
let state = {
    clients: [],
    sales: [],
    credits: [],
    expenses: [],
    stock: [],
    stock_history: [],
    user: null,
    activeStockOperator: 'Maroc Telecom'
};

// Charts instances
let salesTrendChart = null;
let operatorDistChart = null;

// Constant Operator Brand Mappings
const OPERATOR_COLORS = {
    'Maroc Telecom': '#EF4444', // Red
    'Orange': '#FF6600',        // Orange
    'Inwi': '#8B5CF6'           // Purple
};


// 2. DOCUMENT READY & INITIAL SETUP
document.addEventListener('DOMContentLoaded', () => {
    // Safety check for CDN loading
    if (!window.supabase) {
        console.error("Supabase CDN failed to load.");
        // We defer warning using setTimeout so SweetAlert is ready
        setTimeout(() => {
            const isAr = (localStorage.getItem('recharge_sim_lang') || 'fr') === 'ar';
            Swal.fire({
                icon: 'error',
                title: isAr ? 'خطأ في الشبكة' : 'Erreur réseau',
                html: isAr 
                    ? '<div style="text-align: right; direction: rtl;">يتعذر تحميل SDK لـ Supabase. يرجى التحقق من اتصالك بالإنترنت.</div>' 
                    : 'Impossible de charger le SDK Supabase. Veuillez vérifier votre connexion internet.',
                customClass: { popup: 'swal2-popup-custom' }
            });
        }, 500);
        return;
    }
    
    // Initialize Client
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    initApp();
});

function initApp() {
    setupNavRouting();
    checkAuthSession();
    setupEventListeners();
    populateCommissionInputs();
    setupThemeToggler();
}

// Check session in localStorage
function checkAuthSession() {
    const session = localStorage.getItem('recharge_sim_session');
    if (session) {
        state.user = JSON.parse(session);
        showAppShell();
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
}

function showAppShell() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    loadDatabaseData();
}

// Sidebar View Switcher Routing
function setupNavRouting() {
    const links = document.querySelectorAll('.sidebar-link');
    const sections = document.querySelectorAll('.view-section');
    const topTitle = document.getElementById('topbar-title');
    const sidebar = document.getElementById('sidebar-nav');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            
            // Update Active Link State
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Scroll tab into view on mobile
            if (window.innerWidth <= 768) {
                link.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
            
            // Switch Active View Panel
            sections.forEach(s => s.classList.add('hidden'));
            const activeSection = document.getElementById(`view-${target}`);
            if (activeSection) {
                activeSection.classList.remove('hidden');
            }
            
            // Update Navbar Title
            topTitle.textContent = link.querySelector('span').textContent;
            
            // Close mobile sidebar if open
            sidebar.classList.remove('open');
            
            // Refresh data on switching view if needed
            if (target === 'dashboard') {
                loadDatabaseData();
            } else if (target === 'clients') {
                renderClientsTable();
            } else if (target === 'ventes') {
                renderSalesTable();
            } else if (target === 'credits') {
                renderCreditsTable();
            } else if (target === 'expenses') {
                renderExpensesTable();
            } else if (target === 'stock') {
                renderStockTable();
            }
        });
    });

    // Mobile Hamburger Toggle
    document.getElementById('menu-toggle').addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

function setupEventListeners() {
    // Login Submission Handler
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        // Flexible login check to prevent lockout in the demo dashboard
        if (email && password.length >= 4) {
            const userSession = { email, role: 'Super Admin' };
            localStorage.setItem('recharge_sim_session', JSON.stringify(userSession));
            state.user = userSession;
            
            const isAr = (localStorage.getItem('recharge_sim_lang') || 'fr') === 'ar';
            Swal.fire({
                icon: 'success',
                title: isAr ? 'تم تسجيل الدخول بنجاح' : 'Connexion réussie',
                text: isAr ? 'مرحباً بك في مدير الشحن والشرائح!' : 'Bienvenue dans Recharge & SIM Manager !',
                timer: 1500,
                showConfirmButton: false,
                customClass: { popup: 'swal2-popup-custom' }
            }).then(() => {
                showAppShell();
            });
        } else {
            const isAr = (localStorage.getItem('recharge_sim_lang') || 'fr') === 'ar';
            Swal.fire({
                icon: 'error',
                title: isAr ? 'فشل تسجيل الدخول' : 'Échec de connexion',
                text: isAr ? 'يجب أن تحتوي كلمة المرور على 4 أحرف على الأقل.' : 'Le mot de passe doit contenir au moins 4 caractères.',
                customClass: { popup: 'swal2-popup-custom' }
            });
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('recharge_sim_session');
        state.user = null;
        showLoginScreen();
    });

    // SQL Setup Helper show script
    document.getElementById('btn-show-sql').addEventListener('click', () => {
        showSQLScriptModal();
    });

    // Trigger buttons for sales/clients/etc.
    document.querySelectorAll('.btn-new-sale-trigger').forEach(btn => {
        btn.addEventListener('click', () => triggerNewSaleModal());
    });
    document.getElementById('btn-add-client-trigger').addEventListener('click', () => triggerNewClientModal());
    document.getElementById('btn-add-expense-trigger').addEventListener('click', () => triggerNewExpenseModal());
    document.getElementById('btn-add-stock-trigger').addEventListener('click', () => triggerAddStockModal());
    const bulkDeleteStockBtn = document.getElementById('btn-delete-selected-stock');
    if (bulkDeleteStockBtn) {
        bulkDeleteStockBtn.addEventListener('click', () => deleteSelectedStockItemsHandler());
    }
    
    // Config controls
    document.getElementById('btn-seed-data').addEventListener('click', () => seedDatabaseDemoData());
    document.getElementById('btn-clear-db').addEventListener('click', () => clearDatabaseTables());

    const formCommissions = document.getElementById('form-commissions');
    if (formCommissions) {
        formCommissions.addEventListener('submit', (e) => {
            e.preventDefault();
            const isAr = document.documentElement.lang === 'ar';
            const comms = {
                mt_recharge: parseFloat(document.getElementById('comm-mt-recharge').value || 0),
                mt_sim: parseFloat(document.getElementById('comm-mt-sim').value || 0),
                orange_recharge: parseFloat(document.getElementById('comm-orange-recharge').value || 0),
                orange_sim: parseFloat(document.getElementById('comm-orange-sim').value || 0),
                inwi_recharge: parseFloat(document.getElementById('comm-inwi-recharge').value || 0),
                inwi_sim: parseFloat(document.getElementById('comm-inwi-sim').value || 0)
            };
            saveCommissions(comms);
            updateDashboardStats();
            Swal.fire({
                icon: 'success',
                title: isAr ? 'تم حفظ الإعدادات' : 'Paramètres enregistrés',
                text: isAr ? 'تم تحديث نسب العمولات بنجاح!' : 'Les taux de commission ont été mis à jour avec succès !',
                timer: 1500,
                showConfirmButton: false,
                customClass: { popup: 'swal2-popup-custom' }
            });
        });
    }

    // Search and filter triggers
    document.getElementById('clients-search').addEventListener('input', () => renderClientsTable());
    document.getElementById('sales-search').addEventListener('input', () => renderSalesTable());
    document.getElementById('sales-filter-operator').addEventListener('change', () => renderSalesTable());
    document.getElementById('sales-filter-status').addEventListener('change', () => renderSalesTable());
    document.getElementById('credits-search').addEventListener('input', () => renderCreditsTable());
    document.getElementById('credits-filter-status').addEventListener('change', () => renderCreditsTable());
    document.getElementById('btn-view-all-sales').addEventListener('click', () => {
        document.querySelector('.sidebar-link[data-target="ventes"]').click();
    });

    // Stock Operator tab listeners
    const filterMtBtn = document.getElementById('stock-filter-mt');
    const filterOrangeBtn = document.getElementById('stock-filter-orange');
    const filterInwiBtn = document.getElementById('stock-filter-inwi');

    if (filterMtBtn && filterOrangeBtn && filterInwiBtn) {
        const updateTabs = (operator) => {
            state.activeStockOperator = operator;
            
            // Highlight active tab/button, reset others
            [
                { btn: filterMtBtn, color: 'var(--maroc-telecom)', light: 'var(--maroc-telecom-light)' },
                { btn: filterOrangeBtn, color: 'var(--orange)', light: 'var(--orange-light)' },
                { btn: filterInwiBtn, color: 'var(--inwi)', light: 'var(--inwi-light)' }
            ].forEach(tab => {
                if (state.activeStockOperator === tab.btn.textContent.trim()) {
                    tab.btn.style.border = `2px solid ${tab.color}`;
                    tab.btn.style.color = tab.color;
                    tab.btn.style.backgroundColor = tab.light;
                    tab.btn.style.fontWeight = '700';
                } else {
                    tab.btn.style.border = `1px solid var(--border)`;
                    tab.btn.style.color = 'var(--text-muted)';
                    tab.btn.style.backgroundColor = 'transparent';
                    tab.btn.style.fontWeight = '500';
                }
            });
            
            renderStockTable();
        };

        filterMtBtn.addEventListener('click', () => updateTabs('Maroc Telecom'));
        filterOrangeBtn.addEventListener('click', () => updateTabs('Orange'));
        filterInwiBtn.addEventListener('click', () => updateTabs('Inwi'));
    }
    
    // Language switch setup
    setupLanguageSwitcher();
}

// 3. DATABASE CRUD & FETCH LOGIC
async function loadDatabaseData() {
    try {
        // Run test query to see if database tables are set up
        const testRes = await supabase.from('stock').select('id').limit(1);
        if (testRes.error && testRes.error.code === '42P01') {
            // Relation does not exist - show SQL Helper banner
            document.getElementById('sql-helper-banner').classList.remove('hidden');
            const isAr = document.documentElement.lang === 'ar';
            Swal.fire({
                icon: 'warning',
                title: isAr ? 'قاعدة بيانات فارغة' : 'Base de données vide',
                html: isAr 
                    ? "<div style='text-align: right; direction: rtl;'>لم يتم إنشاء الجداول بعد في حساب Supabase الخاص بك. يرجى نسخ وتشغيل برنامج SQL النصي في علامة تبويب <b>الإعدادات</b>.</div>"
                    : "Les tables n'ont pas encore été créées sur votre compte Supabase. Veuillez copier et exécuter le script SQL dans l'onglet <b>Configuration</b>.",
                confirmButtonText: isAr ? 'عرض SQL' : 'Voir le SQL',
                customClass: { popup: 'swal2-popup-custom' }
            }).then(() => {
                showSQLScriptModal();
            });
            renderEmptyState();
            return;
        } else if (testRes.error) {
            throw testRes.error;
        } else {
            document.getElementById('sql-helper-banner').classList.add('hidden');
        }

        // Parallel fetches using Supabase
        const [clientsRes, salesRes, creditsRes, expensesRes, stockRes] = await Promise.all([
            supabase.from('clients').select('*').order('name'),
            supabase.from('sales').select('*, clients(*)').order('created_at', { ascending: false }),
            supabase.from('credits').select('*, clients(*)').order('created_at', { ascending: false }),
            supabase.from('expenses').select('*').order('created_at', { ascending: false }),
            supabase.from('stock').select('*').order('operator')
        ]);

        state.clients = clientsRes.data || [];
        state.sales = salesRes.data || [];
        state.credits = creditsRes.data || [];
        state.expenses = expensesRes.data || [];
        state.stock = stockRes.data || [];

        // Fetch stock history separately to avoid crashing if table doesn't exist
        state.stock_history = [];
        try {
            const historyRes = await supabase.from('stock_history').select('*').order('created_at', { ascending: false });
            if (historyRes.error) {
                if (historyRes.error.code === '42P01') {
                    console.warn("stock_history table relation does not exist.");
                } else {
                    throw historyRes.error;
                }
            } else {
                state.stock_history = historyRes.data || [];
            }
        } catch (err) {
            console.error("Failed to load stock history:", err);
        }

        // Auto-seed missing stock items for operators
        state.stock = await ensureDefaultStock(state.stock);

        updateDashboardStats();
        renderRecentSalesTable();
        renderClientsTable();
        renderSalesTable();
        renderCreditsTable();
        renderExpensesTable();
        renderStockTable();
        renderStockHistoryTable();
    } catch (err) {
        console.error('Error fetching database:', err);
        const isAr = document.documentElement.lang === 'ar';
        Swal.fire({
            icon: 'error',
            title: isAr ? 'خطأ في Supabase' : 'Erreur Supabase',
            html: isAr
                ? `<div style='text-align: right; direction: rtl;'>${escapeHTML(err.message || 'تعذر تحميل البيانات. يرجى التحقق من المفاتيح والاتصال بالإنترنت.')}</div>`
                : escapeHTML(err.message || 'Impossible de charger les données. Vérifiez vos clés et votre connexion.'),
            customClass: { popup: 'swal2-popup-custom' }
        });
        renderEmptyState();
    }
}

function renderEmptyState() {
    const tbody = document.getElementById('recent-sales-tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-light); padding: 2rem;">Veuillez configurer la base de données pour afficher les transactions.</td></tr>`;
    }
    
    const elements = {
        'stat-recharge-val': '0.00 DH',
        'stat-sim-val': '0.00 DH',
        'stat-sim-volume': '0 Pcs',
        'stat-credits-val': '0.00 DH',
        'credit-stat-total': '0.00 DH',
        'credit-stat-paid': '0.00 DH',
        'credit-stat-remaining': '0.00 DH',
        'caisse-stat-total': '0.00 DH',
        'caisse-stat-expenses': '0.00 DH'
    };

    for (let id in elements) {
        const el = document.getElementById(id);
        if (el) el.textContent = elements[id];
    }
}

async function ensureDefaultStock(stockList) {
    const operators = ['Maroc Telecom', 'Orange', 'Inwi'];
    const denominations = [5, 10, 20, 30, 50, 100, 500, 1000, 5000];
    
    let needsInsert = [];
    
    operators.forEach(op => {
        const opItems = stockList.filter(s => s.operator === op);
        if (opItems.length === 0) {
            denominations.forEach(denom => {
                needsInsert.push({
                    operator: op,
                    product_type: 'Recharge',
                    product_name: `Recharge ${denom} DH`,
                    quantity: 0,
                    min_threshold: 10
                });
            });
            needsInsert.push({
                operator: op,
                product_type: 'SIM',
                product_name: `Carte SIM ${op}`,
                quantity: 0,
                min_threshold: 5
            });
        }
    });

    if (needsInsert.length > 0) {
        const { error } = await supabase.from('stock').insert(needsInsert);
        if (!error) {
            const { data } = await supabase.from('stock').select('*').order('operator');
            return data || [];
        }
    }
    return stockList;
}

async function initializeDefaultStock() {
    const defaultProducts = [];
    const operators = ['Maroc Telecom', 'Orange', 'Inwi'];
    const denominations = [5, 10, 20, 30, 50, 100, 500, 1000, 5000];

    operators.forEach(op => {
        denominations.forEach(denom => {
            defaultProducts.push({
                operator: op,
                product_type: 'Recharge',
                product_name: `Recharge ${denom} DH`,
                quantity: 0,
                min_threshold: 10
            });
        });
        defaultProducts.push({
            operator: op,
            product_type: 'SIM',
            product_name: `Carte SIM ${op}`,
            quantity: 0,
            min_threshold: 5
        });
    });

    await supabase.from('stock').insert(defaultProducts);
    const stockRes = await supabase.from('stock').select('*');
    state.stock = stockRes.data || [];
}

// 4. RENDERING VIEWS

// Dashboard computations
function updateDashboardStats() {
    // Calculate values
    let totalRechargeSales = 0;
    let totalSimSales = 0;
    let totalSimQty = 0;
    let totalProfit = 0; // Net profit calculation from sales

    const comms = loadCommissions();
    
    state.sales.forEach(sale => {
        const netToPay = parseFloat(sale.net_to_pay || 0);
        const qty = parseInt(sale.quantity || 0);
        const totalBrut = parseFloat(sale.total_brut || 0);
        const discountAmount = parseFloat(sale.discount || 0);

        if (sale.product_type === 'Recharge') {
            totalRechargeSales += netToPay;
            
            // Recharges commissions from config
            let buyCommPct = 0;
            if (sale.operator === 'Maroc Telecom') buyCommPct = comms.mt_recharge;
            else if (sale.operator === 'Orange') buyCommPct = comms.orange_recharge;
            else if (sale.operator === 'Inwi') buyCommPct = comms.inwi_recharge;

            const buyCommAmount = totalBrut * (buyCommPct / 100);
            const saleProfit = buyCommAmount - discountAmount;
            totalProfit += saleProfit;
            
        } else if (sale.product_type === 'SIM') {
            totalSimSales += netToPay;
            totalSimQty += qty;
            
            // SIM commissions from config
            let buyCommPerUnit = 0;
            if (sale.operator === 'Maroc Telecom') buyCommPerUnit = comms.mt_sim;
            else if (sale.operator === 'Orange') buyCommPerUnit = comms.orange_sim;
            else if (sale.operator === 'Inwi') buyCommPerUnit = comms.inwi_sim;

            const buyCommAmount = qty * buyCommPerUnit;
            const saleProfit = buyCommAmount - discountAmount;
            totalProfit += saleProfit;
        }
    });

    let totalCredits = 0;
    state.credits.forEach(credit => {
        totalCredits += parseFloat(credit.remaining_amount || 0);
    });

    // UI Outputs
    document.getElementById('stat-recharge-val').textContent = formatCurrency(totalRechargeSales);
    document.getElementById('stat-sim-val').textContent = formatCurrency(totalSimSales);
    document.getElementById('stat-sim-volume').textContent = `${totalSimQty} Pcs`;
    document.getElementById('stat-credits-val').textContent = formatCurrency(totalCredits);
    
    // Profit UI Output
    const profitEl = document.getElementById('stat-profit-val');
    if (profitEl) {
        profitEl.textContent = formatCurrency(totalProfit);
    }

    updateDashboardCharts();
}

function renderRecentSalesTable() {
    const tbody = document.getElementById('recent-sales-tbody');
    tbody.innerHTML = '';

    const recent = state.sales.slice(0, 5);
    
    if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-light); padding: 2rem;">Aucune vente enregistrée.</td></tr>`;
        return;
    }

    recent.forEach(sale => {
        const clientName = sale.clients ? sale.clients.name : 'Client Supprimé';
        const operatorClass = sale.operator === 'Maroc Telecom' ? 'badge-mt' : (sale.operator === 'Orange' ? 'badge-orange' : 'badge-inwi');
        const paymentClass = sale.payment_status === 'Payé' ? 'badge-paid' : 'badge-unpaid';
        
        const isAr = document.documentElement.lang === 'ar';
        const statusText = isAr 
            ? (sale.payment_status === 'Payé' ? 'مدفوع' : 'دين') 
            : sale.payment_status;
            
        const qtyUnit = isAr ? 'قطعة' : 'Pcs';

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
            <td>${formatDate(sale.created_at)}</td>
            <td class="bold">${escapeHTML(clientName)}</td>
            <td>${escapeHTML(sale.product_name)}</td>
            <td><span class="badge ${operatorClass}">${escapeHTML(sale.operator)}</span></td>
            <td>${sale.quantity} ${qtyUnit}</td>
            <td class="text-right">${formatCurrency(sale.discount)}</td>
            <td class="text-right bold" style="color: var(--primary-hover);">${formatCurrency(sale.net_to_pay)}</td>
            <td><span class="badge ${paymentClass}">${statusText}</span></td>
            <td>
                <button class="icon-btn btn-view-invoice" data-notes="${escapeHTML(sale.notes || '')}" style="color:var(--primary); border-color:var(--primary); padding:2px; height:24px; width:24px; min-width:24px; display:inline-flex; align-items:center; justify-content:center;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:12px;height:12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Bind listeners
    document.querySelectorAll('#recent-sales-tbody .btn-view-invoice').forEach(btn => {
        btn.addEventListener('click', () => {
            const invoiceRef = btn.getAttribute('data-notes');
            if (invoiceRef) {
                viewPastInvoice(invoiceRef);
            } else {
                Swal.fire('Info', 'Aucune facture associée à cette transaction', 'info');
            }
        });
    });
}

function renderClientsTable() {
    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = '';

    const search = document.getElementById('clients-search').value.toLowerCase();
    
    const filtered = state.clients.filter(c => {
        return (c.name || '').toLowerCase().includes(search) || 
               (c.phone || '').toLowerCase().includes(search) || 
               (c.dealer_number || '').toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-light); padding: 2rem;">Aucun client trouvé.</td></tr>`;
        return;
    }

    filtered.forEach(client => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="bold">${escapeHTML(client.name)}</td>
            <td>${escapeHTML(client.phone || '-')}</td>
            <td><span style="font-family: monospace; background:#F1F5F9; padding: 2px 6px; border-radius:4px;">${escapeHTML(client.dealer_number || '-')}</span></td>
            <td>${escapeHTML(client.activity || '-')}</td>
            <td>${escapeHTML(client.address || '-')}</td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(client.notes || '-')}</td>
            <td>
                <div class="table-actions">
                    <button class="icon-btn btn-edit-client" data-id="${client.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                    </button>
                    <button class="icon-btn icon-btn-danger btn-delete-client" data-id="${client.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0M4.5 18a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0019.5 18v-9.5A2.25 2.25 0 0017.25 6.25H6.75A2.25 2.25 0 004.5 8.5V18z" /></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Wire up actions listeners
    document.querySelectorAll('.btn-edit-client').forEach(btn => {
        btn.addEventListener('click', () => editClientHandler(btn.getAttribute('data-id')));
    });
    document.querySelectorAll('.btn-delete-client').forEach(btn => {
        btn.addEventListener('click', () => deleteClientHandler(btn.getAttribute('data-id')));
    });
}

function renderSalesTable() {
    const tbody = document.getElementById('sales-tbody');
    tbody.innerHTML = '';

    const search = document.getElementById('sales-search').value.toLowerCase();
    const operator = document.getElementById('sales-filter-operator').value;
    const status = document.getElementById('sales-filter-status').value;

    const filtered = state.sales.filter(s => {
        const clientName = s.clients ? s.clients.name : '';
        const matchesSearch = clientName.toLowerCase().includes(search) || 
                              s.product_name.toLowerCase().includes(search) || 
                              (s.notes || '').toLowerCase().includes(search);
        
        const matchesOperator = !operator || s.operator === operator;
        const matchesStatus = !status || s.payment_status === status;

        return matchesSearch && matchesOperator && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-light); padding: 2rem;">Aucune vente correspondante.</td></tr>`;
        return;
    }

    filtered.forEach(sale => {
        const clientName = sale.clients ? sale.clients.name : 'Client Supprimé';
        const operatorClass = sale.operator === 'Maroc Telecom' ? 'badge-mt' : (sale.operator === 'Orange' ? 'badge-orange' : 'badge-inwi');
        const paymentClass = sale.payment_status === 'Payé' ? 'badge-paid' : 'badge-unpaid';
        
        const isAr = document.documentElement.lang === 'ar';
        const statusText = isAr 
            ? (sale.payment_status === 'Payé' ? 'مدفوع' : 'دين') 
            : sale.payment_status;
            
        const qtyUnit = isAr ? 'قطعة' : 'Pcs';

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
            <td>${formatDate(sale.created_at)}</td>
            <td class="bold">${escapeHTML(clientName)}</td>
            <td>${escapeHTML(sale.product_name)}</td>
            <td><span class="badge ${operatorClass}">${escapeHTML(sale.operator)}</span></td>
            <td>${sale.quantity} ${qtyUnit}</td>
            <td class="text-right">${formatCurrency(sale.unit_price)}</td>
            <td class="text-right">${formatCurrency(sale.discount)}</td>
            <td class="text-right bold" style="color: var(--primary-hover);">${formatCurrency(sale.net_to_pay)}</td>
            <td><span class="badge ${paymentClass}">${statusText}</span></td>
            <td>
                <div class="flex gap-2">
                    <button class="icon-btn btn-view-invoice" data-notes="${escapeHTML(sale.notes || '')}" style="color:var(--primary); border-color:var(--primary); display:inline-flex; align-items:center; justify-content:center; height: 28px; width: 28px;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                    </button>
                    <button class="icon-btn icon-btn-danger btn-delete-sale" data-id="${sale.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0M4.5 18a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0019.5 18v-9.5A2.25 2.25 0 0017.25 6.25H6.75A2.25 2.25 0 004.5 8.5V18z" /></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-delete-sale').forEach(btn => {
        btn.addEventListener('click', () => deleteSaleHandler(btn.getAttribute('data-id')));
    });

    document.querySelectorAll('#sales-tbody .btn-view-invoice').forEach(btn => {
        btn.addEventListener('click', () => {
            const invoiceRef = btn.getAttribute('data-notes');
            if (invoiceRef) {
                viewPastInvoice(invoiceRef);
            } else {
                Swal.fire('Info', 'Aucune facture associée à cette transaction', 'info');
            }
        });
    });
}

function renderCreditsTable() {
    const tbody = document.getElementById('credits-tbody');
    tbody.innerHTML = '';

    const search = document.getElementById('credits-search').value.toLowerCase();
    const status = document.getElementById('credits-filter-status').value;

    const filtered = state.credits.filter(c => {
        const clientName = c.clients ? c.clients.name : '';
        const matchesSearch = clientName.toLowerCase().includes(search);
        const matchesStatus = !status || c.status === status;
        return matchesSearch && matchesStatus;
    });

    // Compute credit stats summaries
    let totalCredit = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    filtered.forEach(c => {
        totalCredit += parseFloat(c.total_amount || 0);
        totalPaid += parseFloat(c.paid_amount || 0);
        totalRemaining += parseFloat(c.remaining_amount || 0);
    });

    document.getElementById('credit-stat-total').textContent = formatCurrency(totalCredit);
    document.getElementById('credit-stat-paid').textContent = formatCurrency(totalPaid);
    document.getElementById('credit-stat-remaining').textContent = formatCurrency(totalRemaining);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-light); padding: 2rem;">Aucun crédit enregistré.</td></tr>`;
        return;
    }

    filtered.forEach(credit => {
        const clientName = credit.clients ? credit.clients.name : 'Client Supprimé';
        const saleArticle = credit.sales ? credit.sales.product_name : 'Vente Supprimée';
        
        let statusClass = 'badge-unpaid';
        if (credit.status === 'Payé') statusClass = 'badge-paid';
        if (credit.status === 'Partiellement payé') statusClass = 'badge-partial';

        const isAr = document.documentElement.lang === 'ar';
        let statusText = credit.status;
        if (isAr) {
            if (credit.status === 'Payé') statusText = 'مدفوع';
            else if (credit.status === 'Partiellement payé') statusText = 'مدفوع جزئياً';
            else if (credit.status === 'Non payé') statusText = 'غير مدفوع';
        }
        
        const settleText = isAr ? 'تسديد' : 'Régler';
        const settledText = isAr ? '✓ مسدد' : '✓ Soldé';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(credit.created_at)}</td>
            <td class="bold">${escapeHTML(clientName)}</td>
            <td>${escapeHTML(saleArticle)}</td>
            <td class="text-right">${formatCurrency(credit.total_amount)}</td>
            <td class="text-right" style="color: var(--success);">${formatCurrency(credit.paid_amount)}</td>
            <td class="text-right bold" style="color: var(--danger);">${formatCurrency(credit.remaining_amount)}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="table-actions">
                    ${credit.remaining_amount > 0 ? `
                        <button class="btn btn-primary btn-sm btn-settle-credit" data-id="${credit.id}" style="background-color: var(--success); padding: 4px 8px;">
                            <span>${settleText}</span>
                        </button>
                    ` : `
                        <span style="color: var(--success); font-size: 0.8rem; font-weight:600;">${settledText}</span>
                    `}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-settle-credit').forEach(btn => {
        btn.addEventListener('click', () => settleCreditHandler(btn.getAttribute('data-id')));
    });
}

function renderExpensesTable() {
    const tbody = document.getElementById('expenses-tbody');
    tbody.innerHTML = '';

    // Calculate sum of cash sales + credit payments
    let totalCashSales = 0;
    state.sales.forEach(sale => {
        if (sale.payment_status === 'Payé') {
            totalCashSales += parseFloat(sale.net_to_pay || 0);
        }
    });

    let totalCreditPayments = 0;
    // We can fetch from credit payments log or state. However, simple approximation sum is:
    state.credits.forEach(credit => {
        totalCreditPayments += parseFloat(credit.paid_amount || 0);
    });

    let totalExpensesSum = 0;
    state.expenses.forEach(e => {
        totalExpensesSum += parseFloat(e.amount || 0);
    });

    const netCaisse = totalCashSales + totalCreditPayments - totalExpensesSum;

    document.getElementById('caisse-stat-total').textContent = formatCurrency(netCaisse);
    document.getElementById('caisse-stat-expenses').textContent = formatCurrency(totalExpensesSum);

    if (state.expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-light); padding: 2rem;">Aucune dépense enregistrée.</td></tr>`;
        return;
    }

    state.expenses.forEach(expense => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(expense.created_at)}</td>
            <td class="bold">${escapeHTML(expense.title)}</td>
            <td><span class="badge" style="background:#F1F5F9; color:var(--text-main);">${escapeHTML(expense.category || 'Général')}</span></td>
            <td class="text-right bold" style="color: var(--danger);">${formatCurrency(expense.amount)}</td>
            <td>${escapeHTML(expense.notes || '-')}</td>
            <td>
                <button class="icon-btn icon-btn-danger btn-delete-expense" data-id="${expense.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0M4.5 18a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0019.5 18v-9.5A2.25 2.25 0 0017.25 6.25H6.75A2.25 2.25 0 004.5 8.5V18z" /></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-delete-expense').forEach(btn => {
        btn.addEventListener('click', () => deleteExpenseHandler(btn.getAttribute('data-id')));
    });
}

function renderStockTable() {
    const tbody = document.getElementById('stock-tbody');
    tbody.innerHTML = '';

    // Reset select all checkbox and hide bulk delete button on redraw
    const selectAllCheck = document.getElementById('stock-select-all');
    if (selectAllCheck) selectAllCheck.checked = false;
    const bulkDelBtn = document.getElementById('btn-delete-selected-stock');
    if (bulkDelBtn) bulkDelBtn.style.display = 'none';

    if (state.stock.length === 0) {
        const emptyText = document.documentElement.lang === 'ar' ? 'المخزون فارغ. يرجى التهيئة.' : 'Stock vide. Initialisation requise.';
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-light); padding: 2rem;">${emptyText}</td></tr>`;
        return;
    }

    // Filter stock by active operator tab
    const filtered = state.stock.filter(item => item.operator === state.activeStockOperator);
    
    // Sort recharges first, then SIM cards, sorted by value
    filtered.sort((a, b) => {
        if (a.product_type !== b.product_type) {
            return a.product_type === 'Recharge' ? -1 : 1;
        }
        const aVal = parseInt(a.product_name.replace(/\D/g, '')) || 0;
        const bVal = parseInt(b.product_name.replace(/\D/g, '')) || 0;
        return aVal - bVal;
    });

    if (filtered.length === 0) {
        const noItemsText = document.documentElement.lang === 'ar' ? 'لا توجد عناصر في المخزون لهذه الشركة.' : 'Aucun article en stock pour cet opérateur.';
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-light); padding: 2rem;">${noItemsText}</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        const isLow = item.quantity <= item.min_threshold;
        const statusClass = isLow ? 'badge-unpaid' : 'badge-paid';
        
        const isAr = document.documentElement.lang === 'ar';
        const statusText = isLow 
            ? (isAr ? 'مخزون منخفض' : 'Alerte Stock Bas') 
            : (isAr ? 'متوفر' : 'Disponible');
            
        const typeText = item.product_type === 'Recharge' 
            ? (isAr ? 'تعبئة' : 'Recharge') 
            : (isAr ? 'شريحة' : 'SIM');
            
        const qtyUnit = isAr ? 'قطعة' : 'Pcs';
        const restockText = isAr ? '+ توريد' : '+ Approvisionner';
        const operatorClass = item.operator === 'Maroc Telecom' ? 'badge-mt' : (item.operator === 'Orange' ? 'badge-orange' : 'badge-inwi');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="stock-item-select" data-id="${item.id}"></td>
            <td><span class="badge ${operatorClass}">${escapeHTML(item.operator)}</span></td>
            <td>${typeText}</td>
            <td class="bold">${escapeHTML(item.product_name)}</td>
            <td class="text-right bold" style="${isLow ? 'color: var(--danger); font-size:1.1rem;' : ''}">
                ${item.quantity} ${qtyUnit}
            </td>
            <td class="text-right">${item.min_threshold}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="flex gap-2">
                    <button class="btn btn-secondary btn-sm btn-quick-restock" data-id="${item.id}">
                        <span>${restockText}</span>
                    </button>
                    <button class="icon-btn icon-btn-danger btn-delete-stock" data-id="${item.id}" style="padding: 0.25rem 0.5rem; display: inline-flex; align-items: center; justify-content: center; height: 28px; width: 28px; border-radius: 4px; border: 1px solid var(--danger); background: none; color: var(--danger); cursor: pointer;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0M4.5 18a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0019.5 18v-9.5A2.25 2.25 0 0017.25 6.25H6.75A2.25 2.25 0 004.5 8.5V18z" /></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Helper to toggle bulk delete button
    const toggleBulkDeleteBtn = () => {
        const checkedCount = document.querySelectorAll('.stock-item-select:checked').length;
        if (bulkDelBtn) {
            bulkDelBtn.style.display = checkedCount > 0 ? 'inline-block' : 'none';
        }
    };

    // Attach row checkbox listeners
    document.querySelectorAll('.stock-item-select').forEach(chk => {
        chk.addEventListener('change', toggleBulkDeleteBtn);
    });

    // Attach Select All checkbox listener
    if (selectAllCheck) {
        selectAllCheck.addEventListener('change', () => {
            document.querySelectorAll('.stock-item-select').forEach(chk => {
                chk.checked = selectAllCheck.checked;
            });
            toggleBulkDeleteBtn();
        });
    }

    // Attach restock listeners
    document.querySelectorAll('.btn-quick-restock').forEach(btn => {
        btn.addEventListener('click', () => triggerQuickRestock(btn.getAttribute('data-id')));
    });

    // Attach delete listeners
    document.querySelectorAll('.btn-delete-stock').forEach(btn => {
        btn.addEventListener('click', () => deleteStockItemHandler(btn.getAttribute('data-id')));
    });
}

// Delete Stock Item (Reset Quantity to 0)
function deleteStockItemHandler(id) {
    const item = state.stock.find(s => s.id === id);
    if (!item) return;

    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'إفراغ المخزون؟' : 'Vider le stock ?',
        html: isAr 
            ? `<div style="text-align: right; direction: rtl;">هل تريد إعادة كمية "${item.product_name}" (${item.operator}) إلى 0؟</div>`
            : `Voulez-vous remettre à 0 la quantité de "${item.product_name}" (${item.operator}) ?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#64748B',
        confirmButtonText: isAr ? 'نعم، أفرغ' : 'Oui, vider',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري التحديث...' : 'Mise à jour...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            const { error } = await supabase.from('stock').update({ quantity: 0 }).eq('id', id);
            if (error) {
                Swal.fire(isAr ? 'خطأ' : 'Erreur', error.message, 'error');
            } else {
                Swal.fire({ icon: 'success', title: isAr ? 'تمت إعادة تعيين المخزون إلى 0' : 'Stock remis à 0', timer: 1200, showConfirmButton: false });
                loadDatabaseData();
            }
        }
    });
}

// Bulk Reset Stock Items Quantity to 0
function deleteSelectedStockItemsHandler() {
    const checkedBoxes = document.querySelectorAll('.stock-item-select:checked');
    const ids = Array.from(checkedBoxes).map(chk => chk.getAttribute('data-id'));
    
    if (ids.length === 0) return;

    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'إفراغ المحدد؟' : 'Vider la sélection ?',
        html: isAr 
            ? `<div style="text-align: right; direction: rtl;">هل تريد إعادة كمية ${ids.length} مواد محددة إلى 0؟</div>`
            : `Voulez-vous remettre à 0 la quantité des ${ids.length} articles sélectionnés ?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#64748B',
        confirmButtonText: isAr ? 'نعم، أفرغ الكل' : 'Oui, tout vider',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري التحديث...' : 'Mise à jour...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            const { error } = await supabase.from('stock').update({ quantity: 0 }).in('id', ids);
            if (error) {
                Swal.fire(isAr ? 'خطأ' : 'Erreur', error.message, 'error');
            } else {
                Swal.fire({ icon: 'success', title: isAr ? 'تمت إعادة تعيين المواد المحددة إلى 0' : 'Sélection réinitialisée à 0', timer: 1200, showConfirmButton: false });
                loadDatabaseData();
            }
        }
    });
}

// 5. CHART JS LOGIC
function updateDashboardCharts() {
    if (!state.sales || state.sales.length === 0) return;

    // A. Trend Line Chart
    // Extract sales by date for last 7 days
    const dailyData = {};
    for (let i = 6; i >= 0; i--) {
        const dateStr = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        dailyData[dateStr] = { net: 0, discount: 0 };
    }

    state.sales.forEach(sale => {
        const saleDate = new Date(sale.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        if (dailyData[saleDate] !== undefined) {
            dailyData[saleDate].net += parseFloat(sale.net_to_pay || 0);
            dailyData[saleDate].discount += parseFloat(sale.discount || 0);
        }
    });

    const labels = Object.keys(dailyData);
    const netData = labels.map(l => dailyData[l].net);
    const discData = labels.map(l => dailyData[l].discount);

    const trendCtx = document.getElementById('chart-sales-trend').getContext('2d');
    if (salesTrendChart) salesTrendChart.destroy();
    
    salesTrendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Chiffre Net (DH)',
                    data: netData,
                    borderColor: '#8B5CF6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35
                },
                {
                    label: 'Remises Accordées (DH)',
                    data: discData,
                    borderColor: '#EA580C',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.35
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { family: 'Outfit' } } }
            },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2, 2] } }
            }
        }
    });

    // B. Operator Distribution doughnut chart
    const operatorSums = { 'Maroc Telecom': 0, 'Orange': 0, 'Inwi': 0 };
    state.sales.forEach(sale => {
        if (operatorSums[sale.operator] !== undefined) {
            operatorSums[sale.operator] += parseFloat(sale.net_to_pay || 0);
        }
    });

    const distCtx = document.getElementById('chart-operator-distribution').getContext('2d');
    if (operatorDistChart) operatorDistChart.destroy();

    operatorDistChart = new Chart(distCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(operatorSums),
            datasets: [{
                data: Object.values(operatorSums),
                backgroundColor: [
                    OPERATOR_COLORS['Maroc Telecom'],
                    OPERATOR_COLORS['Orange'],
                    OPERATOR_COLORS['Inwi']
                ],
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: { family: 'Outfit' } } }
            }
        }
    });
}

// 6. ACTION FORMS (SweetAlert2 Modals)

// Create New Client
function triggerNewClientModal() {
    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'زبون جديد' : 'Nouveau Client',
        html: `
            <div style="text-align:${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'};">
                <div class="form-group">
                    <label>${isAr ? 'الاسم الكامل *' : 'Nom complet *'}</label>
                    <input type="text" id="modal-client-name" class="form-input" placeholder="${isAr ? 'مثال: عبد الحكيم الفتواكي' : 'Ex: Abdelhakim Fatouaki'}">
                </div>
                <div class="form-group">
                    <label>${isAr ? 'الهاتف' : 'Téléphone'}</label>
                    <input type="tel" id="modal-client-phone" class="form-input" placeholder="${isAr ? 'مثال: 0661712324' : 'Ex: +212 661-712324'}">
                </div>
                <div class="form-group">
                    <label>${isAr ? 'رقم الموزع' : 'Numéro Dealer'}</label>
                    <input type="text" id="modal-client-dealer" class="form-input" placeholder="${isAr ? 'مثال: DI1' : 'Ex: DI1'}">
                </div>
                <div class="form-group">
                    <label>${isAr ? 'النشاط' : 'Activité'}</label>
                    <select id="modal-client-activity" class="form-select">
                        <option value="AG : Alimentation Générale">${isAr ? 'بقالة عامة' : 'AG : Alimentation Générale'}</option>
                        <option value="VPA : Vente Portable et Accessoires">${isAr ? 'بيع الهواتف والإكسسوارات' : 'VPA : Vente Portable et Accessoires'}</option>
                        <option value="LP : Librairie & Papeterie">${isAr ? 'مكتبة ووراقة' : 'LP : Librairie & Papeterie'}</option>
                        <option value="Autre">${isAr ? 'آخر' : 'Autre'}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>${isAr ? 'العنوان' : 'Adresse'}</label>
                    <input type="text" id="modal-client-address" class="form-input" placeholder="${isAr ? 'مثال: الناظور، سلوان' : 'Ex: Nador, Selouane'}">
                </div>
                <div class="form-group">
                    <label>${isAr ? 'ملاحظات' : 'Notes'}</label>
                    <textarea id="modal-client-notes" class="form-textarea" placeholder="${isAr ? 'ملاحظات إضافية...' : 'Notes additionnelles...'}"></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: isAr ? 'إضافة' : 'Ajouter',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        confirmButtonColor: '#8B5CF6',
        preConfirm: () => {
            const name = document.getElementById('modal-client-name').value.trim();
            const phone = document.getElementById('modal-client-phone').value.trim();
            const dealer_number = document.getElementById('modal-client-dealer').value.trim();
            const activity = document.getElementById('modal-client-activity').value;
            const address = document.getElementById('modal-client-address').value.trim();
            const notes = document.getElementById('modal-client-notes').value.trim();

            if (!name) {
                Swal.showValidationMessage(isAr ? 'الاسم الكامل مطلوب' : 'Le nom complet est obligatoire');
                return false;
            }
            return { name, phone, dealer_number, activity, address, notes };
        },
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري الحفظ...' : 'Enregistrement...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            const { error } = await supabase.from('clients').insert([result.value]);
            if (error) {
                Swal.fire(isAr ? 'خطأ' : 'Erreur', error.message, 'error');
            } else {
                Swal.fire({ icon: 'success', title: isAr ? 'تمت إضافة الزبون' : 'Client ajouté', timer: 1500, showConfirmButton: false });
                loadDatabaseData();
            }
        }
    });
}

// Edit Client
async function editClientHandler(id) {
    const client = state.clients.find(c => c.id === id);
    if (!client) return;

    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'تعديل زبون' : 'Modifier Client',
        html: `
            <div style="text-align:${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'};">
                <div class="form-group">
                    <label>${isAr ? 'الاسم الكامل *' : 'Nom complet *'}</label>
                    <input type="text" id="modal-client-name" class="form-input" value="${escapeHTML(client.name)}">
                </div>
                <div class="form-group">
                    <label>${isAr ? 'الهاتف' : 'Téléphone'}</label>
                    <input type="tel" id="modal-client-phone" class="form-input" value="${escapeHTML(client.phone || '')}">
                </div>
                <div class="form-group">
                    <label>${isAr ? 'رقم الموزع' : 'Numéro Dealer'}</label>
                    <input type="text" id="modal-client-dealer" class="form-input" value="${escapeHTML(client.dealer_number || '')}">
                </div>
                <div class="form-group">
                    <label>${isAr ? 'النشاط' : 'Activité'}</label>
                    <select id="modal-client-activity" class="form-select">
                        <option value="AG : Alimentation Générale" ${client.activity === 'AG : Alimentation Générale' ? 'selected' : ''}>${isAr ? 'بقالة عامة' : 'AG : Alimentation Générale'}</option>
                        <option value="VPA : Vente Portable et Accessoires" ${client.activity === 'VPA : Vente Portable et Accessoires' ? 'selected' : ''}>${isAr ? 'بيع الهواتف والإكسسوارات' : 'VPA : Vente Portable et Accessoires'}</option>
                        <option value="LP : Librairie & Papeterie" ${client.activity === 'LP : Librairie & Papeterie' ? 'selected' : ''}>${isAr ? 'مكتبة ووراقة' : 'LP : Librairie & Papeterie'}</option>
                        <option value="Autre" ${client.activity === 'Autre' ? 'selected' : ''}>${isAr ? 'آخر' : 'Autre'}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>${isAr ? 'العنوان' : 'Adresse'}</label>
                    <input type="text" id="modal-client-address" class="form-input" value="${escapeHTML(client.address || '')}">
                </div>
                <div class="form-group">
                    <label>${isAr ? 'ملاحظات' : 'Notes'}</label>
                    <textarea id="modal-client-notes" class="form-textarea">${escapeHTML(client.notes || '')}</textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: isAr ? 'حفظ' : 'Enregistrer',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        confirmButtonColor: '#8B5CF6',
        preConfirm: () => {
            const name = document.getElementById('modal-client-name').value.trim();
            const phone = document.getElementById('modal-client-phone').value.trim();
            const dealer_number = document.getElementById('modal-client-dealer').value.trim();
            const activity = document.getElementById('modal-client-activity').value;
            const address = document.getElementById('modal-client-address').value.trim();
            const notes = document.getElementById('modal-client-notes').value.trim();

            if (!name) {
                Swal.showValidationMessage(isAr ? 'الاسم الكامل مطلوب' : 'Le nom complet est obligatoire');
                return false;
            }
            return { name, phone, dealer_number, activity, address, notes };
        },
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري التعديل...' : 'Mise à jour...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            const { error } = await supabase.from('clients').update(result.value).eq('id', id);
            if (error) {
                Swal.fire(isAr ? 'خطأ' : 'Erreur', error.message, 'error');
            } else {
                Swal.fire({ icon: 'success', title: isAr ? 'تم تعديل الزبون' : 'Fiche client mise à jour', timer: 1500, showConfirmButton: false });
                loadDatabaseData();
            }
        }
    });
}

// Delete Client
function deleteClientHandler(id) {
    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'هل أنت متأكد؟' : 'Êtes-vous sûr ?',
        text: isAr ? 'حذف الزبون لن يؤثر على السجل المالي الحالي.' : "La suppression du client n'affectera pas l'historique financier existant.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#64748B',
        confirmButtonText: isAr ? 'نعم، احذف' : 'Oui, supprimer',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { error } = await supabase.from('clients').delete().eq('id', id);
            if (error) {
                Swal.fire(isAr ? 'خطأ' : 'Erreur', error.message, 'error');
            } else {
                Swal.fire({ icon: 'success', title: isAr ? 'تم الحذف' : 'Supprimé', timer: 1200, showConfirmButton: false });
                loadDatabaseData();
            }
        }
    });
}

// Create New Sale (Multi-product cart checkout)
function triggerNewSaleModal(preselectedClientId = null) {
    const isAr = document.documentElement.lang === 'ar';
    
    if (state.clients.length === 0) {
        Swal.fire({
            icon: 'info',
            title: isAr ? 'لم يتم العثور على أي زبون' : 'Aucun client trouvé',
            text: isAr ? 'يرجى تسجيل زبون أولاً قبل إنشاء معاملة.' : 'Veuillez enregistrer un client avant de créer une transaction.',
            confirmButtonText: isAr ? 'إضافة زبون' : 'Ajouter un client',
            customClass: { popup: 'swal2-popup-custom' }
        }).then(() => {
            document.querySelector('.sidebar-link[data-target="clients"]').click();
            triggerNewClientModal();
        });
        return;
    }

    // Build options list for client select
    let clientOptions = '';
    state.clients.forEach(c => {
        const selectedAttr = (preselectedClientId && c.id === preselectedClientId) ? 'selected' : '';
        clientOptions += `<option value="${c.id}" ${selectedAttr}>${escapeHTML(c.name)} (${c.phone || (isAr ? 'بدون هاتف' : 'Pas de numéro')})</option>`;
    });

    let cart = []; // Local cart array

    Swal.fire({
        title: isAr ? 'بيع جديد' : 'Nouvelle Vente',
        html: `
            <div style="text-align:${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'}; max-height:85vh; overflow-y:auto; padding-right:5px;">
                <!-- 1. General Info -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-bottom:1rem;">
                    <div class="form-group" style="margin-bottom:0; position: relative;">
                        <label>${isAr ? 'اختر الزبون *' : 'Sélectionner le Client *'}</label>
                        <input type="text" id="modal-sale-client-search" class="form-select" placeholder="${isAr ? 'ابحث بالاسم أو الرقم...' : 'Rechercher par nom ou numéro...'}" autocomplete="off" style="width:100%;" />
                        <input type="hidden" id="modal-sale-client" value="" />
                        <div id="modal-sale-client-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: white; border: 1px solid var(--border); border-radius: var(--radius-md); z-index: 1000; box-shadow: var(--shadow-md); margin-top: 4px;"></div>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label>${isAr ? 'حالة الدفع' : 'Statut de Paiement'}</label>
                        <select id="modal-sale-payment" class="form-select">
                            <option value="Payé">${isAr ? 'مدفوع (نقداً/كاش)' : 'Payé (Comptant/Espèces)'}</option>
                            <option value="En Crédit">${isAr ? 'دين (الدفع لاحقاً)' : 'En Crédit (À payer plus tard)'}</option>
                        </select>
                    </div>
                </div>
                
                <!-- 2. Product Entry Panel -->
                <div style="background-color:#F8FAFC; border:1px solid var(--border); border-radius:var(--radius-md); padding:0.75rem; margin-bottom:1rem;">
                    <h5 style="font-weight:700; color:#4C1D95; margin-bottom:0.5rem; font-size:0.85rem;">${isAr ? 'إضافة منتج' : 'Ajouter un produit'}</h5>
                    
                    <div class="form-group" style="margin-bottom:0.75rem;">
                        <label style="font-size:0.75rem;">${isAr ? 'الشركة *' : 'Opérateur *'}</label>
                        <div class="operator-selector" style="transform: scale(0.95); transform-origin: ${isAr ? 'right' : 'left'};">
                            <div class="operator-pill selected" data-operator="Maroc Telecom">MT</div>
                            <div class="operator-pill" data-operator="Orange">Orange</div>
                            <div class="operator-pill" data-operator="Inwi">Inwi</div>
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.75rem;">${isAr ? 'نوع المنتج *' : 'Type de produit *'}</label>
                            <select id="modal-sale-type" class="form-select" style="padding:0.4rem 0.6rem; font-size:0.8rem;">
                                <option value="Recharge">${isAr ? 'تعبئة' : 'Recharge'}</option>
                                <option value="SIM">${isAr ? 'شريحة SIM' : 'Carte SIM'}</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.75rem;">${isAr ? 'اسم المنتج *' : 'Désignation Article *'}</label>
                            <select id="modal-sale-artname" class="form-select" style="padding:0.4rem 0.6rem; font-size:0.8rem;">
                                <!-- Dynamically populated -->
                            </select>
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1.2fr 1fr 1.2fr; gap:0.5rem; margin-bottom:0.75rem; align-items:flex-end;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.75rem;">${isAr ? 'الكمية' : 'Quantité'}</label>
                            <input type="number" id="modal-sale-qty" class="form-input" value="1" min="1" style="padding:0.4rem 0.6rem; font-size:0.8rem;">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.75rem;">${isAr ? 'سعر الوحدة (د.م.) *' : 'Prix unitaire (DH) *'}</label>
                            <input type="number" id="modal-sale-price" class="form-input" value="50" min="0" step="any" style="padding:0.4rem 0.6rem; font-size:0.8rem;">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:0.75rem;">${isAr ? 'التخفيض (%)' : 'Remise (%)'}</label>
                            <input type="number" id="modal-sale-item-discount" class="form-input" min="0" max="100" step="any" placeholder="0" style="padding:0.4rem 0.6rem; font-size:0.8rem;">
                        </div>
                        <button type="button" class="btn btn-primary btn-sm" id="btn-add-to-cart" style="height:32px; padding:0; background-color:var(--success); font-size:0.8rem; font-weight:600;">
                            ${isAr ? '+ إضافة' : '+ Ajouter'}
                        </button>
                    </div>
                </div>
                
                <!-- 3. Basket / Cart List -->
                <h5 style="font-weight:700; color:#4C1D95; margin-bottom:0.5rem; font-size:0.85rem;">${isAr ? 'سلة المبيعات' : 'Panier des articles'}</h5>
                <div style="border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; margin-bottom:1rem; max-height:150px; overflow-y:auto; background:white;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.75rem; text-align:${isAr ? 'right' : 'left'};">
                        <thead>
                            <tr style="background:#F1F5F9; border-bottom:1px solid var(--border);">
                                <th style="padding:0.35rem 0.5rem; text-align:${isAr ? 'right' : 'left'};">${isAr ? 'المنتج' : 'Article'}</th>
                                <th style="padding:0.35rem 0.5rem; text-align:${isAr ? 'right' : 'left'};">${isAr ? 'الشركة' : 'Opérateur'}</th>
                                <th style="padding:0.35rem 0.5rem; text-align:${isAr ? 'left' : 'right'};">${isAr ? 'الكمية' : 'Qté'}</th>
                                <th style="padding:0.35rem 0.5rem; text-align:${isAr ? 'left' : 'right'};">${isAr ? 'السعر' : 'P.U.'}</th>
                                <th style="padding:0.35rem 0.5rem; text-align:${isAr ? 'left' : 'right'};">${isAr ? 'تخفيض (%)' : 'Remise (%)'}</th>
                                <th style="padding:0.35rem 0.5rem; text-align:${isAr ? 'left' : 'right'};">${isAr ? 'المجموع' : 'Total'}</th>
                                <th style="padding:0.35rem 0.5rem; text-align:center; width:30px;"></th>
                            </tr>
                        </thead>
                        <tbody id="modal-cart-tbody">
                            <tr><td colspan="7" style="text-align:center; color:var(--text-light); padding:1rem;">${isAr ? 'السلة فارغة.' : 'Panier vide.'}</td></tr>
                        </tbody>
                    </table>
                </div>
                
                <!-- 4. Net à Payer -->
                <div style="display:grid; grid-template-columns: 1fr; gap:0.75rem; align-items:center; border-top:1px dashed var(--border); padding-top:1rem;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label style="font-weight:600; font-size:0.8rem;">${isAr ? 'الصافي الإجمالي للأداء (د.م.)' : 'Net à Payer Total (DH)'}</label>
                        <input type="text" id="modal-sale-net" class="form-input" value="0.00 DH" disabled style="font-weight:800; color:var(--primary-hover); font-size:1.15rem; background-color:var(--primary-light); text-align:center;">
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: isAr ? 'تسجيل البيع' : 'Enregistrer la vente',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        confirmButtonColor: '#EF4444',
        didOpen: () => {
            // Custom Searchable Dropdown for Client
            const searchInput = document.getElementById('modal-sale-client-search');
            const clientHiddenInput = document.getElementById('modal-sale-client');
            const dropdown = document.getElementById('modal-sale-client-dropdown');

            const filterClients = (searchText) => {
                const query = searchText.toLowerCase().trim();
                const filtered = state.clients.filter(c => 
                    (c.name || '').toLowerCase().includes(query) || 
                    (c.phone || '').toLowerCase().includes(query) ||
                    (c.dealer_number || '').toLowerCase().includes(query)
                );
                
                dropdown.innerHTML = '';
                if (filtered.length === 0) {
                    dropdown.innerHTML = `<div style="padding: 8px 12px; color: var(--text-light); font-size: 0.85rem;">${isAr ? 'لا يوجد زبائن' : 'Aucun client trouvé'}</div>`;
                } else {
                    filtered.forEach(c => {
                        const item = document.createElement('div');
                        item.style.padding = '8px 12px';
                        item.style.cursor = 'pointer';
                        item.style.borderBottom = '1px solid #F1F5F9';
                        item.style.fontSize = '0.85rem';
                        item.style.textAlign = isAr ? 'right' : 'left';
                        item.innerHTML = `
                            <div style="font-weight: 600; color: var(--text-main);">${escapeHTML(c.name)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-light);">${escapeHTML(c.phone || (isAr ? 'بدون هاتف' : 'Pas de numéro'))} ${c.dealer_number ? ` | Dealer: ${escapeHTML(c.dealer_number)}` : ''}</div>
                        `;
                        
                        item.addEventListener('mouseenter', () => {
                            item.style.backgroundColor = '#F1F5F9';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.backgroundColor = 'transparent';
                        });
                        item.addEventListener('mousedown', (e) => {
                            e.preventDefault();
                            searchInput.value = `${c.name} (${c.phone || ''})`;
                            clientHiddenInput.value = c.id;
                            dropdown.style.display = 'none';
                        });
                        dropdown.appendChild(item);
                    });
                }
            };

            // Preselect if requested
            if (preselectedClientId) {
                const c = state.clients.find(c => c.id === preselectedClientId);
                if (c) {
                    searchInput.value = `${c.name} (${c.phone || ''})`;
                    clientHiddenInput.value = c.id;
                }
            } else {
                // Keep input empty by default
                searchInput.value = '';
                clientHiddenInput.value = '';
            }

            searchInput.addEventListener('focus', () => {
                filterClients(searchInput.value);
                dropdown.style.display = 'block';
            });

            searchInput.addEventListener('input', () => {
                filterClients(searchInput.value);
                dropdown.style.display = 'block';
            });

            searchInput.addEventListener('blur', () => {
                setTimeout(() => {
                    dropdown.style.display = 'none';
                    const currentId = clientHiddenInput.value;
                    const currentClient = state.clients.find(c => c.id === currentId);
                    if (currentClient) {
                        searchInput.value = `${currentClient.name} (${currentClient.phone || ''})`;
                    } else if (searchInput.value.trim() === '') {
                        clientHiddenInput.value = '';
                    } else {
                        searchInput.value = '';
                        clientHiddenInput.value = '';
                    }
                }, 200);
            });

            const qtyIn = document.getElementById('modal-sale-qty');
            const priceIn = document.getElementById('modal-sale-price');
            const typeIn = document.getElementById('modal-sale-type');
            const nameIn = document.getElementById('modal-sale-artname');
            const itemDiscountIn = document.getElementById('modal-sale-item-discount');
            const addToCartBtn = document.getElementById('btn-add-to-cart');

            const updateUnitPriceFromSelectedArticle = () => {
                const val = nameIn.value;
                if (!val) {
                    priceIn.value = 0;
                    return;
                }
                const match = val.match(/Recharge\s+(\d+)\s*DH/i);
                if (match) {
                    priceIn.value = parseFloat(match[1]);
                } else if (val.startsWith('Carte SIM') || val.startsWith('SIM')) {
                    priceIn.value = 30; // default SIM price
                } else {
                    priceIn.value = 0;
                }
            };

            const populateSaleArticleOptions = () => {
                const operator = document.querySelector('.operator-pill.selected').getAttribute('data-operator');
                const product_type = typeIn.value;
                
                // Get matching items from state.stock
                const items = state.stock.filter(s => s.operator === operator && s.product_type === product_type);
                
                // Sort recharges by value, SIM cards by name
                items.sort((a, b) => {
                    if (product_type === 'Recharge') {
                        const aVal = parseInt(a.product_name.replace(/\D/g, '')) || 0;
                        const bVal = parseInt(b.product_name.replace(/\D/g, '')) || 0;
                        return aVal - bVal;
                    }
                    return a.product_name.localeCompare(b.product_name);
                });

                nameIn.innerHTML = '';
                items.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item.product_name;
                    opt.textContent = `${item.product_name} (${isAr ? 'مخزون' : 'Stock'}: ${item.quantity})`;
                    nameIn.appendChild(opt);
                });

                updateUnitPriceFromSelectedArticle();
            };

            const pills = document.querySelectorAll('.operator-pill');
            pills.forEach(p => {
                p.addEventListener('click', () => {
                    pills.forEach(p2 => p2.classList.remove('selected'));
                    p.classList.add('selected');
                    populateSaleArticleOptions();
                });
            });

            nameIn.addEventListener('change', updateUnitPriceFromSelectedArticle);

            typeIn.addEventListener('change', () => {
                populateSaleArticleOptions();
            });

            // Add product to cart handler
            addToCartBtn.addEventListener('click', () => {
                const operator = document.querySelector('.operator-pill.selected').getAttribute('data-operator');
                const product_type = typeIn.value;
                const product_name = nameIn.value.trim();
                const quantity = parseInt(qtyIn.value || 0);
                const unit_price = parseFloat(priceIn.value || 0);
                const discount_pct = parseFloat(itemDiscountIn.value || 0);

                if (!product_name) {
                    Swal.showValidationMessage(isAr ? "اسم المادة مطلوب" : "Désignation de l'article requise");
                    return;
                }
                if (quantity <= 0) {
                    Swal.showValidationMessage(isAr ? 'يجب أن تكون الكمية أكبر من 0' : 'La quantité doit être supérieure à 0');
                    return;
                }

                // Check stock availability
                const stockItem = state.stock.find(s => s.operator === operator && s.product_type === product_type && s.product_name === product_name);
                const alreadyAdded = cart.filter(c => c.operator === operator && c.product_type === product_type && c.product_name === product_name).reduce((sum, item) => sum + item.quantity, 0);
                
                if (stockItem && stockItem.quantity < (alreadyAdded + quantity)) {
                    Swal.showValidationMessage(isAr ? `المخزون غير كاف لـ ${product_name}. المتوفر : ${stockItem.quantity - alreadyAdded}` : `Stock insuffisant pour ${product_name}. En stock : ${stockItem.quantity - alreadyAdded}`);
                    return;
                }

                // Add item
                const total_brut = quantity * unit_price;
                const discount_amount = total_brut * (discount_pct / 100);
                const total_net = total_brut - discount_amount;

                cart.push({
                    operator,
                    product_type,
                    product_name,
                    quantity,
                    unit_price,
                    discount_pct,
                    discount_amount,
                    total: total_net
                });

                renderCartRows();
                recalculateCartTotal();

                // Reset item entry fields
                qtyIn.value = 1;
                itemDiscountIn.value = 0;
                populateSaleArticleOptions();
            });

            function renderCartRows() {
                const tbody = document.getElementById('modal-cart-tbody');
                tbody.innerHTML = '';
                
                if (cart.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-light); padding:1rem;">${isAr ? 'السلة فارغة.' : 'Panier vide.'}</td></tr>`;
                    return;
                }

                cart.forEach((item, index) => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid var(--border)';
                    tr.innerHTML = `
                        <td style="padding:0.35rem 0.5rem; font-weight:600; text-align:${isAr ? 'right' : 'left'};">${escapeHTML(item.product_name)}</td>
                        <td style="padding:0.35rem 0.5rem; text-align:${isAr ? 'right' : 'left'};">${escapeHTML(item.operator)}</td>
                        <td style="padding:0.35rem 0.5rem; text-align:${isAr ? 'left' : 'right'};">${item.quantity}</td>
                        <td style="padding:0.35rem 0.5rem; text-align:${isAr ? 'left' : 'right'};">${item.unit_price.toFixed(2)}</td>
                        <td style="padding:0.35rem 0.5rem; text-align:${isAr ? 'left' : 'right'};">${item.discount_pct.toFixed(1)}%</td>
                        <td style="padding:0.35rem 0.5rem; text-align:${isAr ? 'left' : 'right'}; font-weight:600;">${item.total.toFixed(2)}</td>
                        <td style="padding:0.35rem 0.5rem; text-align:center;">
                            <button type="button" class="btn-delete-cart-item" data-index="${index}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.1rem; padding:0;">×</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                // Attach delete listeners
                document.querySelectorAll('.btn-delete-cart-item').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const idx = parseInt(btn.getAttribute('data-index'));
                        cart.splice(idx, 1);
                        renderCartRows();
                        recalculateCartTotal();
                    });
                });
            }

            function recalculateCartTotal() {
                const totalNet = cart.reduce((sum, item) => sum + item.total, 0);
                document.getElementById('modal-sale-net').value = totalNet.toFixed(2) + ' DH';
            }

            // Initial population
            populateSaleArticleOptions();
        },
        preConfirm: () => {
            const client_id = document.getElementById('modal-sale-client').value;
            const payment_status = document.getElementById('modal-sale-payment').value;

            if (!client_id) {
                Swal.showValidationMessage(isAr ? 'يرجى اختيار زبون صحيح' : 'Veuillez sélectionner un client valide');
                return false;
            }
            if (cart.length === 0) {
                Swal.showValidationMessage(isAr ? 'يرجى إضافة منتج واحد على الأقل إلى السلة' : 'Veuillez ajouter au moins un produit au panier');
                return false;
            }

            return { client_id, payment_status, cart };
        },
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري تسجيل البيع...' : 'Enregistrement de la vente...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            try {
                const { client_id, payment_status, cart: itemsToSell } = result.value;
                const invoiceRef = `Facture REF-${Date.now()}`;
                
                let totalInvoiceNet = 0;
                let firstInsertedSaleId = null;

                // Loop through items in cart to insert and update stock
                for (let item of itemsToSell) {
                    const itemBrut = item.quantity * item.unit_price;
                    const itemDiscount = item.discount_amount;
                    const itemNet = item.total;
                    totalInvoiceNet += itemNet;

                    const saleRow = {
                        client_id,
                        operator: item.operator,
                        product_type: item.product_type,
                        product_name: item.product_name,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_brut: itemBrut,
                        discount: itemDiscount,
                        net_to_pay: itemNet,
                        payment_status,
                        notes: invoiceRef
                    };

                    const { data: salesInserted, error: saleErr } = await supabase.from('sales').insert([saleRow]).select();
                    if (saleErr) throw saleErr;
                    
                    if (!firstInsertedSaleId && salesInserted && salesInserted.length > 0) {
                        firstInsertedSaleId = salesInserted[0].id;
                    }

                    // Decrement Stock
                    const stockItem = state.stock.find(s => s.operator === item.operator && s.product_type === item.product_type && s.product_name === item.product_name);
                    if (stockItem) {
                        const newQty = stockItem.quantity - item.quantity;
                        await supabase.from('stock').update({ quantity: newQty }).eq('id', stockItem.id);
                    }
                }

                // If "En Crédit", create ONE credit record for the total invoice net amount
                if (payment_status === 'En Crédit') {
                    const creditData = {
                        sale_id: firstInsertedSaleId, // link to the first item sale
                        client_id,
                        total_amount: totalInvoiceNet,
                        paid_amount: 0,
                        remaining_amount: totalInvoiceNet,
                        status: 'Non payé'
                    };
                    const { error: creditErr } = await supabase.from('credits').insert([creditData]);
                    if (creditErr) throw creditErr;
                }

                Swal.fire({ icon: 'success', title: isAr ? 'تم تسجيل البيع' : 'Vente enregistrée', timer: 1500, showConfirmButton: false });
                loadDatabaseData();

                const clientObj = state.clients.find(c => c.id === client_id) || { name: 'Client Inconnu', phone: '' };
                const receiptItems = itemsToSell.map(item => ({
                    product_name: item.product_name,
                    operator: item.operator,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount_pct: item.discount_pct || 0,
                    discount: item.discount_amount || 0,
                    total: item.total
                }));
                setTimeout(() => {
                    renderAndShowInvoiceModal(clientObj, payment_status, receiptItems, invoiceRef, new Date().toISOString());
                }, 1200);
            } catch (err) {
                console.error(err);
                Swal.fire(isAr ? 'خطأ أثناء التسجيل' : 'Erreur lors de l\'enregistrement', err.message, 'error');
            }
        }
    });
}


// Delete Sale Transaction
function deleteSaleHandler(id) {
    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'إلغاء هذه البيعة؟' : 'Annuler cette vente ?',
        html: isAr 
            ? "<div style='text-align: right; direction: rtl;'>سيتم حذف مبلغ البيع والديون المرتبطة به. وسيتم إرجاع الكمية إلى المخزون تلقائيًا.</div>"
            : "Le montant de la vente et les dettes associées seront supprimés. La quantité sera automatiquement retournée au stock.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#64748B',
        confirmButtonText: isAr ? 'نعم، إلغاء البيع' : 'Oui, annuler la vente',
        cancelButtonText: isAr ? 'رجوع' : 'Retour',
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: isAr ? 'جاري إلغاء البيع...' : 'Annulation de la vente...',
                didOpen: () => Swal.showLoading(),
                allowOutsideClick: false
            });

            try {
                // Find the sale details
                let saleItem = state.sales.find(s => s.id === id);
                if (!saleItem) {
                    const { data: dbSales, error: fetchErr } = await supabase.from('sales').select('*').eq('id', id);
                    if (fetchErr) throw fetchErr;
                    if (dbSales && dbSales.length > 0) {
                        saleItem = dbSales[0];
                    }
                }

                if (saleItem) {
                    // Locate matching stock item
                    const stockItem = state.stock.find(s => 
                        s.operator === saleItem.operator && 
                        s.product_type === saleItem.product_type && 
                        s.product_name === saleItem.product_name
                    );

                    if (stockItem) {
                        // Return the quantity to stock
                        const newQty = stockItem.quantity + saleItem.quantity;
                        const { error: stockErr } = await supabase.from('stock').update({ quantity: newQty }).eq('id', stockItem.id);
                        if (stockErr) throw stockErr;
                    }
                }

                // Delete the sale from Supabase
                const { error: deleteErr } = await supabase.from('sales').delete().eq('id', id);
                if (deleteErr) throw deleteErr;

                Swal.fire({ icon: 'success', title: isAr ? 'تم إلغاء البيع وإرجاع المخزون' : 'Vente annulée et stock retourné', timer: 1500, showConfirmButton: false });
                loadDatabaseData();
            } catch (err) {
                console.error(err);
                Swal.fire(isAr ? 'خطأ' : 'Erreur', err.message, 'error');
            }
        }
    });
}

// Settle Credit Debt
function settleCreditHandler(id) {
    const credit = state.credits.find(c => c.id === id);
    if (!credit) return;

    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'تسوية الدين' : 'Règlement de Crédit',
        html: `
            <div style="text-align:${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'};">
                <div style="background-color:var(--bg-main); padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem; border:1px solid var(--border);">
                    <div style="font-size:0.8rem; color:var(--text-muted);">${isAr ? 'الزبون :' : 'Client :'}</div>
                    <div style="font-weight:700; font-size:1rem;">${escapeHTML(credit.clients.name)}</div>
                    <div style="display:flex; justify-content:space-between; margin-top:0.5rem; border-top:1px dashed var(--border); padding-top:0.5rem; flex-direction: ${isAr ? 'row-reverse' : 'row'};">
                        <span>${isAr ? 'الدين المتبقي :' : 'Dette restante :'}</span>
                        <span style="font-weight:700; color:var(--danger);">${formatCurrency(credit.remaining_amount)}</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>${isAr ? 'مبلغ الدفعة (درهم) *' : 'Montant du versement (DH) *'}</label>
                    <input type="number" id="modal-payment-amount" class="form-input" min="1" max="${credit.remaining_amount}" value="${credit.remaining_amount}" step="any">
                </div>
                
                <div class="form-group">
                    <label>${isAr ? 'ملاحظات / المرجع' : 'Notes / Référence'}</label>
                    <input type="text" id="modal-payment-notes" class="form-input" placeholder="${isAr ? 'مثال: دفع نقدي، شيك...' : 'Ex: Versement espèces, chèque...'}">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: isAr ? 'تسجيل الدفعة' : 'Enregistrer le versement',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        confirmButtonColor: '#10B981',
        preConfirm: () => {
            const amount = parseFloat(document.getElementById('modal-payment-amount').value || 0);
            const notes = document.getElementById('modal-payment-notes').value.trim();

            if (amount <= 0) {
                Swal.showValidationMessage(isAr ? 'يجب أن يكون المبلغ أكبر من 0' : 'Le montant doit être supérieur à 0');
                return false;
            }
            if (amount > credit.remaining_amount) {
                Swal.showValidationMessage(isAr ? `لا يمكن أن تتجاوز الدفعة الدين (${credit.remaining_amount} درهم)` : `Le versement ne peut excéder la dette (${credit.remaining_amount} DH)`);
                return false;
            }
            return { amount, notes };
        },
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري تسجيل الدفع...' : 'Validation du paiement...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            const payData = result.value;
            const newPaid = parseFloat(credit.paid_amount || 0) + payData.amount;
            const newRemaining = parseFloat(credit.total_amount) - newPaid;
            
            let newStatus = 'Partiellement payé';
            if (newRemaining <= 0) newStatus = 'Payé';

            // 1. Update credits table
            const { error: creditErr } = await supabase.from('credits').update({
                paid_amount: newPaid,
                remaining_amount: newRemaining,
                status: newStatus
            }).eq('id', id);

            if (creditErr) {
                Swal.fire(isAr ? 'خطأ' : 'Erreur', creditErr.message, 'error');
                return;
            }

            // 2. Insert into payments history log
            await supabase.from('credit_payments').insert([
                { credit_id: id, amount: payData.amount, notes: payData.notes }
            ]);

            Swal.fire({ icon: 'success', title: isAr ? 'تم تسجيل الدفع' : 'Paiement enregistré', timer: 1500, showConfirmButton: false });
            loadDatabaseData();
        }
    });
}

// Log New Expense
function triggerNewExpenseModal() {
    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'تسجيل مصاريف' : 'Enregistrer un Frais',
        html: `
            <div style="text-align:${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'};">
                <div class="form-group">
                    <label>${isAr ? 'العنوان / الوصف *' : 'Intitulé / Désignation *'}</label>
                    <input type="text" id="modal-expense-title" class="form-input" placeholder="${isAr ? 'مثال: كراء المحل، الكهرباء' : 'Ex: Loyer boutique, Électricité'}">
                </div>
                <div class="form-group">
                    <label>${isAr ? 'الفئة' : 'Catégorie'}</label>
                    <select id="modal-expense-category" class="form-select">
                        <option value="Loyer / Charges">${isAr ? 'الكراء / المصاريف العامة' : 'Loyer / Charges'}</option>
                        <option value="Logistique / Transport">${isAr ? 'اللوجستيك / النقل' : 'Logistique / Transport'}</option>
                        <option value="Fournitures Bureau">${isAr ? 'لوازم المكتب' : 'Fournitures Bureau'}</option>
                        <option value="Divers / Imprévus">${isAr ? 'متنوعة / غير متوقعة' : 'Divers / Imprévus'}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>${isAr ? 'المبلغ (درهم) *' : 'Montant (DH) *'}</label>
                    <input type="number" id="modal-expense-amount" class="form-input" min="1" step="any" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>${isAr ? 'ملاحظات إضافية' : 'Notes additionnelles'}</label>
                    <textarea id="modal-expense-notes" class="form-textarea" placeholder="${isAr ? 'تفاصيل الدفع...' : 'Détails du paiement...'}"></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: isAr ? 'تسجيل' : 'Enregistrer',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        confirmButtonColor: '#FF6600',
        preConfirm: () => {
            const title = document.getElementById('modal-expense-title').value.trim();
            const category = document.getElementById('modal-expense-category').value;
            const amount = parseFloat(document.getElementById('modal-expense-amount').value || 0);
            const notes = document.getElementById('modal-expense-notes').value.trim();

            if (!title) {
                Swal.showValidationMessage(isAr ? 'العنوان مطلوب' : "L'intitulé est obligatoire");
                return false;
            }
            if (amount <= 0) {
                Swal.showValidationMessage(isAr ? 'يجب أن يكون المبلغ أكبر من 0' : 'Le montant doit être supérieur à 0');
                return false;
            }
            return { title, category, amount, notes };
        },
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري التسجيل...' : 'Enregistrement...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            const { error } = await supabase.from('expenses').insert([result.value]);
            if (error) {
                Swal.fire(isAr ? 'خطأ' : 'Erreur', error.message, 'error');
            } else {
                Swal.fire({ icon: 'success', title: isAr ? 'تم تسجيل المصاريف' : 'Frais enregistré', timer: 1500, showConfirmButton: false });
                loadDatabaseData();
            }
        }
    });
}

// Delete Expense Log
function deleteExpenseHandler(id) {
    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'حذف هذه المصاريف؟' : 'Supprimer ce frais ?',
        html: isAr 
            ? `<div style="text-align: right; direction: rtl;">سيتم إعادة إضافة المبلغ إلى رصيد الصندوق الصافي.</div>`
            : 'Le montant sera ré-additionné au fonds de caisse net.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#64748B',
        confirmButtonText: isAr ? 'نعم، احذف' : 'Oui, supprimer',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { error } = await supabase.from('expenses').delete().eq('id', id);
            if (error) {
                Swal.fire(isAr ? 'خطأ' : 'Erreur', error.message, 'error');
            } else {
                Swal.fire({ icon: 'success', title: isAr ? 'تم حذف المصاريف' : 'Dépense supprimée', timer: 1200, showConfirmButton: false });
                loadDatabaseData();
            }
        }
    });
}

// Quick Restock stock items
async function triggerQuickRestock(id) {
    const item = state.stock.find(s => s.id === id);
    if (!item) return;

    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'تزويد المخزون' : 'Approvisionner Stock',
        html: `
            <div style="text-align:${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'};">
                <div style="margin-bottom: 1rem; font-size: 0.9rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; color: var(--text-main);">
                    ${isAr 
                        ? `إضافة مخزون لـ : <b>${escapeHTML(item.product_name)}</b> (${escapeHTML(item.operator)})` 
                        : `Ajouter du stock pour : <b>${escapeHTML(item.product_name)}</b> (${escapeHTML(item.operator)})`}
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>${isAr ? 'الكمية المراد إضافتها *' : 'Quantité à ajouter *'}</label>
                    <input type="number" id="quick-restock-qty" class="form-input" min="1" step="1" value="100" style="padding: 0.4rem 0.6rem; font-size: 0.85rem; background-color: white;">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>${isAr ? 'التخفيض (%)' : 'Remise (%)'}</label>
                    <input type="number" id="quick-restock-discount" class="form-input" min="0" max="100" placeholder="0" style="padding: 0.4rem 0.6rem; font-size: 0.85rem; background-color: white;">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: isAr ? 'توريد' : 'Approvisionner',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#64748B',
        preConfirm: () => {
            const quantity = parseInt(document.getElementById('quick-restock-qty').value || 0);
            const discount = parseFloat(document.getElementById('quick-restock-discount').value || 0);

            if (quantity <= 0) {
                Swal.showValidationMessage(isAr ? 'يرجى إدخال كمية أكبر من 0' : 'Veuillez saisir une quantité supérieure à 0');
                return false;
            }

            return { quantity, discount };
        },
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري تحديث المخزون...' : 'Mise à jour du stock...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            const { quantity, discount } = result.value;
            const newQty = item.quantity + quantity;

            try {
                const { error: stockErr } = await supabase.from('stock').update({ quantity: newQty }).eq('id', id);
                if (stockErr) throw stockErr;

                // Log in stock_history
                const historyRow = {
                    operator: item.operator,
                    product_type: item.product_type,
                    product_name: item.product_name,
                    quantity: quantity,
                    discount: discount,
                    vendor: '-- Central Admin Stock --',
                    notes: 'Quick Restock / توريد سريع'
                };
                const { error: histErr } = await supabase.from('stock_history').insert([historyRow]);
                if (histErr) throw histErr;

                Swal.fire({ icon: 'success', title: isAr ? 'تم تحديث المخزون' : 'Stock mis à jour', timer: 1500, showConfirmButton: false });
                loadDatabaseData();
            } catch (err) {
                console.error(err);
                Swal.fire(isAr ? 'خطأ' : 'Erreur', err.message, 'error');
            }
        }
    });
}

// Add New Stock Item (Restocking Invoice)
function triggerAddStockModal() {
    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'توريد جديد (فاتورة)' : 'Nouvel Approvisionnement (Facture)',
        html: `
            <div style="text-align:${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'}; max-height:80vh; overflow-y:auto; padding-right:5px;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-bottom:1rem;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label>${isAr ? 'رقم الفاتورة' : 'Numéro de Facture'}</label>
                        <input type="text" id="modal-invoice-num" class="form-input" placeholder="${isAr ? 'مثال: 1233322' : 'Ex: 1233322'}">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label>${isAr ? 'التخفيض (%)' : 'Remise (%)'}</label>
                        <input type="number" id="modal-invoice-discount" class="form-input" min="0" max="100" placeholder="0">
                    </div>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-bottom:1rem;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label>${isAr ? 'الشركة *' : 'Opérateur *'}</label>
                        <select id="modal-invoice-operator" class="form-select">
                            <option value="Maroc Telecom">Maroc Telecom</option>
                            <option value="Orange">Orange</option>
                            <option value="Inwi">Inwi</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label>${isAr ? 'البائع / المستلم' : 'Vendeur / Destinataire'}</label>
                        <select id="modal-invoice-vendor" class="form-select">
                            <option value="-- Central Admin Stock --">${isAr ? '-- مخزن الإدارة المركزي --' : '-- Central Admin Stock --'}</option>
                            <option value="Grossiste Telecom Nador">${isAr ? 'تاجر جملة اتصالات الناظور' : 'Grossiste Telecom Nador'}</option>
                            <option value="Distributeur Régional">${isAr ? 'الموزع الإقليمي' : 'Distributeur Régional'}</option>
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom:1rem;">
                    <label>${isAr ? 'ملاحظات / ملاحظات' : 'Notes / Observations'}</label>
                    <input type="text" id="modal-invoice-notes" class="form-input" placeholder="${isAr ? 'مثال: وصول شحنة أورنج/اتصالات' : 'Ex: Arrivage Orange/Telecom'}">
                </div>
                
                <h4 style="font-weight:700; color:#4C1D95; margin-bottom:0.5rem; border-bottom:2px solid var(--border); padding-bottom:0.25rem; font-size:0.9rem;">${isAr ? 'الكميات لكل منتج' : 'Quantités par article'}</h4>
                <div id="modal-invoice-products-container" style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; max-height:280px; overflow-y:auto; padding: 0.25rem;">
                    <!-- Populated dynamically by Operator selection -->
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: isAr ? 'حفظ' : 'Enregistrer',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        confirmButtonColor: '#8B5CF6',
        didOpen: () => {
            const opIn = document.getElementById('modal-invoice-operator');
            
            // Helper to render articles for selected operator
            const renderList = (operator) => {
                const container = document.getElementById('modal-invoice-products-container');
                container.innerHTML = '';
                
                // Get items in state.stock matching operator
                const items = state.stock.filter(s => s.operator === operator);
                
                // Sort recharges first, then SIM cards
                items.sort((a, b) => {
                    if (a.product_type !== b.product_type) {
                        return a.product_type === 'Recharge' ? -1 : 1;
                    }
                    const aVal = parseInt(a.product_name.replace(/\D/g, '')) || 0;
                    const bVal = parseInt(b.product_name.replace(/\D/g, '')) || 0;
                    return aVal - bVal;
                });

                if (items.length === 0) {
                    container.innerHTML = `<div style="grid-column: span 2; text-align:center; color:var(--text-light); padding:1rem;">${isAr ? 'لم يتم العثور على أي منتج. يرجى تهيئة البيانات الافتراضية.' : 'Aucun article trouvé. Veuillez initialiser les données par défaut.'}</div>`;
                    return;
                }

                items.forEach(item => {
                    const div = document.createElement('div');
                    div.style.display = 'flex';
                    div.style.flexDirection = 'column';
                    div.style.gap = '0.25rem';
                    div.style.backgroundColor = '#F8FAFC';
                    div.style.padding = '0.5rem';
                    div.style.borderRadius = 'var(--radius-md)';
                    div.style.border = '1px solid var(--border)';
                    
                    const stockText = isAr ? 'مخزون' : 'Stock';
                    div.innerHTML = `
                        <label style="font-size:0.75rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHTML(item.product_name)} <span style="color:var(--text-muted); font-weight:500;">(${stockText}: ${item.quantity})</span>
                        </label>
                        <input type="number" class="form-input invoice-qty-input" data-id="${item.id}" min="0" placeholder="0" style="padding:0.35rem 0.5rem; font-size:0.8rem; background-color:white;">
                    `;
                    container.appendChild(div);
                });
            };

            // Initial render
            renderList(opIn.value);

            // Listen to operator changes
            opIn.addEventListener('change', () => {
                renderList(opIn.value);
            });
        },
        preConfirm: () => {
            const invoiceNum = document.getElementById('modal-invoice-num').value.trim();
            const discount = parseFloat(document.getElementById('modal-invoice-discount').value || 0);
            const notes = document.getElementById('modal-invoice-notes').value.trim();
            const vendor = document.getElementById('modal-invoice-vendor').value;
            const operator = document.getElementById('modal-invoice-operator').value;
            
            const inputs = document.querySelectorAll('.invoice-qty-input');
            const updates = [];
            
            inputs.forEach(input => {
                const qtyToAdd = parseInt(input.value || 0);
                if (qtyToAdd > 0) {
                    const itemId = input.getAttribute('data-id');
                    const item = state.stock.find(s => s.id === itemId);
                    if (item) {
                        updates.push({
                            itemId: itemId,
                            itemName: item.product_name,
                            newQty: item.quantity + qtyToAdd,
                            qtyAdded: qtyToAdd
                        });
                    }
                }
            });

            if (updates.length === 0) {
                Swal.showValidationMessage(isAr ? 'يرجى إدخال كمية لمنتج واحد على الأقل' : 'Veuillez saisir une quantité pour au moins un article');
                return false;
            }

            return { invoiceNum, discount, notes, vendor, operator, updates };
        },
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري تحديث المخزون...' : 'Mise à jour du stock...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            try {
                const { updates, invoiceNum, discount, notes, vendor, operator } = result.value;
                
                // Save updates in Supabase
                for (let u of updates) {
                    const { error } = await supabase.from('stock').update({ quantity: u.newQty }).eq('id', u.itemId);
                    if (error) throw error;

                    // Log in stock_history
                    const itemData = state.stock.find(s => s.id === u.itemId);
                    const historyRow = {
                        operator: operator,
                        product_type: itemData ? itemData.product_type : 'Recharge',
                        product_name: u.itemName,
                        quantity: u.qtyAdded,
                        invoice_num: invoiceNum,
                        discount: discount,
                        notes: notes,
                        vendor: vendor
                    };
                    const { error: histErr } = await supabase.from('stock_history').insert([historyRow]);
                    if (histErr) throw histErr;
                }

                Swal.fire({
                    icon: 'success',
                    title: isAr ? 'تم توريد المخزون' : 'Stock approvisionné',
                    html: isAr
                        ? `تم تسجيل فاتورة رقم <b>${escapeHTML(invoiceNum || 'لا يوجد')}</b>.<br>تم تحديث ${updates.length} منتجات بنجاح.`
                        : `Facture N° <b>${escapeHTML(invoiceNum || 'N/A')}</b> enregistrée.<br>${updates.length} articles mis à jour avec succès.`,
                    confirmButtonColor: '#8B5CF6',
                    customClass: { popup: 'swal2-popup-custom' }
                });
                loadDatabaseData();
            } catch (err) {
                console.error(err);
                Swal.fire(isAr ? 'خطأ في التوريد' : 'Erreur d\'approvisionnement', err.message, 'error');
            }
        }
    });
}

// 7. DEVELOPER UTILS & SEEDING SCRIPT
async function seedDatabaseDemoData() {
    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'تهيئة البيانات التجريبية' : 'Initialisation de démo',
        html: isAr 
            ? "<div style='text-align: right; direction: rtl;'>ستقوم هذه العملية بإدخال بيانات تجريبية للزبائن والمبيعات والديون والمصاريف في Supabase لملء لوحة التحكم.</div>"
            : 'Cette action va injecter des données fictives de clients, ventes et crédits dans votre Supabase pour peupler le dashboard.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: isAr ? 'نعم، أدخل البيانات' : 'Oui, injecter',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        confirmButtonColor: '#8B5CF6',
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري إدخال البيانات...' : 'Injection des données...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            try {
                // 1. Insert Clients
                const demoClients = [
                    { name: 'Abdelhakim Fatouaki', phone: '+212 661-712324', dealer_number: 'DI1', activity: 'AG : Alimentation Générale', address: 'Nador fatwaki', notes: 'Client régulier' },
                    { name: 'Abdelaziz 9antra Tri9 Zghnghan', phone: '0699-000934', dealer_number: '0699-000934', activity: 'AG : Alimentation Générale', address: 'Zghanghane', notes: '' },
                    { name: 'Abdellah', phone: '+212 666-769758', dealer_number: '+212 666-769758', activity: 'VPA : Vente Portable et Accessoires', address: 'Alomrane Selouane', notes: '' },
                    { name: 'Abderrahim zghnghan', phone: '+212 660-490650', dealer_number: '+212 660-490650', activity: 'VPA : Vente Portable et Accessoires', address: 'Zghanghane', notes: '' },
                    { name: 'ABDLMOUNAIM', phone: '+212 680-606290', dealer_number: '+212 680-606290', activity: 'LP : Librairie & Papeterie', address: '-', notes: 'Préfère Inwi' }
                ];
                
                const { data: clients, error: clientErr } = await supabase.from('clients').insert(demoClients).select();
                if (clientErr) throw clientErr;

                // 2. Insert Stock (if empty)
                await initializeDefaultStock();
                
                // Assign realistic quantities to the initialized stock items
                const { data: stockItems } = await supabase.from('stock').select('*');
                if (stockItems && stockItems.length > 0) {
                    for (let item of stockItems) {
                        let qty = 0;
                        if (item.product_type === 'SIM') {
                            qty = Math.floor(Math.random() * 50) + 15; // 15 to 65 SIMs
                        } else {
                            // Recharge: higher stock for smaller values, lower stock for larger values
                            const match = item.product_name.match(/Recharge\s+(\d+)\s*DH/i);
                            if (match) {
                                const val = parseInt(match[1]);
                                if (val <= 30) {
                                    qty = Math.floor(Math.random() * 3000) + 1000; // 1000 to 4000 DH
                                } else if (val <= 100) {
                                    qty = Math.floor(Math.random() * 1000) + 200;  // 200 to 1200 DH
                                } else {
                                    qty = Math.floor(Math.random() * 50) + 10;     // 10 to 60 units of high-value recharges
                                }
                            }
                        }
                        await supabase.from('stock').update({ quantity: qty }).eq('id', item.id);
                    }
                }

                // 3. Insert Sales
                const daysAgo = (num) => new Date(Date.now() - num * 24 * 60 * 60 * 1000).toISOString();
                
                const demoSales = [
                    { client_id: clients[0].id, operator: 'Maroc Telecom', product_type: 'Recharge', product_name: 'Recharge 50 DH', quantity: 60, unit_price: 50, total_brut: 3000, discount: 0, net_to_pay: 3000, payment_status: 'Payé', created_at: daysAgo(5) },
                    { client_id: clients[1].id, operator: 'Orange', product_type: 'Recharge', product_name: 'Recharge 50 DH', quantity: 40, unit_price: 50, total_brut: 2000, discount: 50, net_to_pay: 1950, payment_status: 'Payé', created_at: daysAgo(4) },
                    { client_id: clients[2].id, operator: 'Inwi', product_type: 'SIM', product_name: 'Carte SIM Inwi', quantity: 10, unit_price: 30, total_brut: 300, discount: 0, net_to_pay: 300, payment_status: 'En Crédit', created_at: daysAgo(3) },
                    { client_id: clients[3].id, operator: 'Maroc Telecom', product_type: 'SIM', product_name: 'Carte SIM Maroc Telecom', quantity: 20, unit_price: 30, total_brut: 600, discount: 20, net_to_pay: 580, payment_status: 'En Crédit', created_at: daysAgo(2) },
                    { client_id: clients[4].id, operator: 'Inwi', product_type: 'Recharge', product_name: 'Recharge 50 DH', quantity: 50, unit_price: 50, total_brut: 2500, discount: 100, net_to_pay: 2400, payment_status: 'Payé', created_at: daysAgo(0) }
                ];

                const { data: sales, error: saleErr } = await supabase.from('sales').insert(demoSales).select();
                if (saleErr) throw saleErr;

                // 4. Insert corresponding Credits for credit sales
                const credit1 = { sale_id: sales[2].id, client_id: clients[2].id, total_amount: 300, paid_amount: 0, remaining_amount: 300, status: 'Non payé', created_at: daysAgo(3) };
                const credit2 = { sale_id: sales[3].id, client_id: clients[3].id, total_amount: 580, paid_amount: 100, remaining_amount: 480, status: 'Partiellement payé', created_at: daysAgo(2) };
                
                const { error: creditErr } = await supabase.from('credits').insert([credit1, credit2]);
                if (creditErr) throw creditErr;

                // 5. Insert some expenses
                const demoExpenses = [
                    { title: 'Loyer local juin 2026', category: 'Loyer / Charges', amount: 1500, notes: 'Payé par chèque' },
                    { title: 'Essence transport cartes', category: 'Logistique / Transport', amount: 350, notes: 'Ticket N° 98123' }
                ];
                await supabase.from('expenses').insert(demoExpenses);

                Swal.fire({ icon: 'success', title: isAr ? 'تم إدخال البيانات التجريبية' : 'Données de démo injectées', timer: 1500, showConfirmButton: false });
                loadDatabaseData();
            } catch (err) {
                console.error(err);
                Swal.fire(isAr ? 'خطأ في الإدخال' : 'Erreur d\'injection', err.message, 'error');
            }
        }
    });
}

async function clearDatabaseTables() {
    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'مسح قاعدة البيانات؟' : 'Vider la Base de données ?',
        html: isAr 
            ? "<div style='text-align: right; direction: rtl;'>ستقوم هذه العملية بحذف جميع المبيعات والزبائن والديون والمصاريف والمخزون نهائيًا من حساب Supabase الخاص بك.</div>"
            : 'Cette action supprimera DÉFINITIVEMENT toutes les ventes, clients, crédits, frais et stock de votre Supabase.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#64748B',
        confirmButtonText: isAr ? 'نعم، احذف الكل' : 'Oui, tout supprimer',
        cancelButtonText: isAr ? 'إلغاء' : 'Annuler',
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: isAr ? 'جاري تنظيف Supabase...' : 'Nettoyage Supabase...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            try {
                // Order of deletion matters due to foreign key constraints
                await supabase.from('credit_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('credits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');

                Swal.fire({ icon: 'success', title: isAr ? 'تم مسح قاعدة البيانات' : 'Base de données vidée', timer: 1500, showConfirmButton: false });
                
                // Clear state & refresh
                state.clients = [];
                state.sales = [];
                state.credits = [];
                state.expenses = [];
                state.stock = [];
                
                updateDashboardStats();
                renderRecentSalesTable();
            } catch (err) {
                Swal.fire(isAr ? 'خطأ أثناء التنظيف' : 'Erreur lors du nettoyage', err.message, 'error');
            }
        }
    });
}

function showSQLScriptModal() {
    const sqlScript = `-- 1. Create Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    dealer_number TEXT,
    activity TEXT,
    address TEXT,
    notes TEXT
);

-- 2. Create Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    operator TEXT NOT NULL,
    product_type TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    total_brut NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    net_to_pay NUMERIC DEFAULT 0,
    payment_status TEXT NOT NULL,
    notes TEXT
);

-- 3. Create Credits Table
CREATE TABLE IF NOT EXISTS credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    total_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Non payé'
);

-- 4. Create Credit Payments Table
CREATE TABLE IF NOT EXISTS credit_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    credit_id UUID REFERENCES credits(id) ON DELETE CASCADE,
    amount NUMERIC DEFAULT 0,
    notes TEXT
);

-- 5. Create Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    category TEXT,
    notes TEXT
);

-- 6. Create Stock Table
CREATE TABLE IF NOT EXISTS stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    operator TEXT NOT NULL,
    product_type TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    min_threshold INTEGER DEFAULT 10
);

-- 7. Create Stock History Table
CREATE TABLE IF NOT EXISTS stock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    operator TEXT NOT NULL,
    product_type TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    invoice_num TEXT,
    discount NUMERIC DEFAULT 0,
    notes TEXT,
    vendor TEXT
);

-- 8. Disable Row Level Security (RLS) on all tables to allow connection read/write
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE credits DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history DISABLE ROW LEVEL SECURITY;`;

    const isAr = document.documentElement.lang === 'ar';
    Swal.fire({
        title: isAr ? 'خطوات إعداد SQL' : 'Script de configuration SQL',
        html: `
            <div style="text-align:${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'};">
                <p style="font-size:0.8rem; margin-bottom:1rem;">${isAr 
                    ? 'انسخ والصق هذا الرمز في محرر SQL الخاص بـ Supabase (<a href="https://supabase.com/dashboard" target="_blank">supabase.com/dashboard</a>) ثم انقر فوق **Run**.'
                    : 'Copiez et collez ce script dans l\'éditeur SQL de votre console Supabase (<a href="https://supabase.com/dashboard" target="_blank">supabase.com/dashboard</a>) puis cliquez sur **Run**.'}</p>
                <textarea id="sql-copy-area" readonly style="width: 100%; height: 200px; font-family: monospace; font-size: 0.75rem; padding: 0.5rem; background:#F8FAFC; border:1px solid var(--border); border-radius:4px;">${sqlScript}</textarea>
                <button id="btn-copy-sql-text" class="btn btn-primary btn-sm" style="margin-top:0.5rem; width:100%;">${isAr ? 'نسخ رمز SQL' : 'Copier le Code SQL'}</button>
            </div>
        `,
        confirmButtonText: isAr ? 'إغلاق' : 'Fermer',
        confirmButtonColor: '#8B5CF6',
        didOpen: () => {
            document.getElementById('btn-copy-sql-text').addEventListener('click', () => {
                const textarea = document.getElementById('sql-copy-area');
                textarea.select();
                document.execCommand('copy');
                Swal.showValidationMessage(isAr ? 'تم نسخ رمز SQL إلى الحافظة!' : 'Code SQL copié dans le presse-papiers !');
            });
        },
        customClass: { popup: 'swal2-popup-custom' }
    });
}

// 8. HELPERS & FORMATTERS

// Helper functions

function loadCommissions() {
    const defaultComms = {
        mt_recharge: 7.0,
        mt_sim: 15.0,
        orange_recharge: 7.0,
        orange_sim: 20.0,
        inwi_recharge: 7.0,
        inwi_sim: 18.0
    };
    
    let comms = localStorage.getItem('grecharge_commissions');
    if (comms) {
        try {
            return { ...defaultComms, ...JSON.parse(comms) };
        } catch (e) {
            console.error("Error parsing commissions:", e);
        }
    }
    return defaultComms;
}

function saveCommissions(comms) {
    localStorage.setItem('grecharge_commissions', JSON.stringify(comms));
}

function populateCommissionInputs() {
    const comms = loadCommissions();
    const mtRecharge = document.getElementById('comm-mt-recharge');
    const mtSim = document.getElementById('comm-mt-sim');
    const orangeRecharge = document.getElementById('comm-orange-recharge');
    const orangeSim = document.getElementById('comm-orange-sim');
    const inwiRecharge = document.getElementById('comm-inwi-recharge');
    const inwiSim = document.getElementById('comm-inwi-sim');
    
    if (mtRecharge) mtRecharge.value = comms.mt_recharge;
    if (mtSim) mtSim.value = comms.mt_sim;
    if (orangeRecharge) orangeRecharge.value = comms.orange_recharge;
    if (orangeSim) orangeSim.value = comms.orange_sim;
    if (inwiRecharge) inwiRecharge.value = comms.inwi_recharge;
    if (inwiSim) inwiSim.value = comms.inwi_sim;
}

function setupThemeToggler() {
    const themeBtn = document.getElementById('theme-toggle');
    if (!themeBtn) return;
    
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        } else {
            document.body.classList.remove('dark-theme');
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }
        localStorage.setItem('grecharge_theme', theme);
    };
    
    // Read from localStorage
    const savedTheme = localStorage.getItem('grecharge_theme') || 'light';
    applyTheme(savedTheme);
    
    themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        applyTheme(isDark ? 'light' : 'dark');
    });
}

function formatCurrency(val) {
    const num = parseFloat(val || 0);
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
}

function formatDate(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// 9. INVOICE UTILITIES (PRINT & WHATSAPP)

function printInvoice(invoiceHtml) {
    const isAr = document.documentElement.lang === 'ar';
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
        Swal.fire(
            isAr ? 'النوافذ المنبثقة محجوبة' : 'Pop-up bloqué', 
            isAr ? 'يرجى السماح بالنوافذ المنبثقة لطباعة الوصل.' : 'Veuillez autoriser les fenêtres pop-up pour imprimer le ticket.', 
            'warning'
        );
        return;
    }
    printWindow.document.write(`
        <html dir="${isAr ? 'rtl' : 'ltr'}">
        <head>
            <title>${isAr ? 'وصل بيع' : 'Ticket de Caisse'}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap" rel="stylesheet">
            <style>
                @page {
                    size: 80mm auto;
                    margin: 0;
                }
                body {
                    font-family: 'Inter', sans-serif;
                    margin: 0;
                    padding: 8px;
                    background: white;
                    color: black;
                }
                @media print {
                    html, body {
                        background-color: #fff;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    #invoice-print-area {
                        border: none !important;
                        box-shadow: none !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 4px !important;
                    }
                }
            </style>
        </head>
        <body>
            ${invoiceHtml}
            <script>
                window.onload = function() {
                    window.print();
                    window.close();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function shareInvoiceWhatsApp(clientPhone, clientName, invoiceRef, date, items, paymentStatus) {
    const isAr = document.documentElement.lang === 'ar';
    // Beautiful text receipt layout for WhatsApp using clean borders and bold formatting
    let message = '';
    if (isAr) {
        message = `🧾 *وصل بيع (بون)*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `*المرجع :* ${invoiceRef}\n`;
        message += `*التاريخ :* ${date}\n`;
        message += `*الزبون :* ${clientName}\n`;
        message += `*الحالة :* ${paymentStatus === 'Payé' ? '✅ *مدفوع*' : '⚠️ *دين (غير مسدد)*'}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `*المنتجات :*\n`;
    } else {
        message = `🧾 *TICKET DE CAISSE*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `*Réf :* ${invoiceRef}\n`;
        message += `*Date :* ${date}\n`;
        message += `*Client :* ${clientName}\n`;
        message += `*Statut :* ${paymentStatus === 'Payé' ? '✅ *Payé*' : '⚠️ *En Crédit*'}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `*Articles :*\n`;
    }
    
    let totalGross = 0;
    let discountAmount = 0;
    let totalNet = 0;

    items.forEach(item => {
        message += `• ${item.product_name} (${item.operator})\n`;
        message += `  ${item.quantity} x ${item.unit_price.toFixed(2)} DH = *${item.total.toFixed(2)} DH*\n`;
        if (item.discount > 0) {
            const itemPct = item.discount_pct || 0;
            const formattedPct = (itemPct % 1 === 0) ? itemPct.toFixed(0) : itemPct.toFixed(1);
            if (isAr) {
                message += `  تخفيض (${formattedPct}%): -${item.discount.toFixed(2)} DH\n`;
            } else {
                message += `  Remise (${formattedPct}%): -${item.discount.toFixed(2)} DH\n`;
            }
        }
        totalGross += item.quantity * item.unit_price;
        discountAmount += item.discount || 0;
        totalNet += item.total;
    });
    
    const discountPct = totalGross > 0 ? Math.round((discountAmount * 100) / totalGross) : 0;

    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (discountAmount > 0) {
        if (isAr) {
            message += `المجموع الإجمالي : ${totalGross.toFixed(2)} DH\n`;
        } else {
            message += `Total Brut : ${totalGross.toFixed(2)} DH\n`;
        }
    }
    if (isAr) {
        message += `*الصافي للأداء : ${totalNet.toFixed(2)} DH*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `✨ *شكراً على زيارتكم !*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━`;
    } else {
        message += `*NET A PAYER : ${totalNet.toFixed(2)} DH*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `✨ *Merci pour votre visite !*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    const encodedText = encodeURIComponent(message);
    let cleanPhone = clientPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '212' + cleanPhone.substring(1);
    }
    
    let whatsappUrl = '';
    if (cleanPhone && cleanPhone !== '212') {
        whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    } else {
        whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    }
    window.open(whatsappUrl, '_blank');
}

function viewPastInvoice(invoiceRef) {
    const isAr = document.documentElement.lang === 'ar';
    const matchingSales = state.sales.filter(s => s.notes === invoiceRef);
    if (matchingSales.length === 0) {
        Swal.fire(isAr ? 'خطأ' : 'Erreur', isAr ? 'الفاتورة غير موجودة' : 'Facture introuvable', 'error');
        return;
    }
    const sale0 = matchingSales[0];
    const client = state.clients.find(c => c.id === sale0.client_id) || { name: 'Client Inconnu', phone: '' };
    
    const items = matchingSales.map(s => {
        const brut = parseFloat(s.total_brut || 0);
        const disc = parseFloat(s.discount || 0);
        const pct = brut > 0 ? (disc * 100 / brut) : 0;
        return {
            product_name: s.product_name,
            operator: s.operator,
            quantity: s.quantity,
            unit_price: parseFloat(s.unit_price || 0),
            discount_pct: pct,
            discount: disc,
            total: parseFloat(s.net_to_pay || 0)
        };
    });

    renderAndShowInvoiceModal(client, sale0.payment_status, items, invoiceRef, sale0.created_at);
}

function renderAndShowInvoiceModal(client, paymentStatus, items, invoiceRef, dateString) {
    const isAr = document.documentElement.lang === 'ar';
    const dateFormatted = formatDate(dateString || new Date().toISOString());
    const totalGross = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const discountAmount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const totalNet = items.reduce((sum, item) => sum + item.total, 0);
    const discountPct = totalGross > 0 ? Math.round((discountAmount * 100) / totalGross) : 0;

    let itemsHtml = '';
    items.forEach(item => {
        const itemPct = item.discount_pct || 0;
        const formattedPct = (itemPct % 1 === 0) ? itemPct.toFixed(0) : itemPct.toFixed(1);
        itemsHtml += `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; font-family: 'Inter', sans-serif; flex-direction: ${isAr ? 'row-reverse' : 'row'};">
                <div style="flex: 2; word-break: break-word; font-weight: 500; text-align: ${isAr ? 'right' : 'left'};">
                    ${escapeHTML(item.product_name)}
                    <span style="font-size: 9px; color: #555; margin-left: 4px; margin-right: 4px;">(${escapeHTML(item.operator)})</span>
                    ${item.discount > 0 ? `<div style="font-size: 8.5px; color: #c2410c; margin-top: 1px; font-weight: normal;">${isAr ? 'تخفيض' : 'Remise'} (${formattedPct}%): -${item.discount.toFixed(2)} DH</div>` : ''}
                </div>
                <div style="flex: 0.8; text-align: ${isAr ? 'left' : 'right'};">x${item.quantity}</div>
                <div style="flex: 1.2; text-align: ${isAr ? 'left' : 'right'};">${item.unit_price.toFixed(2)}</div>
                <div style="flex: 1.5; text-align: ${isAr ? 'left' : 'right'}; font-weight: 700;">${item.total.toFixed(2)} DH</div>
            </div>
        `;
    });

    const paymentClass = paymentStatus === 'Payé' ? 'badge-paid' : 'badge-unpaid';
    
    let statusLabel = paymentStatus;
    if (isAr) {
        statusLabel = paymentStatus === 'Payé' ? 'مدفوع' : 'دين';
    }

    const invoiceContentHtml = `
        <div id="invoice-print-area" style="width: 280px; margin: 0 auto; padding: 12px; font-family: 'Inter', sans-serif; color: #000; background: #fff; border: 1px dashed #bbb; box-sizing: border-box; font-size: 11px; line-height: 1.4; text-align: ${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'};">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 12px;">
                <h2 style="font-size: 15px; font-weight: 800; margin: 0 0 4px 0; color: #1E1B4B;">SUPER ADMIN TELECOM</h2>
                <div style="font-size: 10px; color: #555;">Tél: +212 661-712324</div>
                <div style="margin: 6px 0; border-top: 1px dashed #000;"></div>
                <h3 style="font-size: 12px; font-weight: 700; margin: 4px 0; letter-spacing: 0.5px;">${isAr ? 'وصل بيع (بون)' : 'TICKET DE CAISSE'}</h3>
                <div style="margin: 6px 0; border-top: 1px dashed #000;"></div>
                <div style="font-size: 9.5px; text-align: ${isAr ? 'right' : 'left'}; color: #333; direction: ${isAr ? 'rtl' : 'ltr'};">
                    <div><b>${isAr ? 'المرجع:' : 'Réf:'}</b> ${escapeHTML(invoiceRef)}</div>
                    <div><b>${isAr ? 'التاريخ:' : 'Date:'}</b> ${dateFormatted}</div>
                    <div><b>${isAr ? 'الزبون:' : 'Client:'}</b> ${escapeHTML(client.name)}</div>
                    ${client.phone ? `<div><b>${isAr ? 'هاتف الزبون:' : 'Tél Client:'}</b> ${escapeHTML(client.phone)}</div>` : ''}
                </div>
            </div>
            
            <div style="border-top: 1px dashed #000; margin-bottom: 6px;"></div>
            
            <!-- Table Headers -->
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 10.5px; margin-bottom: 4px; color: #111; flex-direction: ${isAr ? 'row-reverse' : 'row'};">
                <div style="flex: 2; text-align: ${isAr ? 'right' : 'left'};">${isAr ? 'المنتج' : 'Article'}</div>
                <div style="flex: 0.8; text-align: ${isAr ? 'left' : 'right'};">${isAr ? 'الكمية' : 'Qté'}</div>
                <div style="flex: 1.2; text-align: ${isAr ? 'left' : 'right'};">${isAr ? 'الثمن' : 'P.U.'}</div>
                <div style="flex: 1.5; text-align: ${isAr ? 'left' : 'right'};">${isAr ? 'المجموع' : 'Total'}</div>
            </div>
            
            <div style="border-top: 1px dashed #000; margin-bottom: 6px;"></div>
            
            <!-- Items list -->
            <div style="margin-bottom: 8px;">
                ${itemsHtml}
            </div>
            
            <div style="border-top: 1px dashed #000; margin-bottom: 6px;"></div>
            
            <!-- Summary Totals -->
            <div style="font-size: 11px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px; flex-direction: ${isAr ? 'row-reverse' : 'row'};">
                    <span>${isAr ? 'المجموع الإجمالي:' : 'Total Brut:'}</span>
                    <span>${totalGross.toFixed(2)} DH</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 12.5px; margin-top: 6px; border-top: 1px dashed #000; padding-top: 6px; color: #1E1B4B; flex-direction: ${isAr ? 'row-reverse' : 'row'};">
                    <span>${isAr ? 'الصافي للأداء:' : 'NET A PAYER:'}</span>
                    <span>${totalNet.toFixed(2)} DH</span>
                </div>
            </div>
            
            <div style="border-top: 1px dashed #000; margin-top: 10px; margin-bottom: 6px;"></div>
            
            <!-- Footer -->
            <div style="text-align: center; font-size: 10px;">
                <div style="margin-bottom: 4px;">${isAr ? 'الحالة:' : 'Statut:'} <span class="badge ${paymentClass}" style="font-size: 9px; padding: 1px 4px; font-weight: 700;">${statusLabel}</span></div>
                <div style="margin-top: 6px; font-style: italic; color: #555;">${isAr ? 'شكراً على زيارتكم!' : 'Merci pour votre visite !'}</div>
            </div>
        </div>
    `;

    Swal.fire({
        title: isAr ? 'وصل بيع (بون)' : 'Ticket de Caisse',
        width: '340px',
        html: `
            <div style="margin-bottom: 1rem;">
                ${invoiceContentHtml}
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem;">
                <button id="btn-print-invoice" class="btn" style="background-color: #4F46E5; color: white; border: none; padding: 0.5rem 1rem; font-size: 0.85rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                    🖨️ ${isAr ? 'طباعة الوصل' : 'Imprimer Ticket'}
                </button>
                <button id="btn-share-whatsapp" class="btn" style="background-color: #25D366; color: white; border: none; padding: 0.5rem 1rem; font-size: 0.85rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                    💬 ${isAr ? 'مشاركة الواتساب' : 'WhatsApp Bon'}
                </button>
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: isAr ? 'إغلاق' : 'Fermer',
        confirmButtonColor: '#64748B',
        customClass: { popup: 'swal2-popup-custom' },
        didOpen: () => {
            document.getElementById('btn-print-invoice').addEventListener('click', () => {
                printInvoice(invoiceContentHtml);
            });
            document.getElementById('btn-share-whatsapp').addEventListener('click', () => {
                shareInvoiceWhatsApp(client.phone || '', client.name, invoiceRef, dateFormatted, items, paymentStatus);
            });
        }
    });
}

// QR functions removed

// ==========================================
// 10. LOCALIZATION SYSTEM (ARABIC & FRENCH)
// ==========================================

const TRANSLATIONS = {
    fr: {
        app_title: "Recharge & SIM Manager",
        online: "En ligne",
        dashboard: "Tableau de bord",
        dashboard_subtitle: "Aperçu de l'activité commerciale en temps réel",
        clients: "Clients",
        clients_subtitle: "Ajouter, rechercher et gérer le portefeuille client",
        ventes: "Ventes",
        ventes_subtitle: "Liste globale de toutes les transactions et facturations",
        credits: "Crédits Clients",
        credits_subtitle: "Suivi et règlements des ventes à crédit",
        expenses: "Frais / Caisse",
        expenses_subtitle: "Suivi de la caisse et enregistrement des dépenses de l'activité",
        stock: "Stock / Articles",
        stock_subtitle: "Gérer les niveaux d'inventaire de recharges et de cartes SIM",
        configuration: "Configuration",
        logout: "Se déconnecter",
        recharges_val: "Recharges (Valeur)",
        sim_val: "Ventes SIM (Valeur)",
        sim_volume: "Volume SIM (PCS)",
        credits_val: "Crédits Clients (Dettes)",
        profit_val: "Bénéfice Net (Arbah)",
        new_sale: "+ Nouvelle Vente",
        new_client: "+ Nouveau Client",
        new_expense: "+ Enregistrer un Frais",
        new_stock: "+ Nouvel Approvisionnement",
        new_stock_invoice: "+ Nouvel Approvisionnement (Facture)",
        scan_qr: "Scanner QR",
        export_clients: "Exporter Clients",
        export_csv: "Exporter CSV",
        recent_sales_title: "Dernières ventes enregistrées",
        view_all: "Voir tout",
        operator: "Opérateur",
        type: "Type",
        designation: "Désignation",
        quantity: "Quantité",
        unit_price: "Prix Unitaire",
        unit_price_short: "Unit. (DH)",
        discount: "Remise",
        net_to_pay: "Net à payer",
        payment: "Paiement",
        actions: "Actions",
        status: "Statut",
        date: "Date",
        client_name: "Nom Complet",
        phone: "Téléphone",
        dealer_num: "Numéro Dealer",
        activity: "Activité",
        address: "Adresse",
        qr_code: "QR Code",
        notes: "Notes",
        credit_init: "Dette Initiale",
        amount_paid: "Montant Payé",
        remaining: "Reste Dû",
        caisse_net: "Fonds de Caisse Net",
        total_expenses: "Total Dépenses / Frais",
        expense_registry: "Registre des dépenses",
        title: "Titre",
        category: "Catégorie",
        stock_qty: "Quantité en Stock",
        alert_threshold: "Seuil Alerte",
        empty_stock: "🗑️ Vider la Sélection",
        admin_role: "ADMIN",
        sys_config_title: "Configuration Système",
        sys_config_subtitle: "Paramètres de l'application et options de base de données",
        supabase_conn_title: "Connexion Supabase active",
        tarifs_comm_title: "Tarifs et Commission par défaut",
        create_demo_data: "Créer données Demo",
        clear_database: "Vider Base de données",
        search_client_placeholder: "Rechercher par nom, téléphone, code dealer...",
        search_sales_placeholder: "Rechercher par client, article, notes...",
        search_client_only_placeholder: "Rechercher par client...",
        all_operators: "Tous les opérateurs",
        all_payments: "Tous les paiements",
        status_paid: "Payé",
        status_credit: "En Crédit",
        all_credits: "Tous les crédits",
        status_unpaid: "Non payé",
        status_partial: "Partiellement payé",
        date_saved: "Date Enreg.",
        original_article: "Article Originel",
        initial_debt: "Dette Initiale (DH)",
        remaining_amount: "Reste Dû (DH)",
        amount_dh: "Montant (DH)",
        comm_recharge_lbl: "Recharge Comm. (%)",
        comm_sim_lbl: "SIM Comm. (DH)",
        save_commissions: "Enregistrer les commissions",
        stock_history_title: "Historique des Approvisionnements",
        stock_history_subtitle: "Journal des recharges et cartes SIM achetées ou saisies",
        qty_added: "Quantité Ajoutée",
        invoice_ref: "N° Facture",
        invoice_discount: "Remise (%)",
        vendor: "Fournisseur"
    },
    ar: {
        app_title: "مدير الشحن والشرائح",
        online: "متصل",
        dashboard: "لوحة القيادة",
        dashboard_subtitle: "نظرة عامة على النشاط التجاري في الوقت الفعلي",
        clients: "الزبائن",
        clients_subtitle: "إضافة، بحث وإدارة محفظة الزبائن",
        ventes: "المبيعات",
        ventes_subtitle: "القائمة الإجمالية لجميع المعاملات والفواتير",
        credits: "ديون الزبائن",
        credits_subtitle: "متابعة وتسوية مبيعات الديون",
        expenses: "المصاريف / الصندوق",
        expenses_subtitle: "تتبع الصندوق وتسجيل مصاريف النشاط",
        stock: "المخزون / المواد",
        stock_subtitle: "إدارة مستويات المخزون للتعبئة وبطاقات SIM",
        configuration: "الإعدادات",
        logout: "تسجيل الخروج",
        recharges_val: "التعبئات (القيمة)",
        sim_val: "مبيعات الشرائح (القيمة)",
        sim_volume: "عدد الشرائح (قطع)",
        credits_val: "ديون الزبائن (المتبقية)",
        profit_val: "الأرباح الصافية (درهم)",
        new_sale: "+ بيع جديد",
        new_client: "+ زبون جديد",
        new_expense: "+ تسجيل مصاريف",
        new_stock: "+ توريد جديد",
        new_stock_invoice: "+ توريد جديد (فاتورة)",
        scan_qr: "مسح رمز QR",
        export_clients: "تصدير الزبائن",
        export_csv: "تصدير CSV",
        recent_sales_title: "آخر المبيعات المسجلة",
        view_all: "عرض الكل",
        operator: "الشركة",
        type: "النوع",
        designation: "المادة / الوصف",
        quantity: "الكمية",
        unit_price: "ثمن الوحدة",
        unit_price_short: "ثمن الوحدة (د.م.)",
        discount: "تخفيض",
        net_to_pay: "المبلغ الصافي",
        payment: "الدفع",
        actions: "العمليات",
        status: "الحالة",
        date: "التاريخ",
        client_name: "الاسم الكامل",
        phone: "الهاتف",
        dealer_num: "رقم الموزع",
        activity: "النشاط",
        address: "العنوان",
        qr_code: "رمز QR",
        notes: "ملاحظات",
        credit_init: "الدين الأصلي",
        amount_paid: "المبلغ المدفوع",
        remaining: "المتبقي",
        caisse_net: "رصيد الصندوق الصافي",
        total_expenses: "مجموع المصاريف",
        expense_registry: "سجل المصاريف",
        title: "العنوان",
        category: "الفئة",
        stock_qty: "الكمية المتوفرة",
        alert_threshold: "حد التنبيه",
        empty_stock: "🗑️ إفراغ المحدد",
        admin_role: "مشرف",
        sys_config_title: "إعدادات النظام",
        sys_config_subtitle: "إعدادات التطبيق وخيارات قاعدة البيانات",
        supabase_conn_title: "اتصال Supabase نشط",
        tarifs_comm_title: "التعريفات والعمولات الافتراضية",
        create_demo_data: "إنشاء بيانات تجريبية",
        clear_database: "مسح قاعدة البيانات",
        search_client_placeholder: "البحث عن طريق الاسم، الهاتف، رقم الموزع...",
        search_sales_placeholder: "البحث عن طريق الزبون، المنتج، ملاحظات...",
        search_client_only_placeholder: "البحث عن طريق الزبون...",
        all_operators: "جميع الشركات",
        all_payments: "جميع طرق الدفع",
        status_paid: "مدفوع",
        status_credit: "دين",
        all_credits: "جميع الديون",
        status_unpaid: "غير مدفوع",
        status_partial: "مدفوع جزئياً",
        date_saved: "تاريخ التسجيل",
        original_article: "المنتج الأصلي",
        initial_debt: "الدين الأصلي (د.م.)",
        remaining_amount: "المتبقي (د.م.)",
        amount_dh: "المبلغ (د.م.)",
        comm_recharge_lbl: "عمولة التعبئة (%)",
        comm_sim_lbl: "عمولة شريحة SIM (د.م.)",
        save_commissions: "حفظ نسب العمولات",
        stock_history_title: "سجل التوريدات والمشتريات",
        stock_history_subtitle: "دفتر التوريدات لجميع الشحنات المضافة للمخزون",
        qty_added: "الكمية المضافة",
        invoice_ref: "رقم الفاتورة",
        invoice_discount: "التخفيض (%)",
        vendor: "المورد / البائع"
    }
};

function setupLanguageSwitcher() {
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const lang = btn.textContent.trim().toLowerCase();
            changeLanguage(lang);
        });
    });
    
    // Load preference from localStorage
    const prefLang = localStorage.getItem('recharge_sim_lang') || 'fr';
    langBtns.forEach(b => {
        if (b.textContent.trim().toLowerCase() === prefLang) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
    changeLanguage(prefLang);
}

function changeLanguage(lang) {
    document.documentElement.lang = lang;
    if (lang === 'ar') {
        document.documentElement.dir = 'rtl';
        document.body.classList.add('rtl');
    } else {
        document.documentElement.dir = 'ltr';
        document.body.classList.remove('rtl');
    }
    
    // Translate textContent for data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
            el.textContent = TRANSLATIONS[lang][key];
        }
    });
    
    // Translate title attribute for data-i18n-title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
            el.setAttribute('title', TRANSLATIONS[lang][key]);
        }
    });

    // Translate placeholder attribute for data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
            el.setAttribute('placeholder', TRANSLATIONS[lang][key]);
        }
    });

    // Update Topbar Title depending on active section text content
    const activeLink = document.querySelector('.sidebar-link.active');
    if (activeLink) {
        const span = activeLink.querySelector('span');
        const titleEl = document.getElementById('topbar-title');
        if (titleEl && span) titleEl.textContent = span.textContent;
    }
    
    // Refresh tables to redraw status badges in active language
    if (typeof state !== 'undefined') {
        if (document.getElementById('view-dashboard') && !document.getElementById('view-dashboard').classList.contains('hidden')) {
            renderRecentSalesTable();
        } else if (document.getElementById('view-ventes') && !document.getElementById('view-ventes').classList.contains('hidden')) {
            renderSalesTable();
        } else if (document.getElementById('view-credits') && !document.getElementById('view-credits').classList.contains('hidden')) {
            renderCreditsTable();
        } else if (document.getElementById('view-stock') && !document.getElementById('view-stock').classList.contains('hidden')) {
            renderStockTable();
            renderStockHistoryTable();
        }
    }
    
    localStorage.setItem('recharge_sim_lang', lang);
}

// ==========================================
// 11. STOCK HISTORY LOGIC (NEW FEATURE)
// ==========================================

function renderStockHistoryTable() {
    const tbody = document.getElementById('stock-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const isAr = document.documentElement.lang === 'ar';

    if (!state.stock_history || state.stock_history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-light); padding:1.5rem;">${isAr ? 'لا يوجد سجل للتوريدات بعد.' : 'Aucun historique d\'approvisionnement enregistré.'}</td></tr>`;
        return;
    }

    state.stock_history.forEach(h => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        
        const operatorClass = h.operator === 'Maroc Telecom' ? 'badge-operator-mt' : h.operator === 'Orange' ? 'badge-operator-orange' : 'badge-operator-inwi';
        const dateFormatted = formatDate(h.created_at);

        tr.innerHTML = `
            <td style="white-space: nowrap;">${dateFormatted}</td>
            <td><span class="badge ${operatorClass}">${h.operator}</span></td>
            <td>${h.product_type}</td>
            <td class="bold">${escapeHTML(h.product_name)}</td>
            <td class="text-right bold" style="color: var(--success);">+${h.quantity}</td>
            <td>${escapeHTML(h.invoice_num || '-')}</td>
            <td class="text-right">${h.discount ? h.discount + '%' : '-'}</td>
            <td>${escapeHTML(h.vendor || '-')}</td>
            <td><span style="font-size:0.75rem; color:var(--text-light); max-width: 150px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHTML(h.notes || '')}">${escapeHTML(h.notes || '-')}</span></td>
            <td style="text-align: center;">
                <button class="icon-btn btn-delete-stock-history" data-id="${h.id}" style="color:var(--danger); border-color:var(--danger); padding:2px; height:24px; width:24px; min-width:24px; display:inline-flex; align-items:center; justify-content:center;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:12px;height:12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Bind delete buttons
    document.querySelectorAll('.btn-delete-stock-history').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteStockHistoryHandler(btn.getAttribute('data-id'));
        });
    });
}

async function deleteStockHistoryHandler(id) {
    const entry = state.stock_history.find(h => h.id === id);
    if (!entry) return;

    const isAr = document.documentElement.lang === 'ar';
    
    // Find corresponding stock item
    const stockItem = state.stock.find(s => 
        s.operator === entry.operator && 
        s.product_type === entry.product_type && 
        s.product_name === entry.product_name
    );

    let stockQtyAfterSub = 0;
    if (stockItem) {
        stockQtyAfterSub = stockItem.quantity - entry.quantity;
    }

    const warningHtml = isAr 
        ? `<div style="text-align: right; direction: rtl;">
            سيتم إلغاء هذا التوريد وحذف السجل.<br>
            سيتم طرح <b>${entry.quantity}</b> من مخزون <b>${escapeHTML(entry.product_name)}</b>.<br>
            ${stockQtyAfterSub < 0 ? `<span style="color:var(--danger); font-weight:700;">تحذير: سيصبح المخزون سالباً (${stockQtyAfterSub})!</span>` : ''}
           </div>`
        : `<div>
            Cette action va annuler cet approvisionnement.<br>
            La quantité de <b>${entry.quantity}</b> sera soustraite du stock de <b>${escapeHTML(entry.product_name)}</b>.<br>
            ${stockQtyAfterSub < 0 ? `<span style="color:var(--danger); font-weight:700;">Attention : le stock deviendra négatif (${stockQtyAfterSub}) !</span>` : ''}
           </div>`;

    Swal.fire({
        title: isAr ? 'إلغاء التوريد؟' : 'Annuler l\'approvisionnement ?',
        html: warningHtml,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#64748B',
        confirmButtonText: isAr ? 'نعم، إلغاء' : 'Oui, annuler',
        cancelButtonText: isAr ? 'رجوع' : 'Retour',
        customClass: { popup: 'swal2-popup-custom' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: isAr ? 'جاري إلغاء التوريد...' : 'Annulation de l\'approvisionnement...',
                didOpen: () => Swal.showLoading(),
                allowOutsideClick: false
            });

            try {
                // Update stock if item exists
                if (stockItem) {
                    const { error: stockErr } = await supabase.from('stock').update({ quantity: stockQtyAfterSub }).eq('id', stockItem.id);
                    if (stockErr) throw stockErr;
                }

                // Delete from stock_history
                const { error: historyErr } = await supabase.from('stock_history').delete().eq('id', id);
                if (historyErr) throw historyErr;

                Swal.fire({ icon: 'success', title: isAr ? 'تم إلغاء التوريد بنجاح' : 'Approvisionnement annulé', timer: 1500, showConfirmButton: false });
                loadDatabaseData();
            } catch (err) {
                console.error(err);
                Swal.fire(isAr ? 'خطأ' : 'Erreur', err.message, 'error');
            }
        }
    });
}
