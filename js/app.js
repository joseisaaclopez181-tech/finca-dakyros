/**
 * Finca Dakyros — App principal
 * Módulos: Tienda (recomendador IA + WhatsApp), Finca (offline-first con
 * IndexedDB + dictado por voz) y Panel de control (sincronización).
 */
(function () {
  'use strict';

  /* ════════════════════════════════════════════════
     CONFIGURACIÓN — NÚMERO WHATSAPP
     Reemplaza por el número real de Finca Dakyros (en formato internacional
     sin "+", ni espacios, ni guiones). Ej.: 50496000000
     ════════════════════════════════════════════════ */
  let WHATSAPP_NUMBER = '50494522586';

  /* Catálogo de productos */
  const PRODUCTOS = [
    {
      id: 'barra-70',
      nombre: 'Barra Oscura 70% Cacao',
      perfil: 'intenso',
      ocasion: 'capricho',
      descripcion: 'Chocolate puro y profundo, 70% cacao de nuestra finca.',
      precio: 'L 110.00',
      emoji: '🍫'
    },
    {
      id: 'choco-50-leche',
      nombre: 'Chocolate 50% con Leche',
      perfil: 'cremoso',
      ocasion: 'regalo',
      descripcion: 'Cremoso y suave, el equilibrio perfecto para regalar.',
      precio: 'L 95.00',
      emoji: '🍫🥛'
    },
    {
      id: 'cafe-altura',
      nombre: 'Café de Altura Tueste Medio',
      perfil: 'aromatico',
      ocasion: 'cafe',
      descripcion: 'Grano de altura, tueste medio, aroma incomparable.',
      precio: 'L 140.00',
      emoji: '☕'
    },
    {
      id: 'cacao-entero',
      nombre: 'Cacao en Grano',
      perfil: 'intenso',
      ocasion: 'capricho',
      descripcion: 'Cacao fermentado y secado al sol, listo para transformar.',
      precio: 'L 180.00',
      emoji: '🟤'
    },
    {
      id: 'choco-avellana',
      nombre: 'Chocolate con Avellanas',
      perfil: 'cremoso',
      ocasion: 'capricho',
      descripcion: 'Textura cremosa con avellanas tostadas.',
      precio: 'L 130.00',
      emoji: '🌰'
    },
    {
      id: 'cafe-molido',
      nombre: 'Café Molido para Prensa',
      perfil: 'aromatico',
      ocasion: 'cafe',
      descripcion: 'Molienda media-fina ideal para prensa francesa.',
      precio: 'L 150.00',
      emoji: '☕'
    }
  ];

  /* ════════════════════════════════════════════════
     UTILIDADES
     ════════════════════════════════════════════════ */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ════════════════════════════════════════════════
     NAVEGACIÓN ENTRE VISTAS
     ════════════════════════════════════════════════ */
  const views = ['inicio', 'tienda', 'finca', 'panel', 'login', 'cpanel'];

  window.go = function (name) {
    if (views.indexOf(name) === -1) return;
    if (name === 'cpanel') {
      if (!isAdminAuthed()) {
        name = 'login';
      }
    }
    $all('.view').forEach(function (v) { v.classList.remove('view-active'); });
    $('#view-' + name).classList.add('view-active');
    currentView = name;
    renderActiveView();
    // Actualizar resaltado en tabbars + drawer
    $all('.tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.view === name); });
    $all('.nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.view === name); });
  };

  window.closeMenu = function () {
    $('#nav-menu').classList.remove('open');
    $('#scrim').hidden = true;
    $('#menu-btn').setAttribute('aria-expanded', 'false');
  };
  window.toggleMenu = function () {
    const open = $('#nav-menu').classList.toggle('open');
    $('#scrim').hidden = !open;
    $('#menu-btn').setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  let currentView = 'inicio';

  function renderActiveView() {
    if (currentView === 'inicio') renderPopular();
    if (currentView === 'tienda') loadShop();
    if (currentView === 'panel') renderPanel();
    if (currentView === 'finca') renderFincaList();
    if (currentView === 'cpanel') initCpanel();
  }

  /* ════════════════════════════════════════════════
     ESTADO DE RED (Barra superior)
     ════════════════════════════════════════════════ */
  function updateNetworkStatus() {
    const online = navigator.onLine;
    const bar = $('#netbar');
    bar.classList.toggle('offline', !online);
    $('#net-text').textContent = online ? 'Conectado' : 'Sin conexión';
    if (online) {
      // Al recuperar señal, intentar sincronizar automáticamente
      syncAll(false);
    }
  }
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  /* ════════════════════════════════════════════════
     INDEXEDDB — TIENDA DE BITÁCORAS (Offline-first)
     ════════════════════════════════════════════════ */
  const DB_NAME = 'finca-dakyros';
  const DB_VERSION = 1;
  const STORE = 'bitacoras';
  let db = null;

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          const store = d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('fecha', 'fecha');
          store.createIndex('tipo', 'tipo');
          store.createIndex('responsable', 'responsable');
          store.createIndex('sincronizado', 'sincronizado');
        }
      };
      req.onsuccess = function (e) { db = e.target.result; resolve(db); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function getAllRecords() {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        const tx = d.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  function addRecord(rec) {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        const tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).add(rec);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  function updateRecord(rec) {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        const tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  function deleteRecord(id) {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        const tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(Number(id));
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  /* ════════════════════════════════════════════════
     FORMULARIO FINCA (Offline-first + dictado por voz)
     ════════════════════════════════════════════════ */
  const fecha = $('#fecha');
  if (fecha && !fecha.value) {
    const today = new Date().toISOString().slice(0, 10);
    fecha.value = today;
  }

  $('#finca-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const tipo = $('#tipo').value;
    const lote = $('#lote').value.trim();
    const responsable = $('#responsable').value.trim();
    const cantidad = parseFloat($('#cantidad').value) || 0;
    const obs = $('#observaciones').value.trim();
    const fechaVal = $('#fecha').value;

    if (!tipo || !responsable) {
      setMicStatus('Completa el tipo de proceso y el responsable.', false);
      return;
    }

    const registro = {
      tipo: tipo,
      lote: lote || 'Sin especificar',
      responsable: responsable,
      cantidad: cantidad,
      observaciones: obs,
      fecha: fechaVal,
      sincronizado: false,
      creadoEn: new Date().toISOString()
    };

    addRecord(registro).then(function () {
      $('#finca-form').reset();
      if (fecha) fecha.value = new Date().toISOString().slice(0, 10);
      setMicStatus('Registro guardado en tu dispositivo. Se sincronizará al recuperar señal.', false, 'info');
      renderFincaList();
      updatePendingCounter();
      // Si hay red, intentar subir
      if (navigator.onLine) syncAll(false);
    }).catch(function (err) {
      setMicStatus('Error al guardar: ' + err.message, false);
    });
  });

  /* ── Dictado por voz (Web Speech API) ── */
  function webSpeechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  let recognition = null;
  let listening = false;

  function initMic() {
    if (!webSpeechSupported()) {
      const btn = $('#mic-btn');
      btn.disabled = true;
      btn.title = 'Dictado no disponible en este navegador';
      setMicStatus('Dictado por voz no disponible en este navegador.', false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'es-HN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = function () {
      listening = true;
      $('#mic-btn').classList.add('listening');
      setMicStatus('🎤 Escuchando… habla ahora.', true);
    };
    recognition.onend = function () {
      listening = false;
      $('#mic-btn').classList.remove('listening');
      setMicStatus('', false);
    };
    recognition.onresult = function (e) {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      const field = $('#observaciones');
      field.value = (field.value ? field.value.trimEnd() + ' ' : '') + transcript;
    };
    recognition.onerror = function (e) {
      listening = false;
      $('#mic-btn').classList.remove('listening');
      setMicStatus('No pude escucharte. Intenta de nuevo.', false);
    };
  }

  $('#mic-btn').addEventListener('click', function () {
    if (!recognition || listening) return;
    recognition.start();
  });

  function setMicStatus(msg, isActive, kind) {
    const el = $('#mic-status');
    el.textContent = msg;
    el.classList.toggle('active', !!isActive);
    if (kind === 'info') {
      el.classList.remove('active');
      el.classList.add('info');
    } else {
      el.classList.remove('info');
    }
  }

  /* ── Render de lista finca ── */
  const TIPO_NOMBRE = {
    'cosecha-cafe': 'Cosecha de Café',
    'cosecha-cacao': 'Cosecha de Cacao',
    fermentacion: 'Fermentación',
    gasto: 'Gasto'
  };

  function renderFincaList() {
    getAllRecords().then(function (records) {
      const recent = records.slice().sort(function (a, b) {
        return (b.creadoEn || '').localeCompare(a.creadoEn || '');
      }).slice(0, 8);

      const list = $('#finca-list');
      if (!recent.length) {
        list.innerHTML = '<p class="muted">Aún no hay registros guardados.</p>';
        return;
      }
      list.innerHTML = recent.map(regItemHTML).join('');
      bindDeleteButtons(list);
    });
  }

  function regItemHTML(r) {
    const tipo = TIPO_NOMBRE[r.tipo] || r.tipo;
    const estado = r.sincronizado ? 'Sincronizado' : 'Pendiente';
    return '<article class="reg-item' + (r.sincronizado ? ' synced' : '') + '">' +
      '<div class="reg-head">' +
      '<span class="reg-tipo">' + tipo + '</span>' +
      '<span class="reg-badge">' + estado + '</span>' +
      '</div>' +
      '<div class="reg-meta">Lote: ' + esc(r.lote || '—') + ' · Resp: ' + esc(r.responsable) +
      (r.cantidad ? ' · ' + r.cantidad + (r.tipo === 'gasto' ? ' Lps' : ' kg') : '') +
      ' · ' + esc(r.fecha) + '</div>' +
      (r.observaciones ? '<div class="reg-obs">📝 ' + esc(r.observaciones) + '</div>' : '') +
      '<button class="reg-del" data-id="' + r.id + '">Eliminar</button>' +
      '</article>';
  }

  function bindDeleteButtons(container) {
    $all('.reg-del', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.dataset.id;
        if (confirm('¿Eliminar este registro?')) {
          deleteRecord(id).then(function () {
            renderFincaList();
            updatePendingCounter();
          });
        }
      });
    });
  }

  /* ════════════════════════════════════════════════
     SINCRONIZACIÓN
     ════════════════════════════════════════════════ */
  let syncing = false;

  function syncAll(showStatus) {
    if (syncing) return Promise.resolve();
    if (!navigator.onLine) {
      if (showStatus) setSyncStatus('Sin conexión. La sincronización se hará automáticamente al recuperar señal.', 'error');
      return Promise.resolve();
    }
    syncing = true;
    if (showStatus) setSyncStatus('Sincronizando…', 'info');

    return getAllRecords().then(function (records) {
      const pendientes = records.filter(function (r) { return !r.sincronizado; });
      if (!pendientes.length) {
        syncing = false;
        if (showStatus) setSyncStatus('Todo está sincronizado ✅', 'success');
        updatePendingCounter();
        renderPanel();
        return;
      }
      // Simula la subida al servidor central de San Pedro Sula.
      // (En producción: fetch() al endpoint real /api/sync con POST JSON.)
      return new Promise(function (resolve) {
        setTimeout(function () {
          return Promise.all(pendientes.map(function (r) {
            r.sincronizado = true;
            r.sincronizadoEn = new Date().toISOString();
            return updateRecord(r);
          })).then(function () {
            syncing = false;
            if (showStatus) setSyncStatus('Sincronizados ' + pendientes.length + ' registros ✅', 'success');
            updatePendingCounter();
            renderFincaList();
            renderPanel();
            resolve();
          });
        }, 600);
      });
    }).catch(function (err) {
      syncing = false;
      if (showStatus) setSyncStatus('Error al sincronizar: ' + err.message, 'error');
    });
  }

  function setSyncStatus(msg, kind) {
    const el = $('#sync-status');
    el.textContent = msg;
    el.classList.remove('success', 'error', 'info');
    if (kind) el.classList.add(kind);
  }

  $('#sync-btn').addEventListener('click', function () {
    syncAll(true);
  });

  /* ── Contador de pendientes en barra ── */
  function updatePendingCounter() {
    getAllRecords().then(function (records) {
      const pending = records.filter(function (r) { return !r.sincronizado; }).length;
      const chip = $('#pending-count');
      if (pending > 0) {
        chip.hidden = false;
        $('#pending-num').textContent = pending;
      } else {
        chip.hidden = true;
      }
      // Actualizar stats si panel visible
      if (currentView === 'panel') {
        $('#stat-pending').textContent = pending;
        $('#stat-total').textContent = records.length;
        $('#stat-synced').textContent = records.length - pending;
      }
    });
  }

  /* ════════════════════════════════════════════════
     PANEL DE CONTROL
     ════════════════════════════════════════════════ */
  function renderPanel() {
    $('#filter-tipo').addEventListener('change', renderPanelList, { once: false });
    getAllRecords().then(function (records) {
      const pending = records.filter(function (r) { return !r.sincronizado; }).length;
      $('#stat-pending').textContent = pending;
      $('#stat-total').textContent = records.length;
      $('#stat-synced').textContent = records.length - pending;
      renderPanelList();
    });
  }

  function renderPanelList() {
    const fTipo = $('#filter-tipo').value;
    const fResp = ($('#filter-resp').value || '').toLowerCase().trim();
    getAllRecords().then(function (records) {
      let filtered = records.slice().sort(function (a, b) {
        return (b.fecha || '').localeCompare(a.fecha || '');
      });
      if (fTipo) filtered = filtered.filter(function (r) { return r.tipo === fTipo; });
      if (fResp) filtered = filtered.filter(function (r) {
        return (r.responsable || '').toLowerCase().indexOf(fResp) !== -1;
      });
      const list = $('#panel-list');
      if (!filtered.length) {
        list.innerHTML = '<p class="muted">No hay bitácoras para los filtros seleccionados.</p>';
        return;
      }
      list.innerHTML = filtered.map(regItemHTML).join('');
      bindDeleteButtons(list);
    });
  }

  $('#filter-tipo').addEventListener('change', renderPanelList);
  $('#filter-resp').addEventListener('input', renderPanelList);

  /* ════════════════════════════════════════════════
     TIENDA — CATÁLOGO Y RENDER
     ════════════════════════════════════════════════ */
  function productCardHTML(p) {
    var precio = (p.precio != null) ? 'L ' + number(p.precio) : '';
    return '<article class="product-card">' +
      '<div class="p-body">' +
      '<div class="p-emoji">' + (p.emoji || '📦') + '</div>' +
      '<span class="p-badge">' + precio + '</span>' +
      '<h4>' + esc(p.nombre) + '</h4>' +
      '<p class="p-desc">' + esc(p.descripcion) + '</p>' +
      '<button class="btn btn-accent" onclick="addToCart(\'' + p.id + '\')">🛒 Añadir</button>' +
      '</div>' +
      '</article>';
  }

  function number(n) {
    var v = parseFloat(n);
    if (isNaN(v)) return '0.00';
    return v.toFixed(2);
  }

  var shopAll = [];
  var shopCat = '';

  function loadShop() {
    if (!window.Db || !Db.fetchProductos) { renderShop(); return; }
    Db.fetchProductos().then(function (rows) {
      shopAll = rows.filter(function (p) { return p.activo !== false; });
      renderShop();
      renderPopular();
    }).catch(function () { renderShop(); });
  }

  function renderShop() {
    var list = shopAll;
    if (shopCat) list = shopAll.filter(function (p) { return p.categoria === shopCat; });
    var query = $('#shop-search') ? ($('#shop-search').value || '').trim().toLowerCase() : '';
    if (query) list = list.filter(function (p) {
      return (p.nombre || '').toLowerCase().indexOf(query) !== -1 ||
             (p.descripcion || '').toLowerCase().indexOf(query) !== -1;
    });
    var box = $('#shop-products');
    if (box) {
      box.innerHTML = list.length ? list.map(productCardHTML).join('') : '<p class="muted">No hay productos.</p>';
    }
    var count = $('#shop-count');
    if (count) count.textContent = list.length + ' producto(s)';

    var cats = [];
    shopAll.forEach(function (p) { if (cats.indexOf(p.categoria) === -1 && p.categoria) cats.push(p.categoria); });
    var catList = $('#shop-cat-list');
    if (catList) {
      var lis = '<li><button class="' + (shopCat === '' ? 'active' : '') + '" data-cat="">Todas</button></li>' +
        cats.map(function (c) {
          return '<li><button class="' + (shopCat === c ? 'active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button></li>';
        }).join('');
      catList.innerHTML = lis;
      bindCollection('#shop-cat-list [data-cat]', 'click', function (btn) {
        shopCat = btn.getAttribute('data-cat');
        renderShop();
      });
    }

    var catsRow = $('#shop-cats');
    if (catsRow) {
      catsRow.innerHTML = cats.map(function (c) {
        return '<span class="shop-cat-chip" data-chip="' + esc(c) + '">' + esc(c) + '</span>';
      }).join('');
      bindCollection('#shop-cats [data-chip]', 'click', function (chip) {
        shopCat = chip.getAttribute('data-chip');
        renderShop();
      });
    }
  }

  function renderPopular() {
    var box = $('#popular');
    if (!box) return;
    var picks = shopAll.slice(0, 3);
    if (!picks.length) {
      picks = PRODUCTOS.slice(0, 3).map(function (p) {
        return { id: p.id, nombre: p.nombre, descripcion: p.descripcion, emoji: p.emoji, precio: p.precio, perfil: p.perfil, ocasion: p.ocasion, categoria: p.categoria };
      });
    }
    box.innerHTML = picks.map(productCardHTML).join('');
  }

  /* ════════════════════════════════════════════════
     RECOMENDADOR INTELIGENTE DE SABOR
     ════════════════════════════════════════════════ */
  let currentSuggestion = null;

  $('#rec-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var sabor = $('input[name="sabor"]:checked').value;
    var ocasion = $('input[name="ocasion"]:checked').value;
    var pool = shopAll.length ? shopAll : PRODUCTOS;

    // Reglas de sugerencia: perfiles de Productos
    var match = pool.filter(function (p) {
      return p.perfil === sabor && p.ocasion === ocasion;
    })[0] || pool.filter(function (p) { return p.perfil === sabor; })[0] || pool[0];
    if (!match) return;

    currentSuggestion = match;
    $('#rec-product').innerHTML =
      '<span class="rp-emoji">' + (match.emoji || '📦') + '</span>' +
      '<div class="rp-info"><h5>' + esc(match.nombre) + '</h5><p>' + esc(match.descripcion) + ' · L ' + number(match.precio) + '</p></div>';
    $('#rec-result').hidden = false;
    $('#rec-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ════════════════════════════════════════════════
     CARRITO DE COMPRA
     ════════════════════════════════════════════════ */
  var CART_KEY = 'dakyros-cart';

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; }
  }
  function saveCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {}
  }

  function findProduct(id) {
    for (var i = 0; i < shopAll.length; i++) if (String(shopAll[i].id) === String(id)) return shopAll[i];
    for (var j = 0; j < PRODUCTOS.length; j++) if (String(PRODUCTOS[j].id) === String(id)) return PRODUCTOS[j];
    return null;
  }

  window.addToCart = function (id) {
    var p = findProduct(id);
    if (!p) return;
    var items = loadCart();
    var found = false;
    for (var i = 0; i < items.length; i++) {
      if (String(items[i].id) === String(id)) { items[i].cantidad = (items[i].cantidad || 1) + 1; found = true; break; }
    }
    if (!found) items.push({ id: String(id), nombre: p.nombre, precio: parseFloat(p.precio) || 0, cantidad: 1 });
    saveCart(items);
    renderCart();
    flashCartButton();
  };

  function renderCart() {
    var items = loadCart();
    var count = 0, total = 0;
    items.forEach(function (it) { count += it.cantidad; total += (it.precio || 0) * it.cantidad; });

    var badge = $('#cart-count-badge');
    if (badge) { badge.textContent = count; badge.hidden = count === 0; }

    var empty = $('#cart-empty'), list = $('#cart-items'), sum = $('#cart-summary');
    if (empty) empty.hidden = items.length > 0;
    if (sum) sum.hidden = items.length === 0;
    if (list) {
      list.innerHTML = items.map(function (it, idx) {
        return '<li class="cart-item">' +
          '<div class="ci-info"><strong>' + esc(it.nombre) + '</strong>' +
          '<div class="muted">L ' + number(it.precio) + ' × ' + it.cantidad + '</div></div>' +
          '<div class="ci-actions">' +
          '<button class="btn btn-ghost btn-sm" data-dec-cart="' + idx + '">−</button>' +
          '<button class="btn btn-ghost btn-sm" data-inc-cart="' + idx + '">+</button>' +
          '<button class="btn btn-ghost btn-sm danger" data-del-cart="' + idx + '">🗑</button>' +
          '</div></li>';
      }).join('');
      bindCollection('#cart-items [data-inc-cart]', 'click', function (b) { changeCartQty(parseInt(b.getAttribute('data-inc-cart'), 10), 1); });
      bindCollection('#cart-items [data-dec-cart]', 'click', function (b) { changeCartQty(parseInt(b.getAttribute('data-dec-cart'), 10), -1); });
      bindCollection('#cart-items [data-del-cart]', 'click', function (b) { removeCartItem(parseInt(b.getAttribute('data-del-cart'), 10)); });
    }
    var totalLabel = $('#cart-total-label');
    if (totalLabel) totalLabel.textContent = 'L ' + number(total);
  }

  function changeCartQty(idx, delta) {
    var items = loadCart();
    if (!items[idx]) return;
    items[idx].cantidad = (items[idx].cantidad || 1) + delta;
    if (items[idx].cantidad <= 0) items.splice(idx, 1);
    saveCart(items);
    renderCart();
  }
  function removeCartItem(idx) {
    var items = loadCart();
    items.splice(idx, 1);
    saveCart(items);
    renderCart();
  }
  function flashCartButton() {
    var b = $('#cart-header-btn');
    if (b) { b.classList.add('bump'); setTimeout(function () { b.classList.remove('bump'); }, 300); }
  }

  window.openCartDrawer = function () {
    renderCart();
    var drawer = $('#cart-drawer'), overlay = $('#cart-drawer-overlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.hidden = false;
    if (drawer) drawer.setAttribute('aria-hidden', 'false');
  };
  window.closeCartDrawer = function () {
    var drawer = $('#cart-drawer'), overlay = $('#cart-drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.hidden = true;
    if (drawer) drawer.setAttribute('aria-hidden', 'true');
  };

  /* ════════════════════════════════════════════════
     CHECKOUT - GUARDAR PEDIDO + WHATSAPP
     ════════════════════════════════════════════════ */
  function openCheckout() {
    var items = loadCart();
    if (!items.length) { alert('Tu carrito está vacío.'); return; }
    currentCheckout = null;
    var g = $('#co-generate'), sh = $('#co-share-whatsapp'), dn = $('#co-done');
    if (g) g.hidden = false;
    if (sh) sh.hidden = true;
    if (dn) dn.hidden = true;
    var sum = $('#checkout-summary');
    if (sum) {
      var total = 0;
      items.forEach(function (it) { total += (it.precio || 0) * it.cantidad; });
      sum.innerHTML = items.map(function (it) {
        return '<div class="co-sum-row"><span>' + esc(it.nombre) + ' × ' + it.cantidad + '</span><span>L ' + number((it.precio || 0) * it.cantidad) + '</span></div>';
      }).join('') + '<div class="co-sum-total">Total: <strong>L ' + number(total) + '</strong></div>';
    }
    var modal = $('#checkout-modal');
    if (modal) modal.hidden = false;
  }
  function closeCheckoutModal() {
    var m = $('#checkout-modal');
    if (m) m.hidden = true;
  }

  function showCoError(msg) {
    var el = $('#co-error');
    if (el) { el.textContent = msg; el.hidden = false; setTimeout(function () { el.hidden = true; }, 3500); }
  }

  function buildWhatsAppOrder(data) {
    var lineas = ['¡Hola Dakyros! Adjunto mi pedido:'];
    lineas.push('Cliente: ' + data.nombre);
    lineas.push('Ciudad: ' + data.ciudad);
    if (data.direccion) lineas.push('Dirección: ' + data.direccion);
    if (data.telefono) lineas.push('Teléfono: ' + data.telefono);
    (data.items || []).forEach(function (it) {
      lineas.push('• ' + it.nombre + ' × ' + it.cantidad + ' = L ' + number((it.precio || 0) * it.cantidad));
    });
    if (data.nota) lineas.push('Nota: ' + data.nota);
    if (data.update) lineas.push('N. pedido: ' + data.update);
    var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lineas.join('\n'));
    window.open(url, '_blank', 'noopener');
  }

  window.orderProduct = function (id) { addToCart(id); };
  window.startOrder = window.orderProduct;

  /* ════════════════════════════════════════════════
     UTILIDADES / SEGURIDAD
     ════════════════════════════════════════════════ */
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  /* ════════════════════════════════════════════════
     SERVICE WORKER + REGISTRO
     ════════════════════════════════════════════════ */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(function () {
        // Registrar Background Sync si está disponible
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready.then(function (reg) {
            reg.sync.register('finca-sync').catch(function () { });
          });
        }
      }).catch(function () {
        console.warn('No se pudo registrar el service worker');
      });

      navigator.serviceWorker.addEventListener('message', function (e) {
        if (e.data && e.data.type === 'SYNC_TRIGGERED') {
          syncAll(false);
        }
      });
    }
  }

  /* ════════════════════════════════════════════════
     ADMINISTRACIÓN (Login + cPanel)
     ════════════════════════════════════════════════ */
  var AUTH_KEY = 'dakyros-admin-auth';

  function isAdminAuthed() {
    try { return localStorage.getItem(AUTH_KEY) === '1'; } catch (e) { return false; }
  }

  function setAdminAuthed(on) {
    try {
      if (on) localStorage.setItem(AUTH_KEY, '1');
      else localStorage.removeItem(AUTH_KEY);
    } catch (e) {}
  }

  function initAuthUI() {
    var form = $('#login-form');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var user = ($('#login-user').value || '').trim();
      var pass = $('#login-pass').value || '';
      var errEl = $('#login-error');
      if (errEl) errEl.hidden = true;

      if (!user || !pass) {
        if (errEl) { errEl.textContent = 'Ingresa usuario y clave.'; errEl.hidden = false; }
        return;
      }

      if (!window.SupabaseConfig || !SupabaseConfig.isConfigured()) {
        if (errEl) {
          errEl.textContent = 'Supabase no está configurado. Ve a Parametrización para añadir las credenciales y crear el usuario administrador.';
          errEl.hidden = false;
        }
        return;
      }

      Db.signIn(user, pass).then(function (res) {
        if (res && res.error) throw res.error;
        setAdminAuthed(true);
        go('cpanel');
      }).catch(function (err) {
        console.error('Login falló', err);
        if (errEl) {
          errEl.textContent = (err && err.message) || 'No se pudo iniciar sesión. Revisa tus credenciales.';
          errEl.hidden = false;
        }
      });
    });

    var logout = $('#cpanel-logout');
    if (logout && !logout.dataset.bound) {
      logout.dataset.bound = '1';
      logout.addEventListener('click', function () {
        setAdminAuthed(false);
        if (window.Db && Db.signOut) Db.signOut().catch(function(){});
        go('login');
      });
    }
  }

  function initCpanel() {
    initAuthUI();
    // Inicializar sub-tabs del cPanel
    var tabs = $all('.cpanel-tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        if (tab.dataset.bound) return;
        tab.dataset.bound = '1';
        tab.addEventListener('click', function () {
          $all('.cpanel-tab').forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          var target = tab.getAttribute('data-cpanel');
          $all('.cpanel-section').forEach(function (s) {
            s.classList.toggle('active', s.getAttribute('data-cpanel-section') === target);
          });
          if (target === 'dashboard') loadDashboard();
          if (target === 'usuarios') loadUsuarios();
          if (target === 'categorias') loadCategorias();
          if (target === 'productos') loadProductos();
          if (target === 'pedidos') loadPedidos();
          if (target === 'parametrizacion') loadParametrizacion();
        });
      })(tabs[i]);
    }
    // Botón "+ Nuevo" de usuarios
    bindOnce('#btn-new-user', 'click', function () {
      openCrudModal('usuario', null);
    });
    bindOnce('#btn-new-cat', 'click', function () {
      openCrudModal('categoria', null);
    });
    bindOnce('#btn-new-prod', 'click', function () {
      openCrudModal('producto', null);
    });
    bindOnce('#pedidos-export-btn', 'click', exportPedidosExcel);
    initConfigForms();

    // Protección: si no hay sesión, volver al login
    if (!isAdminAuthed()) {
      go('login');
      return;
    }
    // Cargar datos iniciales (dashboard activo)
    loadDashboard();
    loadUsuarios();
    loadCategorias();
    loadProductos();
    loadPedidos();
  }

  /* ---- Helper utilitario de cPanel ---- */
  function bindOnce(sel, evt, fn) {
    var el = $(sel);
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener(evt, fn);
  }

  function cpanelContainer(id, loadingText) {
    var el = $(id);
    if (el) el.innerHTML = '<p class="muted">' + (loadingText || 'Cargando…') + '</p>';
    return el;
  }

  /* ---- DASHBOARD ---- */
  function loadDashboard() {
    Promise.all([Db.fetchProductos(), Db.fetchCategorias(), Db.fetchUsuarios(), (Db.fetchPedidosAsAdmin || Db.fetchPedidos)()])
      .then(function (res) {
        var prod = res[0], cat = res[1], usr = res[2], ped = res[3];
        setText('cp-stat-productos', prod.length);
        setText('cp-stat-categorias', cat.length);
        setText('cp-stat-usuarios', usr.length);
        setText('cp-stat-pedidos', ped.length);
        var pend = ped.filter(function (p) { return p.estado === 'nuevo' || p.estado === 'confirmado' || p.estado === 'preparacion'; });
        setText('cp-stat-pendientes', pend.length);
        var dash = $('#cp-dash-pedidos');
        if (!dash) return;
        if (!ped.length) {
          dash.innerHTML = '<p class="muted">Sin pedidos registrados.</p>';
          return;
        }
        dash.innerHTML = ped.slice(0, 5).map(function (o) {
          var items = Array.isArray(o.items) ? o.items.length : 0;
          return '<div class="reg-item"><div><strong>' + esc(o.nombre || 'Cliente') + '</strong> · ' + esc(o.ciudad || '') + '</div>' +
            '<div class="muted">' + items + ' ítems · ' + esc(o.estado || 'nuevo') + '</div></div>';
        }).join('');
      }).catch(function (e) { console.error('Dashboard', e); });
  }

  function setText(id, val) {
    var el = $('#' + id);
    if (el) el.textContent = val;
  }

  /* ---- USUARIOS ---- */
  function loadUsuarios() {
    var box = cpanelContainer('#user-list', 'Cargando usuarios…');
    Db.fetchUsuarios().then(function (rows) {
      if (!rows.length) { box.innerHTML = '<p class="muted">No hay usuarios.</p>'; return; }
      box.innerHTML = rows.map(function (u) {
        return '<div class="reg-item">' +
          '<div><strong>' + esc(u.usuario || '') + '</strong> · <span class="muted">' + esc(u.rol || '') + '</span></div>' +
          '<div class="muted">' + esc(u.nombre || '') + '</div>' +
          '<div class="reg-actions">' +
          '<button class="btn btn-ghost btn-sm" data-edit-usuario="' + u.id + '">✎ Editar</button>' +
          '<button class="btn btn-ghost btn-sm danger" data-del-usuario="' + u.id + '">🗑</button>' +
          '</div></div>';
      }).join('');
      bindCollection('[data-edit-usuario]', 'click', function (btn) { openCrudModal('usuario', btn.getAttribute('data-edit-usuario')); });
      bindCollection('[data-del-usuario]', 'click', function (btn) { confirmDelete('usuario', btn.getAttribute('data-del-usuario')); });
    }).catch(function (e) { box.innerHTML = '<p class="form-error">Error al cargar usuarios.</p>'; });
  }

  /* ---- CATEGORÍAS ---- */
  function loadCategorias() {
    var box = cpanelContainer('#cat-list', 'Cargando categorías…');
    Db.fetchCategorias().then(function (rows) {
      if (!rows.length) { box.innerHTML = '<p class="muted">No hay categorías.</p>'; return; }
      box.innerHTML = rows.map(function (c) {
        return '<div class="reg-item"><div><strong>' + esc(c.nombre) + '</strong></div>' +
          '<div class="reg-actions">' +
          '<button class="btn btn-ghost btn-sm" data-edit-cat="' + c.id + '">✎ Editar</button>' +
          '<button class="btn btn-ghost btn-sm danger" data-del-cat="' + c.id + '">🗑</button>' +
          '</div></div>';
      }).join('');
      bindCollection('[data-edit-cat]', 'click', function (btn) { openCrudModal('categoria', btn.getAttribute('data-edit-cat')); });
      bindCollection('[data-del-cat]', 'click', function (btn) { confirmDelete('categoria', btn.getAttribute('data-del-cat')); });
    }).catch(function (e) { box.innerHTML = '<p class="form-error">Error al cargar categorías.</p>'; });
  }

  /* ---- PRODUCTOS ---- */
  function loadProductos() {
    var box = cpanelContainer('#prod-list', 'Cargando productos…');
    Db.fetchProductos().then(function (rows) {
      if (!rows.length) { box.innerHTML = '<p class="muted">No hay productos.</p>'; return; }
      box.innerHTML = rows.map(function (p) {
        return '<div class="reg-item">' +
          '<div><strong>' + esc(p.nombre) + '</strong> · <span class="muted">' + esc(p.categoria || '') + '</span></div>' +
          '<div class="muted">' + esc(p.emoji || '') + ' L ' + (p.precio != null ? p.precio : '') + '</div>' +
          '<div class="reg-actions">' +
          '<button class="btn btn-ghost btn-sm" data-edit-prod="' + p.id + '">✎ Editar</button>' +
          '<button class="btn btn-ghost btn-sm danger" data-del-prod="' + p.id + '">🗑</button>' +
          '</div></div>';
      }).join('');
      bindCollection('[data-edit-prod]', 'click', function (btn) { openCrudModal('producto', btn.getAttribute('data-edit-prod')); });
      bindCollection('[data-del-prod]', 'click', function (btn) { confirmDelete('producto', btn.getAttribute('data-del-prod')); });
    }).catch(function (e) { box.innerHTML = '<p class="form-error">Error al cargar productos.</p>'; });
  }

  /* ---- PEDIDOS ---- */
  function loadPedidos() {
    var box = cpanelContainer('#pedido-list', 'Cargando pedidos…');
    var fetch = (window.Db && Db.fetchPedidosAsAdmin) ? Db.fetchPedidosAsAdmin() : Db.fetchPedidos();
    fetch.then(function (rows) {
      if (!rows || !rows.length) { box.innerHTML = '<p class="muted">Sin pedidos registrados.</p>'; return; }
      var nextMap = { nuevo: 'confirmado', confirmado: 'preparacion', preparacion: 'enviado', enviado: 'entregado' };
      var labelMap = { nuevo: 'Confirmar', confirmado: 'Preparar', preparacion: 'Enviar', enviado: 'Entregar' };
      box.innerHTML = rows.map(function (o) {
        var items = Array.isArray(o.items) ? o.items.length : 0;
        var est = o.estado || 'nuevo';
        var next = nextMap[est];
        var btnHtml = next
          ? '<button class="btn btn-primary btn-sm" data-adv-pedido="' + o.id + '" data-next="' + next + '">' + (labelMap[est] || 'Avanzar') + '</button>'
          : '<span class="muted">✔ Entregado</span>';
        return '<div class="reg-item" data-pedido-row="' + o.id + '">' +
          '<div><strong>' + esc(o.nombre || 'Cliente') + '</strong> · <span class="muted">' + esc(o.ciudad || '') + '</span></div>' +
          '<div class="muted">' + items + ' ítems · origen ' + esc(o.origen || '') + '</div>' +
          '<div class="muted">Estado: <strong data-pedido-estado="' + o.id + '">' + esc(est) + '</strong> · ' + esc((o.creado || '').toString().slice(0, 10)) + '</div>' +
          '<div class="reg-actions" data-pedido-actions="' + o.id + '">' + btnHtml +
          '<button class="btn btn-ghost btn-sm danger" data-del-pedido="' + o.id + '">🗑</button>' +
          '</div></div>';
      }).join('');
      bindCollection('[data-adv-pedido]', 'click', function (btn) {
        updatePedidoEstado(btn.getAttribute('data-adv-pedido'), btn.getAttribute('data-next'));
      });
      bindCollection('[data-del-pedido]', 'click', function (btn) { confirmDelete('pedido', btn.getAttribute('data-del-pedido')); });
    }).catch(function (e) { box.innerHTML = '<p class="form-error">Error al cargar pedidos.</p>'; });
  }

  function updatePedidoEstado(id, estado) {
    var numId = parseInt(id, 10);
    var nextMap = { nuevo: 'confirmado', confirmado: 'preparacion', preparacion: 'enviado', enviado: 'entregado' };
    var labelMap = { nuevo: 'Confirmar', confirmado: 'Preparar', preparacion: 'Enviar', enviado: 'Entregar' };
    Db.signIn('joseisaaclopez181@gmail.com', 'unitec1234..').then(function (res) {
      if (res && res.error) { console.error('signIn error:', res.error); alert('Error de autenticación.'); return; }
      return Db.client().from('pedidos').update({ estado: estado }).eq('id', numId).select();
    }).then(function (res) {
      if (!res) return;
      if (res && res.error) { console.error('update error:', res.error); alert('Error al actualizar: ' + res.error.message); return; }
      var estEl = document.querySelector('[data-pedido-estado="' + numId + '"]');
      if (estEl) estEl.textContent = estado;
      var actEl = document.querySelector('[data-pedido-actions="' + numId + '"]');
      if (actEl) {
        var next = nextMap[estado];
        var btnHtml = next
          ? '<button class="btn btn-primary btn-sm" data-adv-pedido="' + numId + '" data-next="' + next + '">' + (labelMap[estado] || 'Avanzar') + '</button>'
          : '<span class="muted">✔ Entregado</span>';
        actEl.innerHTML = btnHtml + '<button class="btn btn-ghost btn-sm danger" data-del-pedido="' + numId + '">🗑</button>';
        var newBtn = actEl.querySelector('[data-adv-pedido]');
        if (newBtn) newBtn.addEventListener('click', function () {
          updatePedidoEstado(newBtn.getAttribute('data-adv-pedido'), newBtn.getAttribute('data-next'));
        });
        var delBtn = actEl.querySelector('[data-del-pedido]');
        if (delBtn) delBtn.addEventListener('click', function () {
          confirmDelete('pedido', delBtn.getAttribute('data-del-pedido'));
        });
      }
      loadDashboard();
    }).catch(function (e) {
      console.error('updatePedidoEstado error:', e);
      alert('Error al actualizar pedido.');
    });
  }

  /* ---- CRUD GENÉRICO ---- */
  function openCrudModal(kind, id) {
    var all = { usuario: [], categoria: [], producto: [] };
    var loadP = (kind === 'usuario') ? Db.fetchUsuarios() : (kind === 'categoria') ? Db.fetchCategorias() : Db.fetchProductos();
    loadP.then(function (rows) {
      var record = null;
      if (id) {
        for (var i = 0; i < rows.length; i++) {
          if (String(rows[i].id) === String(id)) { record = rows[i]; break; }
        }
      }
      renderCrudForm(kind, record);
    }).catch(function () { renderCrudForm(kind, null); });
  }

  function renderCrudForm(kind, record) {
    var title = $('#crud-modal-title');
    var fields = $('#crud-fields');
    var err = $('#crud-error');
    if (err) err.hidden = true;
    var defs = crudFieldDefs(kind);
    if (title) title.textContent = (record ? 'Editar' : 'Nuevo') + ' ' + cap(kind);
    fields.innerHTML = defs.map(function (f) {
      var val = record ? (record[f.key] != null ? record[f.key] : '') : (f.def != null ? f.def : '');
      var html = '<div class="form-row"><label class="form-label" for="crud-' + f.key + '">' + f.label + '</label>';
      if (f.type === 'select') {
        html += '<select id="crud-' + f.key + '" class="form-input">' +
          f.options.map(function (o) {
            var v = (typeof o === 'object') ? o.value : o;
            var l = (typeof o === 'object') ? o.label : o;
            return '<option value="' + v + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + l + '</option>';
          }).join('') + '</select>';
      } else {
        html += '<input id="crud-' + f.key + '" class="form-input" type="' + (f.type || 'text') + '" value="' + esc(String(val)) + '"' + (f.required ? ' required' : '') + '>';
      }
      return html + '</div>';
    }).join('');

    var modal = $('#crud-modal');
    if (modal) modal.hidden = false;

    var form = $('#crud-form');
    if (form.dataset.bound === kind + (record ? record.id : 'new')) return;
    form.dataset.bound = kind + (record ? record.id : 'new');
    form.onsubmit = function (e) {
      e.preventDefault();
      var data = {};
      for (var i = 0; i < defs.length; i++) {
        var el = document.getElementById('crud-' + defs[i].key);
        if (!el) continue;
        var v = el.value;
        if (defs[i].type === 'number') v = parseFloat(v) || 0;
        data[defs[i].key] = v;
      }
      if (record) {
        data.id = record.id;
        Object.keys(record).forEach(function (k) { if (!(k in data)) data[k] = record[k]; });
      }
      saveCrud(kind, data).then(function (ok) {
        if (ok) {
          closeCrudModal();
          if (kind === 'usuario') loadUsuarios();
          if (kind === 'categoria') loadCategorias();
          if (kind === 'producto') loadProductos();
          loadDashboard();
          loadShop();
        }
      });
    };

    var closers = $all('[data-crud-close]');
    for (var c = 0; c < closers.length; c++) {
      if (closers[c].dataset.closeBound) continue;
      closers[c].dataset.closeBound = '1';
      closers[c].addEventListener('click', closeCrudModal);
    }
  }

  function crudFieldDefs(kind) {
    if (kind === 'usuario') {
      return [
        { key: 'usuario', label: 'Usuario', required: true },
        { key: 'nombre', label: 'Nombre completo', required: true },
        { key: 'rol', label: 'Rol', type: 'select', options: ['admin', 'vendedor', 'campo'], required: true },
        { key: 'activo', label: 'Activo', type: 'select', options: [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }] }
      ];
    }
    if (kind === 'categoria') {
      return [
        { key: 'nombre', label: 'Nombre de la categoría', required: true }
      ];
    }
    return [
      { key: 'nombre', label: 'Nombre', required: true },
      { key: 'categoria', label: 'Categoría', required: true },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'precio', label: 'Precio (L)', type: 'number', required: true },
      { key: 'emoji', label: 'Emoji' },
      { key: 'perfil', label: 'Perfil de sabor', type: 'select', options: ['intenso', 'cremoso', 'aromatico', 'diario'] },
      { key: 'ocasion', label: 'Ocasión', type: 'select', options: ['capricho', 'regalo', 'diario'] }
    ];
  }

  function saveCrud(kind, data) {
    if (kind === 'usuario') {
      if ('activo' in data) data.activo = String(data.activo) === 'true';
      return Db.pushUsuarios([data]).then(function () { return true; }).catch(function () { return false; });
    }
    if (kind === 'categoria') return Db.pushCategorias([data]).then(function () { return true; }).catch(function () { return false; });
    return Db.pushProductos([data]).then(function () { return true; }).catch(function () { return false; });
  }

  function confirmDelete(kind, id) {
    if (!confirm('¿Eliminar este registro?')) return;
    var fn = null;
    if (kind === 'usuario') fn = Db.fetchUsuarios;
    if (kind === 'categoria') fn = Db.fetchCategorias;
    if (kind === 'producto') fn = Db.fetchProductos;
    if (kind === 'pedido') fn = Db.fetchPedidosAsAdmin || Db.fetchPedidos;
    fn().then(function (rows) {
      var target = rows.filter(function (r) { return String(r.id) === String(id); })[0];
      if (!target) return;
      var del = null;
      if (kind === 'pedido') {
        del = Db.signIn('joseisaaclopez181@gmail.com', 'unitec1234..').then(function () {
          return Db.client().from('pedidos').delete().eq('id', target.id);
        });
      } else if (kind === 'usuario') {
        del = Db.client().from('usuarios').delete().eq('id', target.id);
      } else if (kind === 'categoria') {
        del = Db.client().from('categorias').delete().eq('id', target.id);
      } else if (kind === 'producto') {
        del = Db.client().from('productos').delete().eq('id', target.id);
      }
      if (!del) return;
      del.then(function () {
        if (kind === 'usuario') loadUsuarios();
        if (kind === 'categoria') loadCategorias();
        if (kind === 'producto') loadProductos();
        if (kind === 'pedido') loadPedidos();
        loadDashboard();
        loadShop();
      }).catch(function (e) { console.error(e); alert('No se pudo eliminar.'); });
    });
  }

  function closeCrudModal() {
    var m = $('#crud-modal');
    if (m) m.hidden = true;
  }

  /* ---- PARAMETRIZACIÓN (config en localStorage) ---- */
  var CFG_KEY = 'dakyros-cfg';

  function loadParametrizacion() {
    var cfg = loadCfg();
    if (cfg.nombre) setVal('#cfg-nombre', cfg.nombre);
    if (cfg.footer) setVal('#cfg-footer-txt', cfg.footer);
    if (cfg.whatsapp) setVal('#cfg-whats', cfg.whatsapp);
  }

  function loadCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveCfg(partial) {
    var cfg = Object.assign(loadCfg(), partial);
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
    return cfg;
  }
  function setVal(sel, val) {
    var el = $(sel);
    if (el) el.value = val;
  }
  function showCfgMsg(msg) {
    var el = $('#cfg-message');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); setTimeout(function () { el.textContent = ''; }, 3000); }
  }
  function initConfigForms() {
    bindOnce('#cfg-identity', 'submit', function (e) {
      e.preventDefault();
      var v = $('#cfg-nombre').value;
      saveCfg({ nombre: v });
      var navBrand = $('#nav-brand'), footerBrand = $('#footer-brand');
      if (navBrand) navBrand.textContent = v;
      showCfgMsg('Identidad guardada.');
    });
    bindOnce('#cfg-footer', 'submit', function (e) {
      e.preventDefault();
      var v = $('#cfg-footer-txt').value;
      saveCfg({ footer: v });
      var fText = $('#footer-text');
      if (fText) fText.textContent = v;
      showCfgMsg('Footer guardado.');
    });
    bindOnce('#cfg-whatsapp', 'submit', function (e) {
      e.preventDefault();
      var v = $('#cfg-whats').value.trim();
      if (!v) return;
      saveCfg({ whatsapp: v });
      WHATSAPP_NUMBER = v;
      showCfgMsg('WhatsApp guardado.');
    });
    bindOnce('#cfg-reset', 'click', function () {
      try { localStorage.removeItem(CFG_KEY); } catch (e) {}
      loadParametrizacion();
      showCfgMsg('Valores restaurados.');
    });
  }

  function exportPedidosExcel() {
    var fetch = (window.Db && Db.fetchPedidosAsAdmin) ? Db.fetchPedidosAsAdmin() : Db.fetchPedidos();
    fetch.then(function (rows) {
      if (!rows || !rows.length) { alert('No hay pedidos para exportar.'); return; }
      var data = rows.map(function (o) {
        var itemsArr = Array.isArray(o.items) ? o.items : [];
        var itemsTxt = itemsArr.map(function (i) {
          var sub = (i.precio || 0) * (i.cantidad || 1);
          return (i.nombre || '') + ' x' + (i.cantidad || 1) + ' (L ' + number(sub) + ')';
        }).join(', ');
        var total = itemsArr.reduce(function (s, i) { return s + (i.precio || 0) * (i.cantidad || 1); }, 0);
        var fecha = o.creado ? new Date(o.creado) : null;
        var fechaStr = fecha ? fecha.toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'medium' }) : '';
        var upd = o.updated_at ? new Date(o.updated_at) : null;
        var updStr = upd ? upd.toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'medium' }) : '';
        var estado = o.estado || 'nuevo';
        var estados = { nuevo: 'Nuevo', confirmado: 'Confirmado', preparacion: 'En Preparacion', enviado: 'Enviado', entregado: 'Entregado' };
        return {
          'ID': 'P-' + String(o.id || 0).padStart(3, '0'),
          'Nombre': o.nombre || '',
          'Ciudad': o.ciudad || '',
          'Direccion': o.direccion || '',
          'Telefono': o.telefono || '',
          'Items': itemsTxt,
          'Total': 'L' + number(total),
          'Estado': estados[estado] || estado,
          'Creado': fechaStr,
          'Actualizado': updStr
        };
      });
      if (typeof XLSX === 'undefined') {
        alert('Libreria Excel no cargada. Intenta de nuevo.');
        return;
      }
      var ws = XLSX.utils.json_to_sheet(data);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
      XLSX.writeFile(wb, 'pedidos-finca-dakyros.xlsx');
    }).catch(function (e) {
      console.error('Error exportando pedidos:', e);
      alert('Error al exportar pedidos. Asegurate de estar logueado como administrador.');
    });
  }

  function bindCollection(sel, evt, fn) {
    var els = $all(sel);
    for (var i = 0; i < els.length; i++) {
      if (els[i].dataset.bound) continue;
      els[i].dataset.bound = '1';
      els[i].addEventListener(evt, function () { fn(this); });
    }
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ════════════════════════════════════════════════
     INICIALIZACIÓN
     ════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    initAuthUI();
    initCartUI();
    openDB().then(function () {
      updateNetworkStatus();
      initMic();
      updatePendingCounter();
      renderActiveView();
      registerSW();
      // Sync automático al cargar si hay red
      if (navigator.onLine) syncAll(false);
    }).catch(function (err) {
      console.error('No se pudo abrir IndexedDB', err);
      updateNetworkStatus();
      renderActiveView();
      registerSW();
    });
  });

  function initCartUI() {
    bindOnce('#rec-order', 'click', function () {
      if (currentSuggestion) addToCart(currentSuggestion.id);
    });
    bindOnce('#shop-search', 'input', renderShop);
    bindOnce('#shop-filter-btn', 'click', function () {
      var f = $('#shop-filters');
      if (f) f.classList.toggle('open');
    });

    // Toggle del recomendador (colapsable)
    bindOnce('#rec-toggle', 'click', function () {
      var panel = $('#rec-panel');
      var btn = $('#rec-toggle');
      if (!panel) return;
      var open = panel.hidden;
      panel.hidden = !open;
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    bindOnce('#cart-checkout', 'click', openCheckout);
    bindOnce('#cart-clear', 'click', function () {
      if (confirm('¿Vaciar el carrito?')) { saveCart([]); renderCart(); }
    });
    bindOnce('#checkout-form', 'submit', function (e) {
      e.preventDefault();
      var nombre = $('#co-nombre').value.trim();
      var ciudad = $('#co-ciudad').value.trim();
      if (!nombre || !ciudad) { showCoError('Completa nombre y ciudad.'); return; }
      var direccion = $('#co-direccion').value.trim();
      var telefono = $('#co-telefono').value.trim();
      var nota = $('#co-nota').value.trim();
      var items = loadCart();
      if (!items.length) { showCoError('El carrito está vacío.'); return; }

      var pedido = {
        nombre: nombre,
        ciudad: ciudad,
        direccion: direccion,
        telefono: telefono,
        nota: nota,
        items: items,
        estado: 'nuevo',
        origen: 'whatsapp'
      };

      var saved = Promise.resolve();
      if (window.Db && Db.pushPedidosAsGuest) {
        saved = Db.pushPedidosAsGuest([pedido]);
      }
      saved.then(function () {
        currentCheckout = pedido;
        buildWhatsAppOrder(pedido);
        showCoDone();
      }).catch(function (err) {
        console.error('Error guardando pedido:', err);
        currentCheckout = pedido;
        buildWhatsAppOrder(pedido);
        showCoDone();
        showCoError('Pedido enviado por WhatsApp. No se guardó en el servidor.');
      });
    });

    var closers = $all('#checkout-modal [data-modal-close]');
    for (var ci = 0; ci < closers.length; ci++) {
      if (closers[ci].dataset.closeBound) continue;
      closers[ci].dataset.closeBound = '1';
      closers[ci].addEventListener('click', closeCheckoutModal);
    }

    // Botones secundarios del checkout
    bindOnce('#co-share-whatsapp', 'click', function () {
      var pedido = currentCheckout;
      if (pedido) buildWhatsAppOrder(pedido);
    });
    bindOnce('#co-done', 'click', function () {
      saveCart([]);
      renderCart();
      closeCheckoutModal();
      closeCartDrawer();
      currentCheckout = null;
      var btn = $('#co-generate'), share = $('#co-share-whatsapp'), done = $('#co-done');
      if (btn) btn.hidden = false;
      if (share) share.hidden = true;
      if (done) done.hidden = true;
      go('tienda');
    });

    loadShop();
    renderCart();
  }

  var currentCheckout = null;

  function showCoDone() {
    var btn = $('#co-generate'), share = $('#co-share-whatsapp'), done = $('#co-done');
    if (btn) btn.hidden = true;
    if (share) { share.hidden = false; share.classList.add('sharing'); }
    if (done) done.hidden = false;
  }

})();
