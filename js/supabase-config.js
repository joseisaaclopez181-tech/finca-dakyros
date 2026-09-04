/**
 * Configuración de Supabase para Finca Dakyros.
 *
 * Cómo configurar:
 *  1. Crea un proyecto en https://supabase.com (o usa uno existente).
 *  2. Copia la "Project URL" y la "anon public" key (Project Settings → API).
 *  3. Guarda el archivo supabase/migrations/*.sql en el SQL Editor y ejecútalo,
 *     o `supabase db push` si usas la CLI.
 *  4. Puedes pegar las credenciales aquí (código) O en la app desde
 *     Parametrización → Supabase (se guardan en localStorage dakyros-supabase-config).
 */
(function () {
  var SUPABASE_URL_DEFAULT = 'https://gkeicdkfktphbzmwmvzw.supabase.co';
  var SUPABASE_ANON_KEY_DEFAULT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZWljZGtma3RwaGJ6bXdtdnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0ODIzMTcsImV4cCI6MjEwNDA1ODMxN30.e6CNYehkldGMGtAa947Ksnz7Pf1ETrdwj4KXoW0lyC8';

  var CFG_KEY = 'dakyros-supabase-config';

  function loadStored() {
    try {
      var raw = localStorage.getItem(CFG_KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }

  window.SupabaseConfig = {
    KEY: CFG_KEY,
    // URL + anon key activos (localStorage override > valores por defecto)
    get url() { return (loadStored().url || SUPABASE_URL_DEFAULT).trim(); },
    get anonKey() { return (loadStored().anonKey || SUPABASE_ANON_KEY_DEFAULT).trim(); },
    // ¿Está realmente configurado? (false si quedan placeholders)
    isConfigured: function () {
      var u = this.url;
      var k = this.anonKey;
      return u.indexOf('TU-PROYECTO') === -1 && u.indexOf('TU-') === -1 &&
             k.indexOf('TU-') === -1 && k.length > 20;
    },
    save: function (partial) {
      var cfg = Object.assign(loadStored(), partial);
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
      return cfg;
    },
    clear: function () { try { localStorage.removeItem(CFG_KEY); } catch (e) {} }
  };
})();
