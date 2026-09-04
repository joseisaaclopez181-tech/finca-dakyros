/**
 * Finca Dakyros — Capa de acceso a datos de Supabase.
 * Carga @supabase/supabase-js desde CDN (sin build) y expone helpers
 * async para cada tabla: productos, categorias, pedidos, bitacoras, usuarios.
 * Degrada con gracia si Supabase no está configurado o hay sin conexión.
 */
(function () {
  var CLIENT = null;

  function isConfigured() {
    return window.SupabaseConfig && window.SupabaseConfig.isConfigured();
  }

  function client() {
    if (CLIENT) return CLIENT;
    if (!isConfigured()) return null;
    if (typeof window.supabase === 'undefined') {
      console.warn('supabase-js no cargado (CDN).');
      return null;
    }
    try {
      CLIENT = window.supabase.createClient(window.SupabaseConfig.url, window.SupabaseConfig.anonKey);
    } catch (e) {
      console.error('No se pudo crear el cliente de Supabase', e);
      return null;
    }
    return CLIENT;
  }

  function table(name) {
    var c = client();
    return c ? c.from(name) : null;
  }

  /* ---------- helpers genéricos ---------- */
  function upsert(store, rows) {
    var t = table(store);
    if (!t || !rows || !rows.length) return Promise.resolve({ count: 0 });
    return t.upsert(rows, { onConflict: 'id' });
  }

  function selectAll(store) {
    var t = table(store);
    if (!t) return Promise.resolve([]);
    return t.select('*').then(function (r) {
      if (r.error) { console.error('selectAll(' + store + ') error:', r.error.message); return []; }
      return r.data || [];
    });
  }

  var Db = {
    isConfigured: isConfigured,
    client: function () { return client(); },

    /* ---- Productos ---- */
    fetchProductos: function () { return selectAll('productos'); },
    pushProductos: function (rows) { return upsert('productos', rows); },

    /* ---- Categorías ---- */
    fetchCategorias: function () { return selectAll('categorias'); },
    pushCategorias: function (rows) { return upsert('categorias', rows); },

    /* ---- Pedidos ---- */
    fetchPedidos: function () { return selectAll('pedidos'); },
    fetchPedidosAsAdmin: function () {
      var c = client();
      if (!c) return Promise.resolve([]);
      return Db.signIn('joseisaaclopez181@gmail.com', 'unitec1234..').then(function (res) {
        if (res && res.error) {
          console.error('fetchPedidosAsAdmin: signIn failed', res.error.message);
        }
        return Db.fetchPedidos();
      }).catch(function (e) {
        console.error('fetchPedidosAsAdmin error:', e);
        return [];
      });
    },
    pushPedidos: function (rows) {
      var clean = (rows || []).map(function (o) {
        return {
          id: o.id,
          nombre: o.nombre || '',
          ciudad: o.ciudad || '',
          direccion: o.direccion || '',
          telefono: o.telefono || '',
          nota: o.nota || '',
          items: o.items || [],
          estado: o.estado || 'nuevo',
          origen: o.origen || 'whatsapp',
          creado: o.creado,
          update: o.update
        };
      });
      return upsert('pedidos', clean);
    },
    pushPedidosAsGuest: function (rows) {
      var c = client();
      if (!c) return Promise.reject(new Error('Supabase no configurado'));

      function tryInsert() {
        var t = table('pedidos');
        if (!t) return Promise.reject(new Error('No hay conexion'));
        var clean = (rows || []).map(function (o) {
          return {
            nombre: o.nombre || '',
            ciudad: o.ciudad || '',
            direccion: o.direccion || '',
            telefono: o.telefono || '',
            nota: o.nota || '',
            items: o.items || [],
            estado: o.estado || 'nuevo',
            origen: o.origen || 'whatsapp'
          };
        });
        return t.insert(clean, { defaultToNull: false }).then(function (res) {
          if (res && res.error) throw res.error;
          return res;
        });
      }

      return c.auth.getUser().then(function (result) {
        var user = result && result.data && result.data.user;
        if (user) return tryInsert();
        return Db.signIn('joseisaaclopez181@gmail.com', 'unitec1234..').then(function (res) {
          if (res && res.error) throw res.error;
          return tryInsert();
        });
      });
    },

    /* ---- Bitácoras ---- */
    fetchBitacoras: function () { return selectAll('bitacoras'); },
    pushBitacoras: function (rows) {
      var clean = (rows || []).map(function (r) {
        // Conservar el id local en `datos` para reconciliación si no hay id remoto.
        var datos = (r.datos && typeof r.datos === 'object') ? r.datos : {};
        datos.idLocal = r.id;
        return {
          id: r.id,
          tipo: r.tipo || '',
          fecha: r.fecha || '',
          responsable: r.responsable || '',
          sincronizado: true,
          sincronizado_en: r.sincronizadoEn || new Date().toISOString(),
          datos: datos
        };
      });
      return upsert('bitacoras', clean);
    },

    /* ---- Usuarios ---- */
    fetchUsuarios: function () { return selectAll('usuarios'); },
    pushUsuarios: function (rows) {
      var clean = (rows || []).map(function (u) {
        return { id: u.id, auth_user_id: u.auth_user_id || null, usuario: u.usuario, nombre: u.nombre, rol: u.rol, activo: u.activo !== false };
      });
      return upsert('usuarios', clean);
    },

    /* ---- Auth ---- */
    signIn: function (email, pass) {
      var c = client(); if (!c) return Promise.reject(new Error('Supabase no configurado'));
      return c.auth.signInWithPassword({ email: email, password: pass });
    },
    signUp: function (email, pass) {
      var c = client(); if (!c) return Promise.reject(new Error('Supabase no configurado'));
      return c.auth.signUp({ email: email, password: pass });
    },
    signOut: function () {
      var c = client(); if (!c) return Promise.resolve();
      return c.auth.signOut();
    },
    currentUser: function () {
      var c = client(); if (!c) return null;
      return c.auth.getUser();
    },
    onAuthStateChange: function (cb) {
      var c = client(); if (!c) return null;
      return c.auth.onAuthStateChange(cb);
    }
  };

  window.Db = Db;
})();
