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
  const WHATSAPP_NUMBER = '50494522586';

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
  const views = ['inicio', 'tienda', 'finca', 'panel'];

  window.go = function (name) {
    if (views.indexOf(name) === -1) return;
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
    if (currentView === 'tienda') renderCatalog();
    if (currentView === 'panel') renderPanel();
    if (currentView === 'finca') renderFincaList();
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
    return '<article class="product-card">' +
      '<div class="p-body">' +
      '<div class="p-emoji">' + p.emoji + '</div>' +
      '<span class="p-badge">' + p.precio + '</span>' +
      '<h4>' + esc(p.nombre) + '</h4>' +
      '<p class="p-desc">' + esc(p.descripcion) + '</p>' +
      '<button class="btn btn-accent" onclick="orderProduct(\'' + p.id + '\')">Pedir</button>' +
      '</div>' +
      '</article>';
  }

  function renderCatalog() {
    $('#catalog').innerHTML = PRODUCTOS.map(productCardHTML).join('');
  }

  function renderPopular() {
    const picks = ['barra-70', 'choco-50-leche', 'cafe-altura'];
    const list = picks.map(function (id) {
      return PRODUCTOS.filter(function (p) { return p.id === id; })[0];
    });
    $('#popular').innerHTML = list.map(productCardHTML).join('');
  }

  /* ════════════════════════════════════════════════
     RECOMENDADOR INTELIGENTE DE SABOR
     ════════════════════════════════════════════════ */
  let currentSuggestion = null;

  $('#rec-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const sabor = $('input[name="sabor"]:checked').value;
    const ocasion = $('input[name="ocasion"]:checked').value;

    // Reglas de sugerencia: perfiles de Productos
    const match = PRODUCTOS.filter(function (p) {
      return p.perfil === sabor && p.ocasion === ocasion;
    })[0] || PRODUCTOS.filter(function (p) { return p.perfil === sabor; })[0] || PRODUCTOS[0];

    currentSuggestion = match;
    $('#rec-product').innerHTML =
      '<span class="rp-emoji">' + match.emoji + '</span>' +
      '<div class="rp-info"><h5>' + esc(match.nombre) + '</h5><p>' + esc(match.descripcion) + ' · ' + match.precio + '</p></div>';
    $('#rec-result').hidden = false;
    $('#rec-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ════════════════════════════════════════════════
     PEDIDO — FORMULARIO ULTRARRÁPIDO + WHATSAPP
     ════════════════════════════════════════════════ */
  function startOrder(productId) {
    const p = productId
      ? PRODUCTOS.filter(function (x) { return x.id === productId; })[0]
      : currentSuggestion;
    if (!p) return;

    const nombre = prompt('Pedido: ' + p.nombre + '\n\nNombre completo:', '').trim();
    if (!nombre) return;
    const ciudad = prompt('Ciudad de entrega:', '').trim();
    if (!ciudad) return;
    const cantidad = prompt('Requerimiento / Cantidad:', '1').trim() || '1';

    buildWhatsAppOrder({ product: p, nombre: nombre, ciudad: ciudad, cantidad: cantidad });
  }
  window.orderProduct = function (id) {
    if (!navigator.onLine) {
      alert('Necesitas conexión para generar el pedido por WhatsApp. Conéctate o revisa la señal.');
      return;
    }
    startOrder(id);
  };
  window.startOrder = startOrder;

  function buildWhatsAppOrder(data) {
    const mensaje =
      '¡Hola Dakyros! Adjunto mi pedido automatizado:\n' +
      'Cliente: ' + data.nombre + '\n' +
      'Ciudad: ' + data.ciudad + '\n' +
      'Producto: ' + data.product.nombre + '\n' +
      'Detalle: ' + data.cantidad;

    const url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(mensaje);
    window.open(url, '_blank', 'noopener');
  }

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
     INICIALIZACIÓN
     ════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
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

})();
