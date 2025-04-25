// Fungsi set cookie dengan atribut keamanan dan kadaluarsa
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; Secure; SameSite=Lax; expires=${expires}`;
}

// Fungsi untuk membaca Client ID dari Google Analytics (jika ada)
function getGAClientId() {
  const match = document.cookie.match(/_ga=GA1.1.(\d+\.\d+)/);
  return match ? match[1] : null;
}

// Set consent default sebelum user memilih (deny semua kecuali yang dibolehkan hukum)
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  personalization_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted'
});

// Fungsi untuk update consent dari CMP Silktide
function onNiaConsentReady() {
  const getConsent = key => localStorage.getItem(key) === 'true' ? 'granted' : 'denied';

  gtag('consent', 'update', {
    analytics_storage: getConsent('silktideCookieChoice_analytics'),
    ad_storage: getConsent('silktideCookieChoice_marketing'),
    ad_user_data: getConsent('silktideCookieChoice_marketing'),
    ad_personalization: getConsent('silktideCookieChoice_marketing'),
    personalization_storage: getConsent('silktideCookieChoice_marketing'),
    functionality_storage: getConsent('silktideCookieChoice_necessary'),
    security_storage: getConsent('silktideCookieChoice_necessary')
  });

  storeAllConsentBasedCookies();
}

// Menyimpan semua cookie setelah user memberi izin
function storeAllConsentBasedCookies() {
  const granted = type => localStorage.getItem(`silktideCookieChoice_${type}`) === 'true';

  if (granted('necessary')) {
    setCookie('session_id_nia', crypto.randomUUID(), 1);
    setCookie('lang_nia', navigator.language || 'id', 365);
    setCookie('csrftoken_nia', crypto.randomUUID(), 1);
  }

  if (granted('analytics')) {
    setCookie('_ga_nia', `GA1.1.${getGAClientId() || '111111111.111111111'}`, 365);
    setCookie('_gid_nia', 'GA1.1.987654321.987654321', 1);
  }

  if (granted('marketing')) {
    setCookie('google_ads_nia', 'active', 30);
    setCookie('social_embed_track_nia', 'enabled', 30);
  }

  setCookie('cookie_consent_nia', JSON.stringify({
    analytics: granted('analytics'),
    marketing: granted('marketing'),
    necessary: granted('necessary')
  }), 365);
}

// Event listener tambahan jika Silktide belum langsung memanggil
if (
  localStorage.getItem('silktideCookieChoice_necessary') !== null ||
  localStorage.getItem('silktideCookieChoice_analytics') !== null
) {
  onNiaConsentReady();
} else {
  // Tambahan untuk mendeteksi saat event Silktide siap (jaga-jaga)
  window.addEventListener('nia-consent-ready', () => {
    onNiaConsentReady();
  });
}

